-- 034_support_tickets.sql
-- "Report a problem": a user writes in from the app header, an admin answers
-- in the admin panel, and the reply comes back to the same thread.
--
-- Modelled as a ticket with a message list rather than one message and one
-- reply, because the answer to a real problem is usually a question back
-- ("which screen?", "what did the receipt say?"). Q&A requests deliberately
-- stay separate: those become public library cards, these never do.
--
-- Who may write what is enforced here, not in the action:
--   * a user may open tickets, read their own, and post messages to them
--   * a user may NOT post a message as 'admin', and may not edit or delete
--     any message once sent — the thread is a record, for both sides
--   * the admin panel reads and answers through the service-role client,
--     which bypasses RLS, so no admin policy is granted

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Triage only; every value falls back to 'other' rather than blocking a report.
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'payment', 'plan', 'account', 'other')),
  -- open      → waiting on the admin
  -- answered  → admin replied, waiting on the user (or done)
  -- closed    → admin marked it finished; the user can still reopen by writing
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_admin_reply_at TIMESTAMPTZ,
  -- Drives the dot on the header icon: unread when a reply is newer than this.
  user_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The admin queue is "oldest unanswered first"; the user's list is newest-first.
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON support_tickets(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON support_messages(ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_own_read" ON support_tickets;
CREATE POLICY "support_tickets_own_read" ON support_tickets FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "support_tickets_own_insert" ON support_tickets;
CREATE POLICY "support_tickets_own_insert" ON support_tickets FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Needed for "I've read the reply" (user_seen_at) and for a user closing their
-- own ticket. Postgres RLS can't narrow this to single columns; the exposure is
-- a user rewriting the status of their own report, which costs nothing.
DROP POLICY IF EXISTS "support_tickets_own_update" ON support_tickets;
CREATE POLICY "support_tickets_own_update" ON support_tickets FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_own_read" ON support_messages;
CREATE POLICY "support_messages_own_read" ON support_messages FOR SELECT
  USING (
    (SELECT auth.uid()) = (
      SELECT user_id FROM support_tickets WHERE id = support_messages.ticket_id
    )
  );

-- `sender = 'user'` is the important half: without it a user could plant a
-- message that reads as an admin answer in their own thread and in the panel.
DROP POLICY IF EXISTS "support_messages_own_insert" ON support_messages;
CREATE POLICY "support_messages_own_insert" ON support_messages FOR INSERT
  WITH CHECK (
    sender = 'user'
    AND (SELECT auth.uid()) = (
      SELECT user_id FROM support_tickets WHERE id = support_messages.ticket_id
    )
  );
