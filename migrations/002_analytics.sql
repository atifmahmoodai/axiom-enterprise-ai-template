CREATE TABLE IF NOT EXISTS fact_events (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  occurred_at date NOT NULL,
  customer_id text NOT NULL,
  plan text NOT NULL,
  region text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('invoice','subscription','usage','infrastructure')),
  amount_cents bigint NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  mrr_cents bigint NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  dataset_version text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS fact_events_scope_date ON fact_events(workspace_id,dataset_version,occurred_at,event_type);
CREATE INDEX IF NOT EXISTS fact_events_snapshots ON fact_events(workspace_id,dataset_version,event_type,customer_id,occurred_at);
CREATE INDEX IF NOT EXISTS fact_events_segments ON fact_events(workspace_id,dataset_version,region,plan,occurred_at);
ALTER TABLE fact_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fact_scope ON fact_events;
CREATE POLICY fact_scope ON fact_events
  USING(workspace_id=current_setting('app.workspace_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=fact_events.workspace_id AND m.user_id=current_setting('app.user_id',true)))
  WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
GRANT SELECT ON fact_events TO axiom_app,axiom_reader;
GRANT INSERT ON fact_events TO axiom_app;
