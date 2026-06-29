-- Create community polls feature
-- Tables: community_polls, community_poll_votes

-- Polls table
CREATE TABLE IF NOT EXISTS community_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Poll votes table (one vote per user per poll)
CREATE TABLE IF NOT EXISTS community_poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES community_polls(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_community_polls_topic ON community_polls(channel, topic);
CREATE INDEX IF NOT EXISTS idx_community_poll_votes_poll ON community_poll_votes(poll_id);

-- RLS
ALTER TABLE community_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read polls
CREATE POLICY "Anyone can read polls"
  ON community_polls FOR SELECT
  USING (true);

-- Only admin can create polls
CREATE POLICY "Admin can create polls"
  ON community_polls FOR INSERT
  WITH CHECK (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Anyone can read votes
CREATE POLICY "Anyone can read votes"
  ON community_poll_votes FOR SELECT
  USING (true);

-- Authenticated users can vote (one vote per poll)
CREATE POLICY "Users can vote"
  ON community_poll_votes FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Users can only delete their own vote (to change vote)
CREATE POLICY "Users can delete own vote"
  ON community_poll_votes FOR DELETE
  USING (user_id = auth.uid());
