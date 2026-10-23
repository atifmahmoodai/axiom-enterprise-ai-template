DROP POLICY resource_scope ON resources;
CREATE POLICY resource_read ON resources FOR SELECT USING(workspace_id=current_setting('app.workspace_id',true) AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=resources.workspace_id AND m.user_id=current_setting('app.user_id',true)));
CREATE POLICY resource_insert ON resources FOR INSERT WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
CREATE POLICY resource_update ON resources FOR UPDATE USING(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner')) WITH CHECK(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
CREATE POLICY resource_delete ON resources FOR DELETE USING(workspace_id=current_setting('app.workspace_id',true) AND current_setting('app.role',true) IN ('analyst','administrator','owner'));
ALTER ROLE axiom_reader SET statement_timeout='15s';
ALTER ROLE axiom_reader SET temp_file_limit='128MB';
