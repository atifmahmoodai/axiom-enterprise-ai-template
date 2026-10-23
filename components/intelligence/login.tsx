"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Command, ShieldCheck } from "lucide-react";
import { api } from "./ui";
import "./intelligence.css";
export function LoginForm({ demo, oidc }: { demo: boolean; oidc: boolean }) {
  const [userId, setUser] = useState("demo-owner"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ redirect: string }>("/api/auth/demo", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      location.href = r.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  };
  return (
    <div className="ios-login">
      <Link href="/" className="ios-brand">
        <span className="ios-brand-mark">
          <Command size={20} />
        </span>
        axiom<span className="ios-brand-os">INTELLIGENCE OS</span>
      </Link>
      <div className="ios-login-grid">
        <section>
          <span className="ios-eyebrow">THE INTELLIGENCE LAYER</span>
          <h1>
            See the signal.
            <br />
            <em>Make the decision.</em>
          </h1>
          <p>
            One workspace for your data, your analysis, and the evidence behind
            every answer.
          </p>
          <div className="ios-login-proof">
            <ShieldCheck size={20} />
            <span>
              Workspace permissions enforced on the server
              <br />
              <small>Versioned data. Reproducible calculations.</small>
            </span>
          </div>
        </section>
        <section className="ios-login-card">
          <span className="ios-eyebrow">WELCOME TO AXIOM</span>
          <h2>Enter your workspace</h2>
          <p>Connect the questions that matter to the data you trust.</p>
          {demo && (
            <>
              <label className="ios-field">
                Reference account
                <select
                  value={userId}
                  onChange={(e) => setUser(e.target.value)}
                >
                  <option value="demo-owner">
                    Alex Morgan · Owner · All workspaces
                  </option>
                  <option value="demo-analyst">
                    Sam Chen · Analyst · Atlas
                  </option>
                  <option value="demo-viewer">
                    Taylor Reed · Viewer · Atlas
                  </option>
                  <option value="demo-helix">
                    Jordan Bell · Analyst · Helix
                  </option>
                </select>
              </label>
              <button
                className="ios-button primary"
                onClick={login}
                disabled={busy}
              >
                {busy ? "Opening workspace…" : "Explore reference workspace"}
                <ArrowRight size={16} />
              </button>
              <div className="ios-login-note">
                Local demo sign-in uses real server sessions and seeded
                accounts. Disable it before exposing this environment to
                customers.
              </div>
            </>
          )}
          {oidc && (
            <a className="ios-button" href="/api/auth/login">
              Sign in with your organization
              <ArrowRight size={16} />
            </a>
          )}
          {!demo && !oidc && (
            <p role="alert">
              Your administrator needs to configure an identity provider.
            </p>
          )}
          {error && (
            <p className="ios-warning" role="alert">
              {error}
            </p>
          )}
          <div className="ios-login-footer">
            Your workspace. Your evidence. Your advantage.
          </div>
        </section>
      </div>
      <footer>
        AXIOM INTELLIGENCE OS <span>Data with direction.</span>
      </footer>
    </div>
  );
}
