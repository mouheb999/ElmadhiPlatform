-- 044_payment_thread.sql
-- Turn "upload the receipt and wait" into a conversation.
--
-- Migration 041 moved the transfer screenshot into the app, which fixed the
-- admin's side: one queue, evidence attached. It did nothing for the customer's
-- side. After tapping Send they get a spinner-shaped screen that says we are
-- checking, and if anything is wrong with the transfer — wrong amount, unreadable
-- screenshot, a name we can't match — there is no way to tell them except the
-- WhatsApp link we spent the last two migrations demoting.
--
-- So the receipt now opens a thread. Deliberately NOT a new messaging system:
-- support_tickets/support_messages (migration 034) already has the RLS, the
-- admin answering UI, and the unread dot in the app header. A payment thread is
-- a support ticket in category 'payment' that knows which request it is about.
--
-- Re-runnable. Paste into Supabase Dashboard -> SQL Editor -> Run.

BEGIN;

-- ============================================================
-- 1. A ticket can be about a payment request
-- ============================================================
-- SET NULL, not CASCADE: if a request row is ever removed the conversation is
-- still the record of what was said to a paying customer.
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS payment_request_id UUID
    REFERENCES payment_requests(id) ON DELETE SET NULL;

-- One thread per request. Two threads about the same transfer is how an admin
-- answers in the one the customer isn't reading.
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_payment_request
  ON support_tickets(payment_request_id)
  WHERE payment_request_id IS NOT NULL;

-- The payments queue renders each request's thread inline, keyed by request.
CREATE INDEX IF NOT EXISTS idx_support_tickets_payment_lookup
  ON support_tickets(payment_request_id, last_message_at DESC)
  WHERE payment_request_id IS NOT NULL;

-- A user may only ever attach a thread to a request that is theirs. The
-- existing insert policy checks support_tickets.user_id and says nothing about
-- what the row points at, so without this a caller could open a ticket against
-- somebody else's payment and read the admin's replies about it.
--
-- RESTRICTIVE so it is AND-ed with the policies already in force rather than
-- OR-ed alongside them. service_role bypasses RLS, so the admin panel is
-- unaffected.
DROP POLICY IF EXISTS "support_tickets_own_payment_request" ON support_tickets;
CREATE POLICY "support_tickets_own_payment_request" ON support_tickets
  AS RESTRICTIVE FOR ALL
  USING (
    payment_request_id IS NULL OR EXISTS (
      SELECT 1 FROM payment_requests pr
      WHERE pr.id = support_tickets.payment_request_id
        AND pr.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    payment_request_id IS NULL OR EXISTS (
      SELECT 1 FROM payment_requests pr
      WHERE pr.id = support_tickets.payment_request_id
        AND pr.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 2. What the admin has already looked at
-- ============================================================
-- Drives the count on the admin nav. Without it the only honest badge is "how
-- many requests are open", which stops being information the moment there is a
-- request you have already decided to leave open.
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS admin_seen_at TIMESTAMPTZ;

-- The queue's own query: everything still pending, newest first.
CREATE INDEX IF NOT EXISTS idx_payment_requests_pending_seen
  ON payment_requests(created_at DESC)
  WHERE status = 'pending';

-- ============================================================
-- 3. Reopening a request must not resurrect a stale "seen"
-- ============================================================
-- startPaymentRequest reuses an open row when a customer changes plan mid-flow
-- (migration 041). If the admin had already looked at the old shape, the new
-- one would arrive pre-read and never appear in the badge. Any customer-side
-- change to a pending request clears the mark.
CREATE OR REPLACE FUNCTION clear_payment_request_seen() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND (
       NEW.plan_tier   IS DISTINCT FROM OLD.plan_tier
    OR NEW.plan_months IS DISTINCT FROM OLD.plan_months
    OR NEW.amount_tnd  IS DISTINCT FROM OLD.amount_tnd
    OR NEW.method_key  IS DISTINCT FROM OLD.method_key
    OR NEW.proof_path  IS DISTINCT FROM OLD.proof_path
  ) THEN
    NEW.admin_seen_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_request_changed ON payment_requests;
CREATE TRIGGER on_payment_request_changed
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION clear_payment_request_seen();

COMMIT;
