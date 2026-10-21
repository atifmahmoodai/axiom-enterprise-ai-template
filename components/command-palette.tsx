"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Command,
  Layers3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import "./command-palette.css";

type Destination = {
  label: string;
  description: string;
  keywords: string;
  href: string;
  icon: LucideIcon;
};

const destinations: Destination[] = [
  {
    label: "Platform overview",
    description: "Your connected intelligence ecosystem",
    keywords: "home network agents dashboard",
    href: "/",
    icon: Layers3,
  },
  {
    label: "Live observability",
    description: "Latency, throughput, and model drift",
    keywords: "analytics metrics charts tokens monitor bias",
    href: "/observability/",
    icon: Activity,
  },
  {
    label: "Workflow builder",
    description: "Compose and simulate agent networks",
    keywords: "canvas nodes connections automate templates",
    href: "/workflows/",
    icon: Workflow,
  },
  {
    label: "Developer workspace",
    description: "Explore the API and manage demo keys",
    keywords: "code python curl go node terminal key",
    href: "/developers/",
    icon: Terminal,
  },
  {
    label: "Plans & pricing",
    description: "Find the right foundation for your scale",
    keywords: "billing monthly annual enterprise sla",
    href: "/pricing/",
    icon: Layers3,
  },
  {
    label: "ROI calculator",
    description: "Model your infrastructure economics",
    keywords: "savings costs estimates volume agents",
    href: "/pricing/#roi",
    icon: Calculator,
  },
  {
    label: "Documentation",
    description: "Start building with the developer kit",
    keywords: "docs help onboarding guide quick start",
    href: "/docs/",
    icon: BookOpen,
  },
  {
    label: "Architecture guide",
    description: "Tenant isolation and production boundaries",
    keywords: "security auth rls database deployment",
    href: "/docs/#production",
    icon: ShieldCheck,
  },
  {
    label: "Template configuration",
    description: "Make the platform your own",
    keywords: "brand theme tokens navigation customize",
    href: "/docs/#configuration",
    icon: SlidersHorizontal,
  },
];

export function CommandPalette() {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = destinations.filter((item) => {
    const searchable =
      `${item.label} ${item.description} ${item.keywords}`.toLowerCase();
    return searchTerms.every((term) => searchable.includes(term));
  });
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const open = useCallback(() => {
    if (dialog.current?.open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
    dialog.current?.showModal();
    input.current?.focus();
  }, []);

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, [open]);

  useEffect(() => {
    if (!isOpen) return;
    document
      .getElementById(`${id}-result-${safeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, id, isOpen, query]);

  function navigate(destination: Destination) {
    dialog.current?.close();
    router.push(destination.href);
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeIndex + delta + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[safeIndex]) navigate(results[safeIndex]);
    }
  }

  return (
    <>
      <button
        className="command-trigger"
        aria-label="Search ⌘ K"
        aria-haspopup="dialog"
        onClick={open}
      >
        <Search size={14} aria-hidden="true" />
        <span>Search ⌘ K</span>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setIsOpen(false);
          previousFocus.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <h2 id={`${id}-title`} className="sr-only">
          Search the Axiom platform
        </h2>
        <div className="command-search">
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor={`${id}-query`}>
            Search pages and tools
          </label>
          <input
            ref={input}
            id={`${id}-query`}
            type="search"
            role="combobox"
            autoComplete="off"
            autoFocus
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeys}
            placeholder="Where would you like to go?"
            aria-expanded={isOpen}
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={
              results.length ? `${id}-result-${safeIndex}` : undefined
            }
            aria-describedby={`${id}-instructions`}
          />
          <button
            className="command-close"
            aria-label="Close search"
            onClick={() => dialog.current?.close()}
          >
            <X size={17} />
          </button>
        </div>
        <div className="command-results-heading">
          <span>
            {query.trim() ? "SEARCH RESULTS" : "EXPLORE YOUR PLATFORM"}
          </span>
          <span aria-live="polite">
            {results.length}{" "}
            {results.length === 1 ? "destination" : "destinations"}
          </span>
        </div>
        <div
          className="command-results"
          id={`${id}-results`}
          role="listbox"
          aria-label="Pages and tools"
        >
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.href}
                id={`${id}-result-${index}`}
                className={`command-result ${index === safeIndex ? "command-result-active" : ""}`}
                role="option"
                aria-selected={index === safeIndex}
                onPointerMove={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigate(item)}
              >
                <span className="command-result-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="command-result-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </div>
            );
          })}
        </div>
        {results.length === 0 && (
          <div className="command-empty" role="status">
            <Search size={24} aria-hidden="true" />
            <strong>No matching destinations</strong>
            <p>Try “workflow”, “API”, or “ROI”.</p>
          </div>
        )}
        <div className="command-footer" id={`${id}-instructions`}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate <kbd>↵</kbd> Open
          </span>
          <span>
            <Command size={11} aria-hidden="true" /> Axiom <kbd>esc</kbd> Close
          </span>
        </div>
      </dialog>
    </>
  );
}
