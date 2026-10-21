"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  Check,
  ChevronDown,
  Layers3,
  Activity,
  Workflow,
  Terminal,
  ShieldCheck,
  Database,
  Globe2,
  Cpu,
  Plus,
  Minus,
  Command,
  Sparkles,
  Zap,
} from "lucide-react";
import { NetworkScene } from "./network-scene";
import { LeadCapture, LeadDialog } from "./lead-dialog";
const logos = [
  "Layers",
  "◈ Quanta",
  "○○ Circule",
  "Sisyphus",
  "✳ Catalog",
  "━━ Quotient",
];
const cases = [
  {
    name: "Meridian",
    sector: "FINANCIAL INTELLIGENCE",
    value: "41%",
    unit: "less infrastructure spend",
    text: "A reference architecture for auditable financial agents. Route research, validate evidence, and keep a complete decision trail.",
    baseline: "$42,000",
    optimized: "$24,780",
    detail:
      "Illustrative monthly costs for 120 agents. Includes compute, routing, and observability; excludes model provider fees.",
  },
  {
    name: "Helix",
    sector: "LIFE SCIENCES",
    value: "2.4×",
    unit: "faster knowledge retrieval",
    text: "A reference architecture for connecting research teams to governed knowledge. Retrieval, evaluation, and review share one workflow.",
    baseline: "960 ms",
    optimized: "400 ms",
    detail:
      "Illustrative retrieval latency in a synthetic research workload. Not a clinical performance or compliance claim.",
  },
  {
    name: "Orbit",
    sector: "AUTONOMOUS OPERATIONS",
    value: "99.95%",
    unit: "example availability target",
    text: "A reference architecture for resilient autonomous operations, with retry policies, a human review step, and visible execution traces.",
    baseline: "43.8 min",
    optimized: "21.9 min",
    detail:
      "Example downtime budgets over a 30.44-day month at 99.9% and 99.95%. Actual availability depends on your deployment.",
  },
];
function MiniChart() {
  const [period, setPeriod] = useState<"24h" | "7d">("24h");
  return (
    <div className="mini-chart">
      <div className="mini-chart-head">
        <span>
          Inference latency <span className="live-dot" />
        </span>
        <div>
          {(["24h", "7d"] as const).map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mini-chart-value">
        {period === "24h" ? "42" : "38"}
        <span>ms</span>
        <small>↘ {period === "24h" ? "18.6" : "23.2"}%</small>
      </div>
      <svg
        viewBox="0 0 480 100"
        role="img"
        aria-label={`${period} simulated median latency trend, ending at ${period === "24h" ? 42 : 38} milliseconds`}
      >
        <defs>
          <linearGradient id="mini-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#a1f8cf" stopOpacity=".2" />
            <stop offset="1" stopColor="#a1f8cf" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 50, 80].map((y) => (
          <path
            key={y}
            d={`M0 ${y}H480`}
            stroke="#24262d"
            strokeDasharray="3 5"
          />
        ))}
        <path
          d={
            period === "24h"
              ? "M0 45L18 40L35 59L52 38L74 49L93 37L110 42L130 25L150 38L175 28L194 35L215 20L240 28L260 16L282 29L310 22L340 32L366 21L390 28L415 13L440 22L460 11L480 18V100H0Z"
              : "M0 60L30 57L60 69L90 42L120 48L150 39L180 45L210 23L240 29L270 34L300 20L330 27L360 16L390 23L420 9L450 16L480 13V100H0Z"
          }
          fill="url(#mini-gradient)"
        />
        <path
          d={
            period === "24h"
              ? "M0 45L18 40L35 59L52 38L74 49L93 37L110 42L130 25L150 38L175 28L194 35L215 20L240 28L260 16L282 29L310 22L340 32L366 21L390 28L415 13L440 22L460 11L480 18"
              : "M0 60L30 57L60 69L90 42L120 48L150 39L180 45L210 23L240 29L270 34L300 20L330 27L360 16L390 23L420 9L450 16L480 13"
          }
          fill="none"
          stroke="#a2f3cc"
          strokeWidth="1.6"
        />
      </svg>
      <div className="mini-axis">
        <span>00:00</span>
        <span>08:00</span>
        <span>16:00</span>
        <span>23:59</span>
      </div>
    </div>
  );
}
function MiniTerminal() {
  const [lang, setLang] = useState<"Python" | "Node.js">("Python");
  return (
    <div className="mini-terminal">
      <div className="mini-terminal-bar">
        <span>
          <i />
          <i />
          <i />
        </span>
        <div>
          {(["Python", "Node.js"] as const).map((l) => (
            <button
              aria-pressed={lang === l}
              key={l}
              onClick={() => setLang(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <span>SDK</span>
      </div>
      <pre>
        <code>
          {lang === "Python" ? (
            <>
              <span className="syntax-purple">from</span> axiom{" "}
              <span className="syntax-purple">import</span> Axiom{"\n\n"}client
              = <span className="syntax-mint">Axiom</span>(){"\n"}run =
              client.agents.<span className="syntax-mint">run</span>({"\n"}
              {"  "}workflow=
              <span className="syntax-yellow">"research-v2"</span>,{"\n"}
              {"  "}stream=<span className="syntax-purple">True</span>
              {"\n"})
            </>
          ) : (
            <>
              <span className="syntax-purple">import</span> {"{ Axiom }"}{" "}
              <span className="syntax-purple">from</span>{" "}
              <span className="syntax-yellow">'@axiom/sdk'</span>;{"\n\n"}
              <span className="syntax-purple">const</span> client ={" "}
              <span className="syntax-purple">new</span>{" "}
              <span className="syntax-mint">Axiom</span>();{"\n"}
              <span className="syntax-purple">const</span> run ={" "}
              <span className="syntax-purple">await</span> client.agents.
              <span className="syntax-mint">run</span>({"{\n"}
              {"  "}workflow:{" "}
              <span className="syntax-yellow">'research-v2'</span>,{"\n"}
              {"  "}stream: <span className="syntax-purple">true</span>
              {"\n}"});
            </>
          )}
        </code>
      </pre>
      <div className="mini-terminal-status">
        <Check size={12} /> Workflow initialized <span>200 OK</span>
      </div>
    </div>
  );
}
function Pipeline() {
  const [stage, setStage] = useState(0);
  const stages = ["Connect", "Transform", "Validate", "Deploy"];
  return (
    <div className="pipeline-demo">
      <div className="pipeline-steps">
        {stages.map((s, i) => (
          <button
            key={s}
            className={stage === i ? "active" : ""}
            onClick={() => setStage(i)}
            aria-pressed={stage === i}
          >
            <span>
              {i === 0 ? (
                <Database size={16} />
              ) : i === 1 ? (
                <Layers3 size={16} />
              ) : i === 2 ? (
                <ShieldCheck size={16} />
              ) : (
                <Zap size={16} />
              )}
            </span>
            <small>{s}</small>
          </button>
        ))}
      </div>
      <p>
        <span className="status-dot" />
        {
          [
            "12 sources, one unified context",
            "Normalize incoming records",
            "Schema and policy checks ready",
            "Your pipeline is ready to launch",
          ][stage]
        }
        <span>0{stage + 1}/04</span>
      </p>
    </div>
  );
}
function Bento() {
  return (
    <section className="ecosystem-section page-container" id="platform">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span /> ONE CONNECTED ECOSYSTEM
          </p>
          <h2>
            Every moving part.
            <br />
            <span>One point of control.</span>
          </h2>
        </div>
        <p>
          From the first inference to your millionth agent.
          <br />
          The tools to make ambitious systems reliable.
        </p>
      </div>
      <div className="bento-grid">
        <article className="bento-card bento-observe">
          <div className="bento-intro">
            <span className="feature-icon">
              <Activity size={17} />
            </span>
            <span className="feature-tag">OBSERVABILITY</span>
            <Link
              href="/observability/"
              className="feature-link"
              aria-label="Explore observability"
            >
              <ArrowUpRight size={18} />
            </Link>
            <h3>
              See the signal.
              <br />
              Skip the noise.
            </h3>
            <p>
              Every token, trace, and millisecond.
              <br />A complete picture of your AI infrastructure.
            </p>
          </div>
          <MiniChart />
        </article>
        <article className="bento-card bento-agents">
          <div className="bento-intro">
            <span className="feature-icon violet">
              <Workflow size={17} />
            </span>
            <span className="feature-tag">AGENT ORCHESTRATION</span>
            <Link
              href="/workflows/"
              className="feature-link"
              aria-label="Explore workflow builder"
            >
              <ArrowUpRight size={18} />
            </Link>
            <h3>Complexity, coordinated.</h3>
            <p>
              Turn autonomous agents into a team
              <br />
              that moves with purpose.
            </p>
          </div>
          <div className="mini-workflow">
            <svg viewBox="0 0 500 160" aria-hidden="true">
              <path
                d="M100 80H175Q190 80 190 65V35Q190 25 210 25H280M190 80V125Q190 135 210 135H280M348 25H370Q390 25 390 45V80H445M348 135H370Q390 135 390 115V80"
                fill="none"
                stroke="#5b4e78"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
            </svg>
            <Link href="/workflows/" className="mini-node node-plan">
              <Command size={14} />
              <span>Planner</span>
              <i />
            </Link>
            <Link href="/workflows/" className="mini-node node-research">
              <Globe2 size={14} />
              <span>Research</span>
              <i />
            </Link>
            <Link href="/workflows/" className="mini-node node-review">
              <ShieldCheck size={14} />
              <span>Review</span>
              <i />
            </Link>
            <span className="node-end">
              <Check size={16} />
            </span>
          </div>
        </article>
        <article className="bento-card bento-api">
          <div className="bento-intro">
            <span className="feature-icon">
              <Terminal size={17} />
            </span>
            <span className="feature-tag">BUILT FOR BUILDERS</span>
            <Link
              href="/developers/"
              className="feature-link"
              aria-label="Explore developer workspace"
            >
              <ArrowUpRight size={18} />
            </Link>
            <h3>
              Powerful by default.
              <br />
              Simple by design.
            </h3>
            <p>One API. Your entire intelligence stack.</p>
          </div>
          <MiniTerminal />
        </article>
        <article className="bento-card bento-data">
          <div className="bento-intro">
            <span className="feature-icon">
              <Database size={17} />
            </span>
            <span className="feature-tag">DATA INTELLIGENCE</span>
            <Link
              href="/workflows/"
              className="feature-link"
              aria-label="Explore data pipelines"
            >
              <ArrowUpRight size={18} />
            </Link>
            <h3>Context is everything.</h3>
            <p>
              Bring your data into the flow. Connect, transform,
              <br />
              and validate with a pipeline you can trust.
            </p>
          </div>
          <Pipeline />
        </article>
        <article className="bento-card bento-security">
          <span className="security-emblem">
            <ShieldCheck size={27} />
          </span>
          <div>
            <span className="feature-tag">ENTERPRISE BY DESIGN</span>
            <h3>Trust is in the architecture.</h3>
            <p>
              Tenant-aware patterns. Configurable guardrails. Complete
              visibility.
            </p>
          </div>
          <Link href="/docs/#production" className="text-link">
            Explore the architecture <ArrowUpRight size={15} />
          </Link>
        </article>
      </div>
    </section>
  );
}
function CaseStudies() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className="cases-section page-container" id="solutions">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span /> REAL-WORLD POSSIBILITIES
          </p>
          <h2>
            Built for the next
            <br />
            <span>wave of intelligence.</span>
          </h2>
        </div>
        <p>
          Explore the architecture behind three industries.
          <br />
          <span className="small-muted">
            Illustrative scenarios. Example organizations and results.
          </span>
        </p>
      </div>
      <div className="case-grid">
        {cases.map((c, i) => (
          <article
            key={c.name}
            className={"case-card " + (active === i ? "case-open" : "")}
          >
            <div className="case-brand">
              {i === 0 ? (
                <Layers3 size={20} />
              ) : i === 1 ? (
                <Sparkles size={20} />
              ) : (
                <Globe2 size={20} />
              )}{" "}
              {c.name}
              <span>0{i + 1}</span>
            </div>
            <p className="feature-tag">{c.sector}</p>
            <div className="case-value">{c.value}</div>
            <p>{c.unit}</p>
            <button
              aria-expanded={active === i}
              aria-controls={"case-detail-" + i}
              onClick={() => setActive(active === i ? null : i)}
            >
              Explore the scenario{" "}
              {active === i ? <Minus size={16} /> : <Plus size={16} />}
            </button>
            <div
              id={"case-detail-" + i}
              hidden={active !== i}
              className="case-details"
            >
              <p>{c.text}</p>
              <div>
                <span>
                  Baseline<strong>{c.baseline}</strong>
                </span>
                <ArrowRight size={16} />
                <span>
                  Optimized<strong>{c.optimized}</strong>
                </span>
              </div>
              <small>{c.detail}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Home() {
  const reduce = useReducedMotion();
  const [tickerPaused, setTickerPaused] = useState(false);
  return (
    <>
      <section className="hero page-container">
        <div className="hero-copy">
          <motion.div
            initial={reduce ? false : { opacity: 1, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <Link href="/workflows/" className="release-pill">
              <span className="release-new">NEW</span> A new standard for agent
              orchestration <ArrowUpRight size={12} />
            </Link>
            <h1>
              Intelligence,
              <br />
              <span>under control.</span>
            </h1>
            <p className="hero-description">
              The unified control plane for your AI ecosystem.
              <br className="desktop-br" /> Orchestrate agents. Observe
              everything.
              <br className="desktop-br" /> Build what comes next.
            </p>
            <LeadCapture />
            <div className="hero-secondary">
              <Link href="/observability/">
                Explore the platform <ArrowUpRight size={14} />
              </Link>
              <span>Engineered for the ambitious.</span>
            </div>
          </motion.div>
        </div>
        <NetworkScene />
        <div className="hero-bottom">
          <span>THE INFRASTRUCTURE BEHIND INTELLIGENCE</span>
          <a href="#platform" aria-label="Scroll to platform features">
            <ArrowDown size={14} />
          </a>
          <span>
            <span className="status-dot" /> DESIGNED TO KEEP YOU AHEAD
          </span>
        </div>
      </section>
      <section className="logo-section">
        <div className="page-container">
          <div className="logo-caption">
            <span>YOUR NEXT CHAPTER. IN EXCEPTIONAL COMPANY.</span>
            <button
              className="text-button"
              onClick={() => setTickerPaused(!tickerPaused)}
            >
              {tickerPaused ? "Play" : "Pause"} ticker
            </button>
          </div>
          <div
            className={"logo-viewport " + (tickerPaused ? "ticker-paused" : "")}
          >
            <div className="logo-track">
              {[...logos, ...logos].map((logo, i) => (
                <span key={i} aria-hidden={i >= logos.length}>
                  {logo}
                </span>
              ))}
            </div>
          </div>
          <p className="logo-disclaimer">
            Illustrative enterprise identities · Ready for your customer stories
          </p>
        </div>
      </section>
      <Bento />
      <section className="architecture-band page-container">
        <div>
          <p className="eyebrow">
            <span /> BUILT TO GO FURTHER
          </p>
          <h2>
            Ambition has no ceiling.
            <br />
            Your infrastructure shouldn’t either.
          </h2>
          <p>
            Start with a single agent. Grow into a connected ecosystem.
            <br />
            Keep the same clarity, control, and confidence at every stage.
          </p>
          <Link className="text-link" href="/pricing/">
            Find your scale <ArrowRight size={15} />
          </Link>
        </div>
        <div className="architecture-stats">
          <div>
            <strong>01</strong>
            <span>Unified control plane</span>
          </div>
          <div>
            <strong>∞</strong>
            <span>Possibilities to build</span>
          </div>
          <div>
            <strong>
              100<span>%</span>
            </strong>
            <span>Your architecture</span>
          </div>
          <p>Modular components. Open integration points.</p>
        </div>
      </section>
      <CaseStudies />
      <section className="closing-cta page-container">
        <div className="cta-orbit" aria-hidden="true" />
        <p className="eyebrow">THE NEXT MOVE IS YOURS</p>
        <h2>
          Less friction.
          <br />
          <span>More possibility.</span>
        </h2>
        <p>Build your intelligence layer on a stronger foundation.</p>
        <div>
          <LeadDialog triggerLabel="Start building" />
          <Link className="button button-secondary" href="/pricing/#roi">
            Calculate your ROI <ArrowUpRight size={15} />
          </Link>
        </div>
        <span className="closing-note">
          <Check size={12} /> Explore freely <span>·</span> Designed to make it
          yours
        </span>
      </section>
    </>
  );
}
