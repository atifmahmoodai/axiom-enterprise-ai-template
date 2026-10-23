DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='axiom_app') THEN CREATE ROLE axiom_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='axiom_reader') THEN CREATE ROLE axiom_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='axiom_jobs') THEN CREATE ROLE axiom_jobs LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF;
END $$;
GRANT axiom_reader TO axiom_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO axiom_app, axiom_reader;
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION axiom_jobs;

CREATE TABLE IF NOT EXISTS app_users (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workspaces (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memberships (workspace_id text NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES app_users(id), role text NOT NULL CHECK(role IN ('viewer','analyst','administrator','owner')), PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS sessions (id_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES app_users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS oidc_transactions (state_hash text PRIMARY KEY, verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS identity_links (issuer text NOT NULL, subject text NOT NULL, user_id text NOT NULL REFERENCES app_users(id), PRIMARY KEY(issuer,subject));
CREATE TABLE IF NOT EXISTS resources (workspace_id text NOT NULL REFERENCES workspaces(id), kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,kind,id));
CREATE INDEX IF NOT EXISTS resources_kind ON resources(workspace_id,kind,updated_at DESC);
CREATE TABLE IF NOT EXISTS audit_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), actor_id text NOT NULL, action text NOT NULL, resource_id text, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_workspace ON audit_events(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS jobs (id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), user_id text NOT NULL REFERENCES app_users(id), kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')), progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), result jsonb, error text, boss_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY; ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY; ALTER TABLE resources FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY; ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_scope ON memberships;
CREATE POLICY membership_scope ON memberships USING(user_id=current_setting('app.user_id',true) OR (workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('administrator','owner'))) WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('administrator','owner'));
DROP POLICY IF EXISTS workspace_scope ON workspaces;
CREATE POLICY workspace_scope ON workspaces USING(EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=workspaces.id AND m.user_id=current_setting('app.user_id',true))) WITH CHECK(id=current_setting('app.workspace_id',true) AND current_setting('app.role',true)='owner');
DROP POLICY IF EXISTS resource_scope ON resources;
CREATE POLICY resource_scope ON resources USING(workspace_id=current_setting('app.workspace_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=resources.workspace_id AND m.user_id=current_setting('app.user_id',true))) WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
DROP POLICY IF EXISTS audit_scope ON audit_events;
CREATE POLICY audit_scope ON audit_events USING(workspace_id=current_setting('app.workspace_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=audit_events.workspace_id AND m.user_id=current_setting('app.user_id',true))) WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND actor_id=current_setting('app.user_id',true));
DROP POLICY IF EXISTS job_scope ON jobs;
CREATE POLICY job_scope ON jobs USING(workspace_id=current_setting('app.workspace_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=jobs.workspace_id AND m.user_id=current_setting('app.user_id',true))) WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND user_id=current_setting('app.user_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
GRANT SELECT ON workspaces,memberships,resources,audit_events,jobs TO axiom_app,axiom_reader;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_users,sessions,identity_links,oidc_transactions TO axiom_app;
GRANT INSERT,UPDATE,DELETE ON memberships,resources,jobs TO axiom_app;
GRANT INSERT ON audit_events TO axiom_app;
GRANT USAGE,SELECT ON SEQUENCE audit_events_id_seq TO axiom_app;

INSERT INTO workspaces(id,name) VALUES('atlas','Atlas Intelligence'),('helix','Helix Financial'),('meridian','Meridian Health') ON CONFLICT DO NOTHING;
INSERT INTO app_users(id,name,email) VALUES('demo-owner','Alex Morgan','owner@axiom.local'),('demo-analyst','Sam Chen','analyst@axiom.local'),('demo-viewer','Taylor Reed','viewer@axiom.local'),('demo-helix','Jordan Bell','helix@axiom.local') ON CONFLICT DO NOTHING;
INSERT INTO memberships(workspace_id,user_id,role) VALUES('atlas','demo-owner','owner'),('helix','demo-owner','owner'),('meridian','demo-owner','owner'),('atlas','demo-analyst','analyst'),('atlas','demo-viewer','viewer'),('helix','demo-helix','analyst') ON CONFLICT DO NOTHING;
