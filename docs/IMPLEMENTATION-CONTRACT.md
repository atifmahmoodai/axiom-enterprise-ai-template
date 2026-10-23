# Intelligence OS implementation contract

This document coordinates server and UI boundaries. Shared TypeScript types are in `lib/intelligence/contracts.ts`.

- Successful API responses return the JSON resource directly. Errors use `{error:{code,message},requestId}` and appropriate HTTP status.
- Routes are `/api/v1/workspaces/:workspaceId/{overview,analytics,analyst,datasets,lab,catalog,lineage,analyses,views,evaluations,reports,jobs,audit}`. Root owns route dispatch.
- Server context is `{userId,workspaceId,role}`. `lib/server/db.ts` exports `withWorkspace(ctx, fn, readOnly=false)` where fn receives pg PoolClient; `workspaceQuery(ctx,sql,values=[],readOnly=true)` returns rows; `listResources(ctx,kind)`, `getResource(ctx,kind,id)`, `putResource(ctx,kind,id,data)`, `deleteResource(ctx,kind,id)` provide versioned JSON resources. A resource return is `{id,kind,data,createdAt,updatedAt,revision}`.
- `lib/server/auth.ts` exports `requireWorkspace(request,workspaceId,minimumRole='viewer')`, `getSession(request)` and `assertSameOrigin(request)`. Root owns API routes and login UI.
- Foundation migration owns workspaces, app_users, memberships, sessions, resources, audit_events and jobs. All workspace tables have forced RLS. Analytics agent owns fact_events migration with exact columns it chooses and communicates to consumers.
- Analytics exports `getOverview(ctx,filters)`, `runQuery(ctx,plan)`, `getCatalog()` and `getLineage(ctx)`. Shared types are authoritative. Analytics agent owns deterministic seed and SQL planner.
- Ingestion exports `listDatasets(ctx)`, `getDataset(ctx,id)`, `ingestFile(ctx,file)`, `transformDataset(ctx,id,operations,preview)` and `datasetRows(ctx,id,offset,limit)`. Lab exports `runLab(ctx,kind,filters,options?)`. Agent may expose job handlers and communicate signatures.
- AI exports `askAnalyst(ctx,input)`; evaluation exports `runEvaluation(ctx,input)` and `listEvaluations(ctx)`. Use analytics services, never repeat SQL execution/authorization.
- Power BI exports `listReports(ctx)`, `getEmbedConfig(ctx,key)`, `exportReport(ctx,key,input)`, `refreshReport(ctx,key)`. All identifiers map from approved server resources.
- UI entry `IntelligenceWorkspace` accepts `{workspaceId,section,user:{id,name,role},workspaces:[{id,name,role}]}`. Sections: overview, datasets, analyst, lab, catalog, evaluations, reports, governance. Root owns app route/layout composition. UI agent owns components/intelligence/workspace.tsx and CSS, excluding powerbi-view.tsx owned by integration agent.
- No agent edits package.json/package-lock.json or root API dispatch. Request packages from root. No commits by agents. Keep all credentials and generated runtime files ignored.
