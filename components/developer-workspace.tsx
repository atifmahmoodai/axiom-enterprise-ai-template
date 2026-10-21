"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Play,
  Plus,
  Radio,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useWorkspace } from "@/components/workspace-provider";
import type { TenantId } from "@/lib/config";
import "./operations.css";

type Language = "Python" | "cURL" | "Go" | "Node.js";
type DemoKey = {
  id: string;
  name: string;
  value: string;
  scope: "Inference only" | "Read only";
  created: string;
  revoked: boolean;
};
type ConsoleTab = "Response" | "Event log";
type ResponseData = {
  id: string;
  object: string;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata: {
    mode: string;
    workspace: string;
    region: string;
    latency_ms: number;
  };
};
const languages: Language[] = ["Python", "cURL", "Go", "Node.js"];
const models = [
  {
    id: "axiom-reasoning-v4",
    label: "Reasoning v4",
    description: "Complex reasoning",
    latency: 248,
  },
  {
    id: "axiom-fast-v2",
    label: "Fast v2",
    description: "Low latency",
    latency: 89,
  },
  {
    id: "axiom-code-v3",
    label: "Code v3",
    description: "Code generation",
    latency: 172,
  },
];

function generateSnippet(
  language: Language,
  model: string,
  prompt: string,
  temperature: number,
) {
  const content = JSON.stringify(prompt);
  const payload = JSON.stringify(
    { model, messages: [{ role: "user", content: prompt }], temperature },
    null,
    2,
  );
  if (language === "Python")
    return `from openai import OpenAI\nimport os\n\nclient = OpenAI(\n    base_url="https://api.example.com/v1",\n    api_key=os.environ["AXIOM_API_KEY"],\n)\n\nresponse = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": ${content}}],\n    temperature=${temperature.toFixed(1)},\n)\n\nprint(response.choices[0].message.content)`;
  if (language === "cURL")
    return `curl https://api.example.com/v1/chat/completions \\\n  -H "Authorization: Bearer $AXIOM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data-binary @- <<'JSON'\n${payload}\nJSON`;
  if (language === "Go")
    return `package main\n\nimport (\n    "bytes"\n    "encoding/json"\n    "io"\n    "net/http"\n    "os"\n    "time"\n)\n\nfunc main() {\n    payload := map[string]any{\n        "model": "${model}",\n        "messages": []map[string]string{{\n            "role": "user", "content": ${content},\n        }},\n        "temperature": ${temperature.toFixed(1)},\n    }\n    body, err := json.Marshal(payload)\n    if err != nil { panic(err) }\n    req, err := http.NewRequest("POST",\n        "https://api.example.com/v1/chat/completions",\n        bytes.NewReader(body))\n    if err != nil { panic(err) }\n    req.Header.Set("Authorization", "Bearer " + os.Getenv("AXIOM_API_KEY"))\n    req.Header.Set("Content-Type", "application/json")\n    client := &http.Client{Timeout: 30 * time.Second}\n    resp, err := client.Do(req)\n    if err != nil { panic(err) }\n    defer resp.Body.Close()\n    io.Copy(os.Stdout, resp.Body)\n}`;
  return `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "https://api.example.com/v1",\n  apiKey: process.env.AXIOM_API_KEY,\n});\n\nconst response = await client.chat.completions.create({\n  model: "${model}",\n  messages: [{ role: "user", content: ${content} }],\n  temperature: ${temperature.toFixed(1)},\n});\n\nconsole.log(response.choices[0].message.content);`;
}

function isDemoKey(value: unknown): value is DemoKey {
  if (!value || typeof value !== "object") return false;
  const key = value as Record<string, unknown>;
  return (
    typeof key.id === "string" &&
    typeof key.name === "string" &&
    typeof key.value === "string" &&
    key.value.startsWith("demo_") &&
    (key.scope === "Inference only" || key.scope === "Read only") &&
    typeof key.created === "string" &&
    typeof key.revoked === "boolean"
  );
}

export function DeveloperWorkspace() {
  const { tenantId } = useWorkspace();
  return <Workspace key={tenantId} tenantId={tenantId} />;
}

function Workspace({ tenantId }: { tenantId: TenantId }) {
  const [language, setLanguage] = useState<Language>("Python");
  const [modelId, setModelId] = useState(models[0].id);
  const [prompt, setPrompt] = useState(
    "Design a resilient architecture for a network of autonomous research agents.",
  );
  const [temperature, setTemperature] = useState(0.7);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("Response");
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  const [keys, setKeys] = useState<DemoKey[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [revokeKey, setRevokeKey] = useState<DemoKey | null>(null);
  const [requests, setRequests] = useState(0);
  const keyDialog = useRef<HTMLDialogElement>(null);
  const revokeDialog = useRef<HTMLDialogElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduceMotion = useReducedMotion();
  const model = models.find((item) => item.id === modelId)!;
  const snippet = generateSnippet(language, modelId, prompt, temperature);
  const activeKeys = keys.filter((key) => !key.revoked);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`axiom:keys:${tenantId}`);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setKeys(parsed.filter(isDemoKey));
      }
    } catch {
      setNotice(
        "Browser storage is unavailable. Demo keys will remain in this session.",
      );
    }
    setLoaded(true);
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, [tenantId]);

  function saveKeys(next: DemoKey[]) {
    setKeys(next);
    try {
      localStorage.setItem(`axiom:keys:${tenantId}`, JSON.stringify(next));
    } catch {
      setNotice(
        "Browser storage is unavailable. Your changes are held in this session.",
      );
    }
  }

  async function copy(value: string, target: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      timers.current.push(setTimeout(() => setCopied(""), 2200));
    } catch {
      setNotice(
        "Clipboard access is unavailable. Select and copy the displayed text.",
      );
    }
  }

  function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const key: DemoKey = {
      id,
      name,
      value: `demo_${tenantId}_${id.replaceAll("-", "").slice(0, 24)}`,
      scope:
        values.get("scope") === "Read only" ? "Read only" : "Inference only",
      created: new Date().toISOString().slice(0, 10),
      revoked: false,
    };
    saveKeys([...keys, key]);
    setNotice(`Demo key “${name}” created for ${tenantId}.`);
    keyDialog.current?.close();
    form.reset();
  }

  function runRequest() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResponse(null);
    setLogs(["00.000  Initializing local request simulation"]);
    setNotice("");
    const inputTokens = Math.max(1, Math.ceil(prompt.length / 4));
    const answer =
      modelId === "axiom-code-v3"
        ? "async function orchestrate(task) {\n  const plan = await planner.run(task);\n  const results = await Promise.allSettled(plan.map(runAgent));\n  return verifier.validate(results);\n}\n\nAdd bounded retries, per-agent budgets, and human approval gates before production execution."
        : modelId === "axiom-fast-v2"
          ? "Use a coordinator with a durable task queue, scoped worker agents, and an independent verification layer. Isolate tools, limit token budgets, and checkpoint every state transition."
          : "Use a three-layer architecture: a planning coordinator, independently scoped worker agents, and a verification layer. Persist task state in a durable queue; apply per-agent token budgets, bounded retries, and circuit breakers. Route sensitive actions through human approval. Trace every tool call and evaluate outputs before committing results.";
    const outputTokens = Math.ceil(answer.length / 4);
    const data: ResponseData = {
      id: `demo_${crypto.randomUUID().slice(0, 8)}`,
      object: "chat.completion",
      model: modelId,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: answer },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      metadata: {
        mode: "local simulation · canned response",
        workspace: tenantId,
        region: tenantId === "atlas" ? "us-east-1" : "eu-west-1",
        latency_ms: model.latency,
      },
    };
    timers.current.push(
      setTimeout(
        () =>
          setLogs((prev) => [
            ...prev,
            "00.180  Workspace scope validated",
            `00.240  Routing → ${modelId}`,
          ]),
        300,
      ),
    );
    timers.current.push(
      setTimeout(
        () =>
          setLogs((prev) => [
            ...prev,
            "00.480  Generating illustrative completion",
            "00.620  Applying demo policy checks",
          ]),
        650,
      ),
    );
    timers.current.push(
      setTimeout(() => {
        setResponse(data);
        setRunning(false);
        setRequests((value) => value + 1);
        setLogs((prev) => [
          ...prev,
          `00.900  200 OK · ${inputTokens + outputTokens} estimated tokens`,
          "00.901  Complete. No external request was made.",
        ]);
      }, 950),
    );
  }

  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? languages.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + languages.length) %
            languages.length;
    setLanguage(languages[next]);
    document.getElementById(`language-${next}`)?.focus();
  }

  return (
    <div className="page-container ops-page dev-page">
      <div className="ops-breadcrumb">
        WORKSPACE <span>/</span> DEVELOPERS
      </div>
      <div className="ops-page-heading">
        <div>
          <div className="eyebrow ops-eyebrow">
            <Code2 size={13} /> BUILT FOR BUILDERS
          </div>
          <h1>
            Your next idea. One API<span>.</span>
          </h1>
          <p className="muted">A direct line from possibility to production.</p>
        </div>
        <a className="button button-secondary" href="/docs/#configuration">
          Read the docs <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="ops-toolbar">
        <div className="ops-demo-badge">
          <Radio size={13} /> LOCAL PLAYGROUND <span>·</span>{" "}
          {tenantId === "atlas" ? "Atlas" : "Helix"} workspace
        </div>
        <span className="dev-api-status">
          <span className="ops-status-dot" /> OpenAI-compatible interface
        </span>
      </div>

      <div className="dev-top-metrics">
        <div>
          <Fingerprint size={16} />
          <span>Workspace isolation</span>
          <strong>
            {tenantId === "atlas" ? "US East · 01" : "EU West · 01"}
          </strong>
        </div>
        <div>
          <KeyRound size={16} />
          <span>Active demo keys</span>
          <strong>{String(activeKeys.length).padStart(2, "0")}</strong>
        </div>
        <div>
          <Zap size={16} />
          <span>Session requests</span>
          <strong>{String(requests).padStart(2, "0")}</strong>
        </div>
      </div>

      <motion.section
        className="panel dev-playground"
        aria-labelledby="playground-title"
        initial={reduceMotion ? false : { opacity: 1, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="dev-section-heading">
          <div>
            <h2 id="playground-title">
              <Terminal size={18} /> API playground
            </h2>
            <p>Configure. Run. Inspect. All in one place.</p>
          </div>
          <span className="dev-version">
            API v1.0 <span>STABLE</span>
          </span>
        </div>
        <div className="dev-playground-layout">
          <aside className="dev-config" aria-label="Request configuration">
            <div className="dev-config-label">
              <span>01</span> CONFIGURATION
            </div>
            <label htmlFor="dev-model">
              Model
              <select
                id="dev-model"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                disabled={running}
              >
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="dev-model-detail">
              <span className="ops-status-dot" /> {model.description}
              <span>{model.latency} ms*</span>
            </div>
            <label htmlFor="dev-prompt">
              Message <span className="dev-label-meta">USER</span>
              <textarea
                id="dev-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                maxLength={1200}
                disabled={running}
                placeholder="Describe what you want to build…"
              />
            </label>
            <span className="dev-counter">{prompt.length} / 1,200</span>
            <label htmlFor="dev-temperature" className="dev-temperature-label">
              Temperature{" "}
              <output htmlFor="dev-temperature">
                {temperature.toFixed(1)}
              </output>
              <input
                id="dev-temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                disabled={running}
              />
            </label>
            <div className="dev-range-labels">
              <span>Precise</span>
              <span>Creative</span>
            </div>
            <button
              className="button button-primary dev-run"
              onClick={runRequest}
              disabled={!prompt.trim() || running}
            >
              {running ? (
                <LoaderCircle size={15} className="dev-spinner" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              {running ? "Running simulation…" : "Run request"}
              {!running && <ArrowRight size={15} />}
            </button>
            <p className="dev-config-note">
              <LockKeyhole size={12} /> Runs locally. No API key required.
              <br />
              <span>*Illustrative latency · responses are canned.</span>
            </p>
          </aside>
          <div className="dev-code-panel">
            <div className="dev-code-tabs">
              <div role="tablist" aria-label="Code language">
                {languages.map((item, index) => (
                  <button
                    key={item}
                    id={`language-${index}`}
                    role="tab"
                    aria-selected={language === item}
                    aria-controls="dev-code-content"
                    tabIndex={language === item ? 0 : -1}
                    onKeyDown={(event) => tabKeys(event, index)}
                    onClick={() => setLanguage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                className="dev-copy"
                onClick={() => copy(snippet, "code")}
                aria-label={copied === "code" ? "Code copied" : "Copy code"}
              >
                {copied === "code" ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied === "code" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="dev-file-line">
              <span className="dev-file-dot" />
              <span>
                {language === "Python"
                  ? "quickstart.py"
                  : language === "Node.js"
                    ? "quickstart.ts"
                    : language === "Go"
                      ? "main.go"
                      : "request.sh"}
              </span>
              <span>EXAMPLE ENDPOINT</span>
            </div>
            <div
              id="dev-code-content"
              className="dev-code-content"
              role="tabpanel"
              aria-labelledby={`language-${languages.indexOf(language)}`}
              tabIndex={0}
            >
              <pre>
                <code>
                  {snippet.split("\n").map((line, index) => (
                    <span className="dev-code-line" key={index}>
                      <span className="dev-line-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span
                        className={
                          line.startsWith("import") ||
                          line.startsWith("from") ||
                          line.startsWith("package")
                            ? "dev-code-keyword"
                            : line.trim().startsWith("//") ||
                                line.trim().startsWith("#")
                              ? "dev-code-comment"
                              : line.includes("model") ||
                                  line.includes("https:")
                                ? "dev-code-accent"
                                : ""
                        }
                      >
                        {line || " "}
                      </span>
                    </span>
                  ))}
                </code>
              </pre>
            </div>
            <div className="dev-editor-status">
              <span>
                <CheckCheck size={12} /> Environment variable authentication
              </span>
              <span>
                UTF-8 <span>·</span> {language}
              </span>
            </div>
          </div>
        </div>
        <div className="dev-console">
          <div className="dev-console-head">
            <div
              className="dev-console-tabs"
              role="group"
              aria-label="Console view"
            >
              {(["Response", "Event log"] as ConsoleTab[]).map((tab) => (
                <button
                  key={tab}
                  aria-pressed={consoleTab === tab}
                  className={consoleTab === tab ? "is-active" : ""}
                  onClick={() => setConsoleTab(tab)}
                >
                  {tab === "Response" ? (
                    <Code2 size={14} />
                  ) : (
                    <Terminal size={14} />
                  )}
                  {tab}
                  {tab === "Event log" && logs.length > 0 && (
                    <span>{logs.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div>
              {running ? (
                <span className="dev-console-status">
                  <LoaderCircle size={12} className="dev-spinner" /> Processing
                </span>
              ) : response ? (
                <span className="dev-console-status">
                  <span className="ops-status-dot" /> 200 OK{" "}
                  <span className="dev-response-time">
                    {response.metadata.latency_ms} ms*
                  </span>
                </span>
              ) : (
                <span className="dev-console-idle">Awaiting request</span>
              )}
              {response && (
                <button
                  className="dev-copy"
                  aria-label="Copy response JSON"
                  onClick={() =>
                    copy(JSON.stringify(response, null, 2), "response")
                  }
                >
                  {copied === "response" ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="dev-console-body" aria-busy={running}>
            {consoleTab === "Event log" ? (
              logs.length ? (
                <ol className="dev-event-log">
                  {logs.map((log, index) => (
                    <li key={index}>
                      <ChevronRight size={11} />
                      <code>{log}</code>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="dev-empty-console">
                  <Terminal size={21} />
                  <p>Your request journey, one event at a time.</p>
                  <span>Run a request to start the local event stream.</span>
                </div>
              )
            ) : response ? (
              <div className="dev-response-layout">
                <div>
                  <div className="dev-response-label">
                    <span className="dev-assistant-mark">a.</span> ASSISTANT{" "}
                    <span>{response.model}</span>
                  </div>
                  <p className="dev-response-text">
                    {response.choices[0].message.content}
                  </p>
                  <details className="dev-json">
                    <summary>
                      Inspect JSON response <ChevronRight size={12} />
                    </summary>
                    <pre tabIndex={0}>{JSON.stringify(response, null, 2)}</pre>
                  </details>
                </div>
                <div className="dev-response-stats">
                  <span>REQUEST USAGE</span>
                  <dl>
                    <div>
                      <dt>Input tokens</dt>
                      <dd>{response.usage.prompt_tokens}</dd>
                    </div>
                    <div>
                      <dt>Output tokens</dt>
                      <dd>{response.usage.completion_tokens}</dd>
                    </div>
                    <div>
                      <dt>Total tokens</dt>
                      <dd>{response.usage.total_tokens}</dd>
                    </div>
                    <div>
                      <dt>Est. cost</dt>
                      <dd>
                        ${(response.usage.total_tokens * 0.000005).toFixed(5)}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Token counts and costs are estimates for this simulation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="dev-empty-console">
                {running ? (
                  <LoaderCircle size={24} className="dev-spinner" />
                ) : (
                  <Terminal size={24} />
                )}
                <p>
                  {running
                    ? "Orchestrating your first response…"
                    : "Great things start with a single request."}
                </p>
                <span>
                  {running
                    ? "Running the local simulation."
                    : "Configure your model, then press Run request."}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <section className="panel dev-key-section" aria-labelledby="keys-title">
        <div className="dev-section-heading">
          <div>
            <h2 id="keys-title">
              <KeyRound size={18} /> Workspace keys
            </h2>
            <p>Scoped access. Clear ownership. Complete control.</p>
          </div>
          <button
            className="button button-secondary"
            disabled={!loaded || activeKeys.length >= 10}
            onClick={() => keyDialog.current?.showModal()}
          >
            <Plus size={15} /> Create demo key
          </button>
        </div>
        <div className="dev-key-info">
          <ShieldCheck size={14} />
          <span>
            Demo credentials are stored in this browser, scoped to {tenantId}.
            They cannot authenticate against a real service.
          </span>
          <span>{activeKeys.length}/10 active</span>
        </div>
        {keys.length ? (
          <div className="ops-table-wrap dev-key-table">
            <table>
              <caption className="sr-only">
                Demo API keys for {tenantId} workspace
              </caption>
              <thead>
                <tr>
                  <th scope="col">NAME / KEY</th>
                  <th scope="col">PERMISSION</th>
                  <th scope="col">CREATED</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className={key.revoked ? "dev-key-revoked" : ""}
                  >
                    <th scope="row">
                      <strong>
                        <span className="dev-key-icon">
                          <KeyRound size={13} />
                        </span>
                        {key.name}
                      </strong>
                      <code>
                        {revealed.includes(key.id) && !key.revoked
                          ? key.value
                          : `demo_${tenantId}_••••••••${key.value.slice(-4)}`}
                      </code>
                    </th>
                    <td>
                      <span className="dev-scope">
                        <LockKeyhole size={11} />
                        {key.scope}
                      </span>
                    </td>
                    <td>{key.created}</td>
                    <td>
                      <span
                        className={`dev-key-state ${key.revoked ? "revoked" : ""}`}
                      >
                        <span />
                        {key.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="dev-key-actions">
                        <button
                          disabled={key.revoked}
                          className="dev-icon-button"
                          aria-label={`${revealed.includes(key.id) ? "Hide" : "Reveal"} ${key.name} key`}
                          onClick={() =>
                            setRevealed((old) =>
                              old.includes(key.id)
                                ? old.filter((id) => id !== key.id)
                                : [...old, key.id],
                            )
                          }
                        >
                          {revealed.includes(key.id) ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                        <button
                          disabled={key.revoked}
                          className="dev-icon-button"
                          aria-label={`Copy ${key.name} key`}
                          onClick={() => copy(key.value, key.id)}
                        >
                          {copied === key.id ? (
                            <Check size={15} />
                          ) : (
                            <Copy size={15} />
                          )}
                        </button>
                        <button
                          disabled={key.revoked}
                          className="dev-icon-button dev-revoke-button"
                          aria-label={`Revoke ${key.name} key`}
                          onClick={() => {
                            setRevokeKey(key);
                            revokeDialog.current?.showModal();
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dev-empty-keys">
            <div>
              <KeyRound size={24} />
            </div>
            <h3>Every connection starts with trust.</h3>
            <p>Create your first demo key to explore access controls.</p>
            <button
              className="dev-text-action"
              onClick={() => keyDialog.current?.showModal()}
              disabled={!loaded}
            >
              Create a demo key <ArrowRight size={14} />
            </button>
          </div>
        )}
        <div className="dev-key-footer">
          <LockKeyhole size={12} /> Need production credentials? Connect your
          identity and secrets provider.
          <a href="/docs/#production">
            Integration guide <ArrowUpRight size={12} />
          </a>
        </div>
      </section>
      <div className="dev-resource-grid">
        <a href="/docs/#configuration">
          <span className="dev-resource-icon">
            <Code2 size={20} />
          </span>
          <div>
            <h3>Your stack. Our starting point.</h3>
            <p>Typed integration boundaries & adapter contracts</p>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a href="/workflows/">
          <span className="dev-resource-icon violet">
            <Zap size={20} />
          </span>
          <div>
            <h3>Go from endpoints to outcomes.</h3>
            <p>Compose your first autonomous agent workflow</p>
          </div>
          <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="dev-live-notice" role="status" aria-live="polite">
        {notice || (copied ? "Copied to clipboard." : "")}
      </div>

      <dialog
        ref={keyDialog}
        className="dev-dialog"
        aria-labelledby="create-key-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) keyDialog.current?.close();
        }}
      >
        <button
          className="dev-dialog-close dev-icon-button"
          aria-label="Close key dialog"
          onClick={() => keyDialog.current?.close()}
        >
          <X size={19} />
        </button>
        <div className="dev-dialog-symbol">
          <KeyRound size={25} />
        </div>
        <p className="eyebrow">SCOPED TO {tenantId.toUpperCase()}</p>
        <h2 id="create-key-title">A key to what comes next.</h2>
        <p>
          Create a browser-local demo credential. This key does not access any
          real API.
        </p>
        <form onSubmit={createKey}>
          <label htmlFor="key-name">
            Key name
            <input
              id="key-name"
              name="name"
              placeholder="e.g. Production research agent"
              required
              maxLength={60}
              pattern=".*\S.*"
              autoFocus
            />
          </label>
          <label htmlFor="key-scope">
            Permission
            <select id="key-scope" name="scope">
              <option>Inference only</option>
              <option>Read only</option>
            </select>
          </label>
          <button type="submit" className="button button-primary">
            <Plus size={15} />
            Create demo key
          </button>
        </form>
      </dialog>
      <dialog
        ref={revokeDialog}
        className="dev-dialog"
        aria-labelledby="revoke-key-title"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            revokeDialog.current?.close();
        }}
      >
        <button
          className="dev-dialog-close dev-icon-button"
          aria-label="Close revoke dialog"
          onClick={() => revokeDialog.current?.close()}
        >
          <X size={19} />
        </button>
        <div className="dev-dialog-symbol">
          <ShieldCheck size={25} />
        </div>
        <h2 id="revoke-key-title">Revoke this demo key?</h2>
        <p>
          “{revokeKey?.name}” will be marked revoked in this workspace. You can
          create a new demo key at any time.
        </p>
        <div className="dev-dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => revokeDialog.current?.close()}
          >
            Keep key
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              if (revokeKey) {
                saveKeys(
                  keys.map((key) =>
                    key.id === revokeKey.id ? { ...key, revoked: true } : key,
                  ),
                );
                setNotice(`Demo key “${revokeKey.name}” revoked.`);
                setRevealed((old) => old.filter((id) => id !== revokeKey.id));
              }
              revokeDialog.current?.close();
            }}
          >
            Revoke demo key
          </button>
        </div>
      </dialog>
    </div>
  );
}
