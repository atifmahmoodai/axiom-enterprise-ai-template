# Evaluation methodology

The reference contains 249,150 deterministic facts over October 2023 through September 2026, divided among Atlas, Helix and Meridian. Each organization has 83,050 facts. Generator versions and hashes identify exact data. Integer-cent reference totals and customer snapshots are accumulated independently of production SQL and metric functions.

The 32-case suite includes eight metric/arithmetic cases; four grouping/grain cases; four temporal cases; four data-quality/unit/empty-data cases; four statistical-method cases; four ambiguous/unsupported-inference cases; and four isolation/injection cases. Financial results use absolute/relative tolerances. No test compares SQL strings as evidence of numerical correctness.

Weights: numerical correctness 30%, grounding/provenance 20%, statistical validity 15%, safety/isolation 15%, explanation quality 10%, latency/cost 10%. Critical failures force a zero/security-failed run. Unavailable categories are null, not assumed correct or renormalized away. A fully passing deterministic run remains incomplete because it has no model usage-cost evidence.

Demo runs test the deterministic question planner and analytical/security pipeline. They are never labeled LLM scores. Connected runs call the explicitly configured OpenAI model for question-based cases; fixed statistical/security-control cases continue to test the application. This is a product-system evaluation, not a general-purpose model leaderboard.

Runs store provider/model, prompt version, dataset version/hash, configured code revision, trial count, per-case observed/expected results and timing, token counts and price-card version. API trials are bounded to 1-3. Missing audited price rates make cost null. Repeated runs reveal model variability.

The reference fixture deliberately includes a cost incident and contract contraction. Separate parser tests cover malformed records, mixed currencies, ambiguous dates, duplicate rows and malicious formula-like content. The 32-case dashboard is not exhaustive security testing and contains no formal causal inference.

An engineer should add new business definitions and independent holdout fixtures before using the suite to select a production model. Record nondeterminism and errors rather than deleting failed cases or claiming a benchmark that was never run.
