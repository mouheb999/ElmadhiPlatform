-- 041_payment_proof.sql
-- Let a customer confirm their own transfer, in the app, with the screenshot.
--
-- Until now "I've paid" only wrote a pending row; the evidence arrived
-- separately over WhatsApp, so every activation waited on an admin matching a
-- chat message to a database row by hand. Attaching the proof to the request
-- turns that into one queue with everything already in it.
--
-- Re-runnable.

ALTER TABLE payment_requests
  -- Object path inside the private bucket, NOT a URL: the bucket is not public
  -- and the admin panel mints a short-lived signed URL when it renders.
  ADD COLUMN IF NOT EXISTS proof_path TEXT,
  -- Whatever the customer wants to tell us — the sender name on the transfer,
  -- "paid from my brother's account", a reference number.
  ADD COLUMN IF NOT EXISTS proof_note TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;

-- ---------- Private bucket for the screenshots ----------
-- Deliberately NOT public, unlike food-images and exercise-images (migration
-- 011). Those hold catalogue art; this holds bank apps mid-transfer, with
-- account numbers, balances and full names on screen. A public bucket would
-- make every one of them readable by URL to anyone who guessed the path.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- No storage RLS policies are granted to `authenticated` on purpose. Uploads
-- go through a Server Function using the service-role client after checking
-- the session, and reads happen only as signed URLs minted for an admin. That
-- keeps the bucket unreachable with a user's own anon token even if a path
-- leaks.

-- ---------- Only one request in flight per user ----------
-- A customer who taps "I've paid" twice used to create two pending rows, and
-- an admin could activate both — charging one term and granting two. The
-- checkout flow now reuses an open request, and this makes that an invariant
-- rather than a convention.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_one_pending
  ON payment_requests(user_id)
  WHERE status = 'pending';
