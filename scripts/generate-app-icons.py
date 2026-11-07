"""
Generate the Android app icons from the transparent HYPE wordmark.

    python scripts/generate-app-icons.py

Writes to public/icons/. Re-run whenever public/logo-mark.png changes, then
rebuild the Android app (`bubblewrap update && bubblewrap build`): Bubblewrap
downloads these at build time and bakes them into the APK, so a new icon on
the website does not reach an installed app on its own.

Why these exist rather than reusing /icon (public/brand-tile.png):

That tile is drawn as a finished app icon — its own rounded corners, its own
border, its own glow, on pure black. Android then applies its OWN mask on top:
a circle on the Android 12+ splash screen, a squircle or circle on the
launcher. The result is a box inside a circle, with the tile's black seaming
against the #0F0F0F splash background. And its wordmark runs almost edge to
edge, so the circular mask crops the letters.

A maskable icon has to be the opposite: full-bleed background, no corners of
its own, and everything that matters inside the central safe zone, a circle
80% of the icon's width (https://web.dev/articles/maskable-icon). Whatever
shape the launcher cuts, nothing important is lost.

The background is #0F0F0F, the same as the app's theme and splash colour, so
on the splash screen the icon's square disappears into the background and all
that is visible is the glowing wordmark.
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "public" / "logo-mark.png"
OUT = ROOT / "public" / "icons"

BACKGROUND = (0x0F, 0x0F, 0x0F, 255)

# The wordmark's width as a fraction of the icon. For a mark this wide
# (aspect ~3.2:1) the limit is set by the safe-zone circle's diameter: the
# mark's bounding box must fit inside a circle 80% of the icon wide, which
# allows up to ~76% here. 58% leaves real margin, so even the tightest
# launcher mask and the splash screen's own inset keep clear of the letters.
MARK_WIDTH = 0.58


def load_letters() -> Image.Image:
    """
    The solid letters only, with the source's glow removed.

    The glow baked into logo-mark.png cannot be used. It was clipped at the
    edges of the PNG when it was exported: it spreads across the whole
    bounding box at alpha 3-9 and then stops dead at the border, so composited
    onto a dark square it shows up as a faint lime rectangle with hard edges
    around the word. Measured, not guessed: (24,27,17) inside that rectangle
    against (15,15,15) outside it.

    So the alpha is remapped to keep the letters — including their own
    anti-aliased edges, which is why this is a ramp and not a hard threshold —
    and to zero everything fainter. A fresh glow is drawn later, on a canvas
    with room for it to fade out.

    The ramp tops out at 210, not 255, because the source has NO fully opaque
    pixels: the letters themselves sit at alpha ~218. Ramping to 255 left them
    at about two-thirds opacity, which on a dark ground read as olive rather
    than neon. Anything at or above 210 is letter, and becomes fully solid.
    """
    mark = Image.open(MARK).convert("RGBA")
    floor, ceiling = 140, 210
    alpha = mark.getchannel("A").point(
        lambda a: 0 if a <= floor else min(255, round((a - floor) * 255 / (ceiling - floor)))
    )
    mark.putalpha(alpha)
    bbox = alpha.getbbox()
    return mark.crop(bbox) if bbox else mark


def resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """
    Resize through premultiplied alpha.

    A plain RGBA resize averages each pixel with its neighbours' colour
    regardless of their alpha, so the invisible colour stored in fully
    transparent pixels — here a blue-grey (76,105,113) — bleeds into every
    edge. On strokes this thin that is most of the letter, and the neon lime
    came out olive. Premultiplying ("RGBa") weights colour by alpha first, so
    transparent pixels contribute nothing.
    """
    return image.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def letter_colour(letters: Image.Image) -> tuple[int, int, int]:
    """
    The average colour of the fully opaque letter pixels, for the glow.

    Raises rather than defaulting. The first version divided by max(n, 1), so
    when it found no opaque pixels it quietly returned black — and drew a black
    glow, which on a dark icon is simply invisible. A missing glow with no
    error is the worst way for this to fail.
    """
    flat = letters.get_flattened_data() if hasattr(letters, "get_flattened_data") else letters.getdata()
    pixels = [p for p in flat if p[3] == 255]
    if not pixels:
        raise SystemExit("No fully opaque letter pixels — check the alpha ramp in load_letters().")
    return tuple(sum(p[i] for p in pixels) // len(pixels) for i in range(3))


def glow_layer(alpha: Image.Image, colour: tuple[int, int, int], radius: float, strength: float) -> Image.Image:
    blurred = alpha.filter(ImageFilter.GaussianBlur(radius)).point(lambda a: min(255, round(a * strength)))
    layer = Image.new("RGBA", alpha.size, (*colour, 0))
    layer.putalpha(blurred)
    return layer


def maskable(size: int, letters: Image.Image) -> Image.Image:
    width = round(size * MARK_WIDTH)
    height = round(letters.height * width / letters.width)
    scaled = resize(letters, (width, height))
    origin = ((size - width) // 2, (size - height) // 2)

    # The letters on a transparent full-size layer, so the glow is blurred
    # across the whole icon and fades to nothing well before any edge — the
    # exact failure of the source artwork.
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(scaled, origin)
    alpha = layer.getchannel("A")
    colour = letter_colour(letters)

    # Two glows, the way a neon tube actually reads: a tight bright bloom that
    # hugs the strokes, and a wide soft wash. One blur alone is either a halo
    # with no core or a core with no atmosphere.
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    canvas.alpha_composite(glow_layer(alpha, colour, size * 0.045, 0.45))
    canvas.alpha_composite(glow_layer(alpha, colour, size * 0.012, 0.85))
    canvas.alpha_composite(layer)
    return canvas


def monochrome(size: int, letters: Image.Image) -> Image.Image:
    """
    White silhouette on transparent, for the notification icon.

    Android tints notification icons itself and only reads the alpha channel,
    so the colour is irrelevant and any glow would be actively harmful: a soft
    halo becomes a grey smudge around the letters at 24dp. `letters` already
    has the glow stripped.
    """
    alpha = letters.getchannel("A")

    # Wider than the maskable mark: a notification icon is tiny and has no
    # shape mask to clear, so it can use most of its canvas.
    width = round(size * 0.86)
    height = round(alpha.height * width / alpha.width)
    # A single channel has no hidden colour to bleed, so a plain resize is fine.
    alpha = alpha.resize((width, height), Image.LANCZOS)

    glyph = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    glyph.putalpha(alpha)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(glyph, ((size - width) // 2, (size - height) // 2))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    letters = load_letters()

    outputs = {
        "icon-maskable-192.png": maskable(192, letters),
        "icon-maskable-512.png": maskable(512, letters),
        "icon-monochrome-512.png": monochrome(512, letters),
    }
    for name, image in outputs.items():
        path = OUT / name
        image.save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}")


if __name__ == "__main__":
    main()
