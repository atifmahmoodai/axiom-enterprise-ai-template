"use client";
import { useRef, useState, useEffect, useId, type FormEvent } from "react";
import { ArrowRight, Check, X, Download } from "lucide-react";
type DialogProps = {
  triggerLabel: string;
  className?: string;
  intent?: string;
  initialEmail?: string;
};
function RequestDialog({
  dialogRef,
  intent,
  email,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  intent: string;
  email: string;
  onClose: () => void;
}) {
  const uniqueId = useId();
  const [sent, setSent] = useState(false);
  const [brief, setBrief] = useState<Record<string, string>>({});
  useEffect(() => {
    setSent(false);
  }, [email]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBrief({
      name: String(data.get("name")),
      email: String(data.get("email")),
      company: String(data.get("company")),
      interest: intent,
    });
    setSent(true);
  }
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          { ...brief, mode: "demo", createdAt: new Date().toISOString() },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "axiom-workspace-brief.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <dialog
      className="lead-dialog"
      aria-label={
        sent ? "Workspace brief created" : "Create your workspace brief"
      }
      ref={dialogRef}
      onClose={() => {
        setSent(false);
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.close();
      }}
    >
      <button
        className="dialog-close icon-button"
        aria-label="Close request dialog"
        onClick={() => dialogRef.current?.close()}
      >
        <X size={20} />
      </button>
      {sent ? (
        <div className="request-success">
          <div className="success-icon">
            <Check size={25} />
          </div>
          <p className="eyebrow">BRIEF CREATED</p>
          <h2>
            Your next chapter
            <br />
            starts here.
          </h2>
          <p>
            Your workspace brief is ready to review. This is a demo request; no
            information has been sent.
          </p>
          <button className="button button-primary" onClick={download}>
            Download your brief <Download size={15} />
          </button>
          <button
            className="text-button"
            onClick={() => dialogRef.current?.close()}
          >
            Back to exploring <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <p className="eyebrow">LET’S BUILD WHAT’S NEXT</p>
          <h2>
            A clear path
            <br />
            to production.
          </h2>
          <p>
            Tell us a little about your team to prepare your{" "}
            {intent === "enterprise" ? "enterprise solution" : "workspace"}{" "}
            brief.
          </p>
          <form onSubmit={submit}>
            <label htmlFor={uniqueId + "-name"}>
              Full name
              <input
                autoFocus
                id={uniqueId + "-name"}
                name="name"
                autoComplete="name"
                placeholder="Alex Morgan"
                required
                maxLength={100}
              />
            </label>
            <label htmlFor={uniqueId + "-company"}>
              Company
              <input
                id={uniqueId + "-company"}
                name="company"
                autoComplete="organization"
                placeholder="Your company"
                required
                maxLength={120}
              />
            </label>
            <label htmlFor={uniqueId + "-email"}>
              Work email
              <input
                id={uniqueId + "-email"}
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={email}
                placeholder="alex@company.com"
                required
                maxLength={254}
              />
            </label>
            <button className="button button-primary" type="submit">
              Create my brief <ArrowRight size={16} />
            </button>
            <p className="form-note">
              Interactive template preview. Your details stay in this session.
            </p>
          </form>
        </>
      )}
    </dialog>
  );
}
export function LeadDialog({
  triggerLabel,
  className = "button button-primary",
  intent = "workspace",
  initialEmail = "",
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className={className} onClick={() => dialog.current?.showModal()}>
        {triggerLabel}
        <ArrowUpRightIcon />
      </button>
      <RequestDialog
        dialogRef={dialog}
        intent={intent}
        email={initialEmail}
        onClose={() => {}}
      />
    </>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}
export function LeadCapture() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Enter a valid work email to continue.");
      return;
    }
    setError("");
    dialog.current?.showModal();
  }
  return (
    <>
      <form className="hero-lead" onSubmit={submit} noValidate>
        <label className="sr-only" htmlFor="hero-email">
          Work email
        </label>
        <div className={"email-field " + (error ? "has-error" : "")}>
          <input
            id="hero-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="Your work email"
            autoComplete="email"
            aria-invalid={!!error}
            aria-describedby={error ? "email-error" : "hero-email-note"}
            required
            maxLength={254}
          />
          {valid && <Check className="email-valid" size={16} />}
          <button type="submit">
            Get started <ArrowRight size={15} />
          </button>
        </div>
        {error ? (
          <p id="email-error" className="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p id="hero-email-note" className="hero-form-note">
            <Check size={12} /> No credit card required <span>·</span> Explore
            in minutes
          </p>
        )}
      </form>
      <RequestDialog
        dialogRef={dialog}
        intent="workspace"
        email={email}
        onClose={() => {}}
      />
    </>
  );
}
