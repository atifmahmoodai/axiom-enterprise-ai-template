import Link from "next/link";
import {
  ArrowUpRight,
  Database,
  Sparkles,
  BarChart3,
  Activity,
} from "lucide-react";
export const metadata = { title: "Intelligence OS documentation" };
const cards = [
  {
    href: "/app/",
    icon: BarChart3,
    title: "Executive intelligence",
    copy: "Defined KPIs, period comparisons, segment filters, and inspectable provenance.",
  },
  {
    href: "/app/atlas/datasets/",
    icon: Database,
    title: "Data workbench",
    copy: "Import, profile, review transformations, and publish immutable dataset versions.",
  },
  {
    href: "/app/atlas/analyst/",
    icon: Sparkles,
    title: "Grounded analysis",
    copy: "Ask catalog questions and inspect the calculated facts, queries, and limitations.",
  },
  {
    href: "/app/atlas/evaluations/",
    icon: Activity,
    title: "Evaluation center",
    copy: "Inspect 32 reproducible cases and compare observed results against independent expectations.",
  },
];
export default function Docs() {
  return (
    <div className="docs-page page-container">
      <p className="eyebrow">
        <span />
        AXIOM INTELLIGENCE OS · ENGINEERING GUIDE
      </p>
      <h1>
        From a question
        <br />
        <span className="muted">to defensible evidence.</span>
      </h1>
      <p className="docs-intro">
        A server-backed analytics foundation with versioned data, reproducible
        methods, authorized workspaces, and Power BI integration.
      </p>
      <div className="docs-layout">
        <nav className="docs-sidebar" aria-label="Documentation sections">
          <a href="#quickstart">Quick start</a>
          <a href="#platform-guide">Platform guide</a>
          <a href="#configuration">Connected services</a>
          <a href="#production">Architecture</a>
          <a href="#quality">Verification</a>
          <a href="#delivery">Engineering handoff</a>
        </nav>
        <div className="docs-content">
          <section id="quickstart">
            <p className="eyebrow">01 / RUN THE REFERENCE</p>
            <h2>A complete local workspace.</h2>
            <p>
              Use Node.js 22 LTS and Docker Compose v2. The first startup
              applies migrations and seeds 249,150 facts across three isolated
              workspaces and 36 months.
            </p>
            <pre>
              <code>
                {
                  "npm ci\nnpm run setup\ndocker compose up --build -d\n\n# Open http://localhost:3000/login/"
                }
              </code>
            </pre>
            <div className="docs-note">
              <p>
                The local demo sign-in creates real server sessions. Ingestion,
                calculations, permissions, and background jobs are real. The
                deterministic analyst and local report preview are clearly
                labeled. Disable local demo sign-in before customer-facing
                deployment.
              </p>
            </div>
          </section>
          <section id="platform-guide">
            <p className="eyebrow">02 / EXPLORE THE WORKSPACE</p>
            <h2>Connect every part of the decision.</h2>
            <div className="docs-cards">
              {cards.map(({ href, icon: Icon, title, copy }) => (
                <Link className="docs-card" key={href} href={href}>
                  <Icon size={22} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span>
                    Open workspace
                    <ArrowUpRight size={13} />
                  </span>
                </Link>
              ))}
            </div>
            <p>
              Import CSV, XLSX, JSON, or Parquet, review its profile, preview a
              cleaning recipe and publish a new version. In the Analyst, select
              that version and ask for supported aggregates. The Analysis Lab
              provides cohort, forecast, anomaly, comparison and scenario
              methods over the reference SaaS fact model.
            </p>
          </section>
          <section id="configuration">
            <p className="eyebrow">03 / CONNECT YOUR SERVICES</p>
            <h2>Explicit configuration. Honest states.</h2>
            <p>
              OpenAI requires a server-only key and an explicitly selected
              structured-output-compatible model. Power BI requires Microsoft
              Entra service credentials, an approved customer profile/workspace,
              report/model mappings, effective RLS identities and eligible
              capacity.
            </p>
            <pre>
              <code>
                {
                  "AXIOM_MODE=connected\nAXIOM_DEMO_LOGIN=false\nOPENAI_MODEL=YOUR_APPROVED_MODEL\n# Keep credentials in server secrets, never NEXT_PUBLIC_* variables."
                }
              </code>
            </pre>
            <p>
              Connected failures return unavailable/error states. No sample
              answer or report is substituted. Operational SaaS dashboards
              require a configured fact-source adapter in connected mode;
              arbitrary uploaded files remain queryable through their own
              catalog.
            </p>
          </section>
          <section id="production">
            <p className="eyebrow">04 / SECURITY BOUNDARIES</p>
            <h2>Authorization lives on the server.</h2>
            <ol>
              <li>
                OIDC proves identity; database membership grants workspace
                access.
              </li>
              <li>
                Every database transaction resolves the actual membership and
                applies forced row-level security.
              </li>
              <li>
                The model selects an approved plan; the server compiles and
                validates the query.
              </li>
              <li>
                Fixed Python tools process files and statistics with bounded
                execution. Uploaded content never becomes code.
              </li>
              <li>
                Power BI IDs and effective identities come from a trusted server
                mapping. Browser filters do not replace RLS.
              </li>
              <li>
                Exports, jobs and saved analyses retain authorization and
                source-version metadata.
              </li>
            </ol>
            <p>
              Public template routes remain demonstrations. The protected
              application uses the new server architecture; browser-local
              template workspace switching never grants application membership.
            </p>
          </section>
          <section id="quality">
            <p className="eyebrow">05 / VERIFY THE EVIDENCE</p>
            <h2>Measure the whole system.</h2>
            <pre>
              <code>
                {
                  "npm run typecheck\nnpm test\nnpm run test:integration\nnpm run test:e2e\nnpm run build"
                }
              </code>
            </pre>
            <p>
              Benchmark scores disclose missing evidence. A deterministic run
              tests the pipeline and cannot establish LLM capability. Automated
              accessibility checks complement manual keyboard, screen-reader and
              device testing; they are not certification.
            </p>
          </section>
          <section id="delivery">
            <p className="eyebrow">06 / ENGINEERING HANDOFF</p>
            <h2>Everything an engineer needs to begin.</h2>
            <p>
              The repository includes migrations, seed data, typed API
              contracts, Docker setup, statistical methods, evaluation fixtures,
              Power BI model/DAX instructions and an explicit feature-status
              matrix.
            </p>
            <a
              className="button button-primary"
              href="https://github.com/atifmahmoodai/axiom-enterprise-ai-template"
              target="_blank"
              rel="noreferrer"
            >
              Open source repository
              <ArrowUpRight size={15} />
            </a>
            <p>
              Intelligence OS requires a server, worker, PostgreSQL and
              persistent artifact storage. The existing Sites preview remains
              the original static template.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
