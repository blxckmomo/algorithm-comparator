"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import type { AlgorithmInput, EquivalenceStatus } from "@/lib/types";

const statusLabels: Record<EquivalenceStatus, string> = {
  proven: "PROVEN EQUIVALENT",
  empirical: "EMPIRICALLY EQUIVALENT",
  "not-equivalent": "NOT EQUIVALENT",
  inconclusive: "INCONCLUSIVE",
};

export function Hero({ a, b, status, onStart }: { a: AlgorithmInput; b: AlgorithmInput; status?: EquivalenceStatus; onStart: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, 0.76]);
  const visualRotate = useTransform(scrollYProgress, [0, 1], [0, 9]);
  const visualOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.25]);
  const clipPath = useTransform(scrollYProgress, [0, 0.85], ["inset(0% 0% 0% 0% round 26px)", "inset(9% 7% 9% 7% round 38px)"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const codeA = a.code.split("\n").filter((line) => line.trim()).slice(0, 7);
  const codeB = b.code.split("\n").filter((line) => line.trim()).slice(0, 7);

  return (
    <section className="hero" ref={ref}>
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow hero-glow--one" aria-hidden="true" />
      <div className="hero-glow hero-glow--two" aria-hidden="true" />
      <nav className="top-nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Proofwork home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>proofwork<span className="brand-dot">.</span></span>
        </a>
        <div className="nav-links">
          <a href="#workbench">Workbench</a>
          <a href="#method">Method</a>
          <a href="#library">Library</a>
        </div>
        <button className="nav-action" type="button" onClick={onStart}>New analysis <ArrowRight size={14} /></button>
      </nav>
      <div className="hero-inner" id="top">
        <motion.div className="hero-copy" style={reduced ? undefined : { y: copyY }}>
          <motion.div className="eyebrow" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="live-dot" /> COMPUTATIONAL CLARITY, NOT CONFIDENCE THEATER
          </motion.div>
          <h1 className="hero-title" aria-label="Same task. Same answer? Know the difference.">
            {["Same task.", "Same answer?", "Know the difference."].map((line, index) => (
              <span className="title-mask" key={line}>
                <motion.span
                  className={index === 2 ? "title-line title-line--accent" : "title-line"}
                  initial={reduced ? false : { y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, delay: 0.12 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >{line}</motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="hero-description" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58, duration: 0.65 }}>
            Compare two algorithms with scoped mathematical proof, shared-input execution, rigorous complexity derivations, and measurements that never pretend to be theory.
          </motion.p>
          <motion.div className="hero-actions" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.72, duration: 0.6 }}>
            <button className="button button--acid" type="button" onClick={onStart}>Open analysis bench <ArrowRight size={17} /></button>
            <a className="text-link" href="#method">How verdicts work <ArrowDown size={15} /></a>
          </motion.div>
          <motion.div className="hero-trust" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.7 }}>
            <span><ShieldCheck size={15} /> Scoped proof only</span>
            <span><FlaskConical size={15} /> Isolated execution</span>
            <span><CheckCircle2 size={15} /> Counterexample first</span>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-scene"
          style={reduced ? undefined : { y: visualY, scale: visualScale, rotateX: visualRotate, opacity: visualOpacity, clipPath, transformPerspective: 1200 }}
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="scene-orbit" aria-hidden="true"><span /><span /><span /></div>
          <motion.div className="scene-code scene-code--a" initial={reduced ? false : { x: -90, rotateY: -14, opacity: 0 }} animate={{ x: 0, rotateY: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
            <div className="scene-code__head"><span>A / {a.language.toUpperCase()}</span><i /><i /><i /></div>
            <div className="scene-code__body">
              {codeA.map((line, index) => <div key={`${index}-${line}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{line.replace(/\s+/g, " ").slice(0, 35)}</code></div>)}
            </div>
            <div className="scene-code__foot">STATIC STRUCTURE <strong>PARSED</strong></div>
          </motion.div>
          <motion.div className="scene-code scene-code--b" initial={reduced ? false : { x: 90, rotateY: 14, opacity: 0 }} animate={{ x: 0, rotateY: 0, opacity: 1 }} transition={{ delay: 0.62, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
            <div className="scene-code__head"><span>B / {b.language.toUpperCase()}</span><i /><i /><i /></div>
            <div className="scene-code__body">
              {codeB.map((line, index) => <div key={`${index}-${line}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{line.replace(/\s+/g, " ").slice(0, 35)}</code></div>)}
            </div>
            <div className="scene-code__foot">SHARED INPUTS <strong>ALIGNED</strong></div>
          </motion.div>
          <motion.div className={`scene-verdict scene-verdict--${status ?? "waiting"}`} initial={reduced ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.05, type: "spring", stiffness: 180, damping: 18 }}>
            <span className="verdict-pulse" />
            <small>{status ? "CURRENT VERDICT" : "VERDICT PROTOCOL"}</small>
            <strong>{status ? statusLabels[status] : "PROOF ≠ TESTING"}</strong>
            <span>{status ? "Snapshot complete" : "Four explicit states"}</span>
          </motion.div>
          <div className="scene-annotation scene-annotation--top">INPUT DOMAIN <span>∩</span></div>
          <div className="scene-annotation scene-annotation--bottom">f<sub>A</sub>(x) <span>≟</span> f<sub>B</sub>(x)</div>
        </motion.div>
      </div>
      <div className="hero-bottom">
        <span>01 / ANALYZE</span>
        <div className="hero-bottom__line"><motion.i style={reduced ? undefined : { scaleX: scrollYProgress }} /></div>
        <span>SCROLL TO CONFRONT THE EVIDENCE</span>
      </div>
    </section>
  );
}
