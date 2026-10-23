export type Role = "viewer" | "analyst" | "administrator" | "owner";
export type Mode = "demo" | "connected";
export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: Role;
};
export type ResultState =
  "ready" | "partial" | "stale" | "unavailable" | "failed";
export type Filters = {
  from?: string;
  to?: string;
  region?: string;
  plan?: string;
};
export type MetricDefinition = {
  id: string;
  name: string;
  description: string;
  unit: "USD" | "percent" | "count";
  formula: string;
  owner: string;
  version: string;
  source: string;
};
export type MetricValue = {
  id: string;
  label: string;
  value: number | null;
  previous: number | null;
  change: number | null;
  unit: string;
  state: ResultState;
};
export type Provenance = {
  datasetVersion: string;
  metricVersion: string;
  sources: string[];
  filters: Filters;
  generatedAt: string;
  sourceRefreshedAt?: string;
  refreshIntervalHours?: number | null;
  sourceState?: "ready" | "stale";
  query?: string;
  warnings: string[];
};
export type Overview = {
  metrics: MetricValue[];
  series: {
    month: string;
    revenue: number;
    cost: number;
    mrr: number;
    customers: number;
  }[];
  segments: { name: string; revenue: number; customers: number }[];
  provenance: Provenance;
  rowCount: number;
};
export type AnalyticalPlan = {
  metric: string;
  groupBy?: "month" | "region" | "plan" | "customer";
  filters?: Filters;
  limit?: number;
  datasetId?: string;
  dimension?: string;
};
export type AnalysisResult = {
  id: string;
  state: ResultState;
  columns: string[];
  rows: Record<string, unknown>[];
  query: string;
  provenance: Provenance;
  durationMs: number;
};
export type AnalystAnswer = {
  id: string;
  conversationId: string;
  provider: "demo" | "openai";
  status: "answered" | "clarification" | "unsupported";
  answer: string;
  facts: { label: string; value: string; source: string }[];
  result?: AnalysisResult;
  suggestions: string[];
  limitations: string[];
  usage?: { input: number; output: number; estimatedCost: number | null };
  model?: string;
};
export type DatasetSummary = {
  id: string;
  name: string;
  version: string;
  rows: number;
  columns: number;
  state: string;
  source: "seeded" | "uploaded" | "connected";
  createdAt: string;
  issues: number;
};
export type ColumnProfile = {
  name: string;
  type: string;
  missing: number;
  unique: number;
  invalid: number;
  examples: unknown[];
};
export type DatasetDetail = DatasetSummary & {
  fields: ColumnProfile[];
  preview: Record<string, unknown>[];
  warnings: string[];
  hash: string;
  parentVersion?: string;
  transformations: unknown[];
};
export type JobRecord = {
  id: string;
  kind: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: string;
};
export type EvaluationCase = {
  id: string;
  category: string;
  question: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  explanation: string;
  critical: boolean;
  durationMs: number;
};
export type EvaluationRun = {
  id: string;
  provider: string;
  model: string;
  label: string;
  score: number | null;
  status: string;
  cases: EvaluationCase[];
  categories: { name: string; weight: number; score: number | null }[];
  datasetVersion: string;
  promptVersion: string;
  createdAt: string;
  durationMs: number;
  usage?: { input: number; output: number; estimatedCost: number | null };
};
export type ReportSummary = {
  key: string;
  name: string;
  description: string;
  state: string;
  pages: string[];
  capabilities: { export: boolean; refresh: boolean };
  updatedAt?: string;
};
export type EmbedConfiguration = {
  mode: Mode;
  reportId?: string;
  embedUrl?: string;
  embedToken?: string;
  expiresAt?: string;
  capabilities: { export: boolean; refresh: boolean };
  message?: string;
};
export type LabResult = {
  kind: string;
  title: string;
  description: string;
  columns: string[];
  rows: Record<string, unknown>[];
  statistics: Record<string, number | string | null>;
  warnings: string[];
  provenance: Provenance;
};
