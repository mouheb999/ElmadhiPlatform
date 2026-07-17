# Downloads generated exercise illustrations into public/exercise-library/<category>/
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\download-exercise-images.ps1 [category]
# If no category is given, downloads every category that has a _images.json manifest.

param([string]$Category = "")

$root = Split-Path $PSScriptRoot -Parent
$specsDir = Join-Path $root "exercise-specs"

$manifests = if ($Category) {
    @(Join-Path $specsDir "$Category\_images.json")
} else {
    Get-ChildItem $specsDir -Recurse -Filter "_images.json" | ForEach-Object { $_.FullName }
}

foreach ($manifestPath in $manifests) {
    if (-not (Test-Path $manifestPath)) { Write-Host "No manifest: $manifestPath" -ForegroundColor Yellow; continue }
    $m = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $outDir = Join-Path $root "public\exercise-library\$($m.category)"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    $total = 0; $done = 0
    $m.images.PSObject.Properties | ForEach-Object { $total++ }

    foreach ($p in $m.images.PSObject.Properties) {
        $dest = Join-Path $outDir "$($p.Name).png"
        # Entries may be a bare filename (joined with base) or a full URL (used as-is).
        $url = if ($p.Value -like "http*") { $p.Value } else { "$($m.base)$($p.Value)" }
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
            $done++
            Write-Host ("[{0}/{1}] {2}.png" -f $done, $total, $p.Name) -ForegroundColor Green
        } catch {
            Write-Host ("FAILED  {0}  ({1})" -f $p.Name, $_.Exception.Message) -ForegroundColor Red
        }
    }
    Write-Host ("{0}: {1}/{2} images -> {3}" -f $m.category, $done, $total, $outDir) -ForegroundColor Cyan
}

# Compress to WebP + rebuild the app's illustration manifest.
node (Join-Path $PSScriptRoot "optimize-exercise-images.mjs")
