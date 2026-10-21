"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, Maximize2, Activity, Box } from "lucide-react";
import { BrandMark } from "./brand";
const clusters = [
  {
    name: "Orchestrator",
    role: "Routes tasks across the network",
    latency: 12,
    load: 68,
  },
  {
    name: "Research agent",
    role: "Retrieval and knowledge synthesis",
    latency: 24,
    load: 42,
  },
  {
    name: "Reasoning model",
    role: "Planning and structured inference",
    latency: 18,
    load: 76,
  },
  {
    name: "Guardrail agent",
    role: "Policy checks and output validation",
    latency: 8,
    load: 21,
  },
];
export function NetworkScene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let time = 0;
    let visible = true;
    let width = 640,
      height = 520;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      width = box.width;
      height = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    observer.observe(el);
    const intersection = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
    });
    intersection.observe(el);
    const points = Array.from({ length: 92 }, (_, i) => {
      const y = 1 - (i / 91) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = i * 2.399963;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
    });
    function draw() {
      if (!ctx) return;
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (!paused && !reduce) time += 0.0017;
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.51,
        cy = height * 0.48,
        r = Math.min(width * 0.34, height * 0.36);
      const a = time + pointer.current.x * 0.22;
      const tilt = 0.23 + pointer.current.y * 0.18;
      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, r * 1.3);
      glow.addColorStop(0, "rgba(70,180,140,.09)");
      glow.addColorStop(0.65, "rgba(70,180,140,.03)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      const projected = points.map((p) => {
        const x = p.x * Math.cos(a) - p.z * Math.sin(a),
          z = p.x * Math.sin(a) + p.z * Math.cos(a);
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
        const depth = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const scale = 2.7 / (2.7 - depth * 0.28);
        return { x: cx + x * r * scale, y: cy + y * r * scale, z: depth };
      });
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
          const p = points[i],
            q = points[j],
            dist = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
          if (dist < 0.23) {
            const alpha = (projected[i].z + projected[j].z + 2) / 4;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = `rgba(150,239,202,${0.035 + alpha * 0.19})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.36);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          r * (1.23 + k * 0.075),
          r * (0.35 + k * 0.038),
          0,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle =
          k === 0 ? "rgba(157,245,206,.23)" : "rgba(157,245,206,.065)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      ctx.restore();
      projected
        .sort((a, b) => a.z - b.z)
        .forEach((p, i) => {
          const strength = (p.z + 1) / 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, i % 13 === 0 ? 2.6 : 1.25, 0, Math.PI * 2);
          ctx.fillStyle =
            i % 13 === 0
              ? `rgba(173,255,217,${0.5 + strength * 0.5})`
              : `rgba(141,201,180,${0.15 + strength * 0.5})`;
          if (i % 13 === 0) {
            ctx.shadowColor = "#94ffca";
            ctx.shadowBlur = 12;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      if (!paused && !reduce) {
        const orbit = time * 4;
        const x = cx + Math.cos(orbit) * r * 1.25,
          y = cy + Math.sin(orbit) * r * 0.39;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.shadowColor = "#abffdb";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#b9ffdf";
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
    };
  }, [paused, reduce, expanded]);
  const current = clusters[selected];
  return (
    <motion.div
      ref={ref}
      className={"network-scene " + (expanded ? "scene-expanded" : "")}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      onPointerMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: (e.clientX - b.left) / b.width - 0.5,
          y: (e.clientY - b.top) / b.height - 0.5,
        };
      }}
      onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
      }}
    >
      <div className="scene-topline">
        <span>
          <span className="status-dot" /> NETWORK VISUALIZATION
        </span>
        <span>
          us-east-1 <span className="slash">/</span> DEMO
        </span>
      </div>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="scene-cross cross-tl">+</div>
      <div className="scene-cross cross-tr">+</div>
      <div className="scene-cross cross-bl">+</div>
      <div className="scene-cross cross-br">+</div>
      <button
        className={
          "graph-card graph-core " + (selected === 0 ? "graph-selected" : "")
        }
        onClick={() => setSelected(0)}
        aria-pressed={selected === 0}
      >
        <span className="core-logo">
          <BrandMark size={27} />
        </span>
        <span>
          <strong>AXIOM CORE</strong>
          <small>Orchestration layer</small>
        </span>
        <span className="status-dot" />
      </button>
      <button
        className={
          "graph-card graph-research " +
          (selected === 1 ? "graph-selected" : "")
        }
        onClick={() => setSelected(1)}
        aria-pressed={selected === 1}
      >
        <span className="graph-node-icon">
          <Activity size={14} />
        </span>
        <span>
          <strong>RESEARCH AGENT</strong>
          <small>
            <i /> Processing
          </small>
        </span>
        <span className="node-time">24ms</span>
      </button>
      <button
        className={
          "graph-card graph-model " + (selected === 2 ? "graph-selected" : "")
        }
        onClick={() => setSelected(2)}
        aria-pressed={selected === 2}
      >
        <span className="graph-node-icon violet">
          <Box size={14} />
        </span>
        <span>
          <strong>REASONING MODEL</strong>
          <small>
            <i /> Connected
          </small>
        </span>
      </button>
      <button
        className={
          "graph-card graph-guard " + (selected === 3 ? "graph-selected" : "")
        }
        onClick={() => setSelected(3)}
        aria-pressed={selected === 3}
      >
        <span className="guard-light" />
        <span>
          <strong>GUARDRAILS</strong>
          <small>All checks passed</small>
        </span>
      </button>
      <div className="scene-controls">
        <div className="scene-selection" aria-live="polite">
          <span className="status-dot" />
          <span>{current.name}</span>
          <span className="selection-latency">{current.latency}ms</span>
        </div>
        <div>
          <button
            className="icon-button"
            onClick={() => setPaused(!paused)}
            aria-label={
              paused ? "Play network animation" : "Pause network animation"
            }
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            className="icon-button"
            onClick={() => {
              pointer.current = { x: 0, y: 0 };
              setSelected(0);
              setExpanded(false);
            }}
            aria-label="Reset network view"
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="icon-button"
            onClick={() => setExpanded(!expanded)}
            aria-label={
              expanded ? "Restore network size" : "Expand network view"
            }
            aria-pressed={expanded}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
      <p className="sr-only">
        Interactive model of an AI agent network. Select a node to inspect its
        simulated latency. {current.role}. Utilization {current.load} percent.
      </p>
    </motion.div>
  );
}
