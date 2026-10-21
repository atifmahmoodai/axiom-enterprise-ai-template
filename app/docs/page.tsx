import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Workflow,
  Activity,
  Terminal,
  Calculator,
} from "lucide-react";
export const metadata: Metadata = { title: "Documentation" };
const routeCards = [
  {
    href: "/observability/",
    icon: Activity,
    title: "Observe your systems",
    copy: "Inspect multi-series telemetry, token throughput, and model drift.",
  },
  {
    href: "/workflows/",
    icon: Workflow,
    title: "Build an agent network",
    copy: "Compose a workflow, connect nodes, configure behaviors, and simulate a run.",
  },
  {
    href: "/developers/",
    icon: Terminal,
    title: "Explore the developer API",
    copy: "Switch languages, inspect requests, and manage demo API keys.",
  },
  {
    href: "/pricing/#roi",
    icon: Calculator,
    title: "Model the business case",
    copy: "Compare plans and calculate infrastructure economics from explicit assumptions.",
  },
];
export default function DocumentationPage() {
  return (
    <div className="docs-page page-container">
      <p className="eyebrow">
        <span /> AXIOM DOCUMENTATION
      </p>
      <h1>
        From first connection
        <br />
        <span className="muted">to full orchestration.</span>
      </h1>
      <p className="docs-intro">
        A considered foundation for enterprise AI. Explore the platform,
        understand the architecture, and make every component your own.
      </p>
      <div className="docs-layout">
        <nav className="docs-sidebar" aria-label="Documentation sections">
          <a href="#quickstart">Quick start</a>
          <a href="#platform-guide">Platform guide</a>
          <a href="#configuration">Configuration</a>
          <a href="#production">Production architecture</a>
          <a href="#quality">Quality & accessibility</a>
          <a href="#delivery">Source & deployment</a>
        </nav>
        <div className="docs-content">
          <section id="quickstart">
            <p className="eyebrow">01 / GET STARTED</p>
            <h2>Your control plane, in minutes.</h2>
            <p>
              The source package uses React 19, Next.js 15 App Router, Tailwind
              CSS 4, TypeScript, and Framer Motion. Install the locked
              dependencies, then launch the development server.
            </p>
            <pre>
              <code>
                {
                  "npm ci\nnpm run dev\n\n# Validate and export all pages\nnpm run typecheck\nnpm test\nnpm run build"
                }
              </code>
            </pre>
            <div className="docs-note">
              <p>
                This is an interactive template. Telemetry, keys, customer
                scenarios, and execution results are illustrative. Leads stay in
                the current session; workflows and demo keys can be saved in
                your browser.
              </p>
            </div>
          </section>
          <section id="platform-guide">
            <p className="eyebrow">02 / EXPLORE THE PLATFORM</p>
            <h2>One ecosystem. Four entry points.</h2>
            <div className="docs-cards">
              {routeCards.map(({ href, icon: Icon, title, copy }) => (
                <Link className="docs-card" href={href} key={href}>
                  <Icon size={22} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span>
                    Open workspace <ArrowUpRight size={13} />
                  </span>
                </Link>
              ))}
            </div>
            <h3>Designed around your next action</h3>
            <p>
              Begin with a cost model or explore the console directly. Switch
              between Atlas and Helix workspaces to see browser-local tenant
              partitioning. Select a workflow node to configure it, create
              connections using the controls, and inspect a simulated run before
              saving.
            </p>
          </section>
          <section id="configuration">
            <p className="eyebrow">03 / MAKE IT YOURS</p>
            <h2>Small configuration. Broad control.</h2>
            <p>
              Brand and navigation live in <code>lib/config.ts</code>. The CSS
              theme in <code>app/globals.css</code> defines the shared visual
              language. Each operational module owns its component styles and
              behavior.
            </p>
            <pre>
              <code>{`export const siteConfig = {\n  name: 'Axiom',\n  description: 'The control plane for intelligent systems.',\n  demoMode: true,\n  navigation: [/* typed route definitions */],\n} as const;\n\n// Tenant IDs are presentation context in this template.\n// Authorize every real operation on your server.\ntype TenantId = 'atlas' | 'helix';`}</code>
            </pre>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Template module integration guide
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Module</th>
                    <th scope="col">Configuration point</th>
                    <th scope="col">Production integration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Workspace</td>
                    <td>
                      <code>workspace-provider.tsx</code>
                    </td>
                    <td>Identity provider + authorized membership</td>
                  </tr>
                  <tr>
                    <td>Telemetry</td>
                    <td>
                      <code>observability.tsx</code>
                    </td>
                    <td>Metrics API + streaming transport</td>
                  </tr>
                  <tr>
                    <td>Execution</td>
                    <td>
                      <code>lib/workflow.ts</code>
                    </td>
                    <td>Authenticated workflow store + executor</td>
                  </tr>
                  <tr>
                    <td>Cost model</td>
                    <td>
                      <code>lib/roi.ts</code>
                    </td>
                    <td>Your verified rates and billing rules</td>
                  </tr>
                  <tr>
                    <td>Conversion</td>
                    <td>
                      <code>lead-dialog.tsx</code>
                    </td>
                    <td>Validated server endpoint + CRM delivery</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section id="production">
            <p className="eyebrow">04 / PRODUCTION ARCHITECTURE</p>
            <h2>A foundation you can build on.</h2>
            <p>
              The shipped application is a static frontend. Real tenant
              isolation belongs on the server and in the database. A selected
              workspace, a URL parameter, or a browser storage key must never
              grant access.
            </p>
            <ol>
              <li>Authenticate the user with your identity provider.</li>
              <li>
                Resolve and authorize their membership in the requested tenant.
              </li>
              <li>
                Scope every query, cache key, object path, and event to that
                authorized tenant.
              </li>
              <li>
                Enforce permissions for API key issuance, workflow execution,
                billing, and exports.
              </li>
              <li>
                Store secret credentials server-side; persist key hashes and
                return new keys once.
              </li>
              <li>
                Emit an audit event for sensitive actions and validate each
                workflow before execution.
              </li>
            </ol>
            <pre>
              <code>{`// Server integration contract — implement with your auth stack.\ninterface AuthorizedWorkspace {\n  userId: string;\n  tenantId: string;\n  role: 'owner' | 'admin' | 'developer' | 'viewer';\n}\n\ninterface TelemetryQuery {\n  from: string;\n  to: string;\n  resolution: 'minute' | 'hour' | 'day';\n}\n\n// Never trust a tenantId supplied by the browser on its own.\nconst workspace = await authorizeWorkspace(session, tenantSlug);\nreturn metrics.list(workspace.tenantId, validatedQuery);`}</code>
            </pre>
            <p>
              The developer kit includes a database boundary sketch, row-level
              security guidance, event shapes, migration steps, and backend
              adapter examples in <code>docs/ARCHITECTURE.md</code>.
            </p>
          </section>
          <section id="quality">
            <p className="eyebrow">05 / QUALITY BY DESIGN</p>
            <h2>Clarity is a feature.</h2>
            <p>
              The template includes semantic headings, visible focus, native
              dialogs, keyboard alternatives to dragging, explicit form labels,
              reduced-motion support, and table alternatives to visual data.
              Before launch, complete a screen-reader and keyboard audit with
              your final content.
            </p>
            <h3>Performance is a measured outcome.</h3>
            <p>
              Server-rendered routes, a local variable font, reserved chart
              dimensions, deferred browser interactions, and a lightweight
              canvas keep the foundation lean. A sub-500ms load is an
              aspirational budget that depends on hosting, network, device, and
              added integrations. It is not a measured guarantee.
            </p>
            <p>
              Use <code>docs/ACCESSIBILITY.md</code> and{" "}
              <code>docs/PERFORMANCE.md</code> as release checklists. Real-user
              monitoring and assistive technology checks belong in the final
              deployment.
            </p>
          </section>
          <section id="delivery">
            <p className="eyebrow">06 / THE DEVELOPER KIT</p>
            <h2>Everything has a place.</h2>
            <pre>
              <code>{`app/           Routes, metadata, shared theme\ncomponents/    Composable product UI and client interactions\nlib/           Configuration, workflow logic, ROI calculations\npublic/        Self-hosted visual assets\ntests/         Business logic and graph validation tests\ndocs/          Blueprints, onboarding, integration and QA guides\nout/           Generated static website after npm run build`}</code>
            </pre>
            <p>
              Deploy the generated <code>out/</code> directory to a static host
              with directory index support. For server routes, authentication,
              or database access, remove <code>output: 'export'</code> from
              Next.js configuration and deploy to a supported server runtime.
            </p>
            <Link className="button button-secondary" href="/">
              Back to the platform <ArrowUpRight size={14} />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
