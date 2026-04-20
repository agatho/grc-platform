-- Sprint 60: Push Notifications
-- Migration 917: Create push_notification table

CREATE TABLE IF NOT EXISTS push_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  device_id UUID REFERENCES device_registration(id),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_notif_org_idx ON push_notification(org_id);
CREATE INDEX push_notif_user_idx ON push_notification(user_id);
CREATE INDEX push_notif_status_idx ON push_notification(status);
CREATE INDEX push_notif_created_idx ON push_notification(created_at);

-- RLS
ALTER TABLE push_notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_notification_org_isolation ON push_notification
  USING (org_id::text = current_setting('app.current_org_id', true));
