-- Canonical fact snapshots are installed only through the isolated operator role.
-- The runtime can read pinned versions but cannot modify source data or activation metadata.
REVOKE INSERT ON fact_events FROM axiom_app;
ALTER POLICY resource_insert ON resources WITH CHECK (
  workspace_id=current_setting('app.workspace_id',true)
  AND current_setting('app.role',true) IN ('analyst','administrator','owner')
  AND kind NOT IN ('operational-source','operational-snapshot')
);
ALTER POLICY resource_update ON resources USING (
  workspace_id=current_setting('app.workspace_id',true)
  AND current_setting('app.role',true) IN ('analyst','administrator','owner')
  AND kind NOT IN ('operational-source','operational-snapshot')
) WITH CHECK (
  workspace_id=current_setting('app.workspace_id',true)
  AND current_setting('app.role',true) IN ('analyst','administrator','owner')
  AND kind NOT IN ('operational-source','operational-snapshot')
);
ALTER POLICY resource_delete ON resources USING (
  workspace_id=current_setting('app.workspace_id',true)
  AND current_setting('app.role',true) IN ('analyst','administrator','owner')
  AND kind NOT IN ('operational-source','operational-snapshot')
);
