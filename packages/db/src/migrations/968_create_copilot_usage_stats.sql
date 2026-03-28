-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 968: Create materialized view for copilot usage stats

CREATE MATERIALIZED VIEW IF NOT EXISTS copilot_usage_stats AS
SELECT
  c.org_id,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT c.user_id) AS unique_users,
  COALESCE(SUM(c.message_count), 0) AS total_messages,
  COALESCE(SUM(c.total_tokens_used), 0) AS total_tokens,
  COUNT(DISTINCT c.id) FILTER (WHERE c.last_message_at > now() - INTERVAL '7 days') AS active_conversations_7d,
  COALESCE(AVG(f.rating) FILTER (WHERE f.rating IS NOT NULL), 0) AS avg_feedback_rating
FROM copilot_conversation c
LEFT JOIN copilot_message m ON m.conversation_id = c.id
LEFT JOIN copilot_feedback f ON f.message_id = m.id
GROUP BY c.org_id;

CREATE UNIQUE INDEX copilot_usage_stats_org_idx ON copilot_usage_stats(org_id);
