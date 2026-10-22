"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Code2, Dices,
  Download, Eraser, FilePlus2, FlaskConical, History, Info, Layers3, LoaderCircle,
  LockKeyhole, Play, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { algorithmLibrary, exampleComparisons, getImplementation } from "@/lib/library";
import { comparisonToMarkdown } from "@/lib/report-export";
import type { AlgorithmInput, AnalysisOptions, ComparisonRecordSummary, ComparisonResult, EquivalenceStatus } from "@/lib/types";
import { CodeEditorPanel } from "./code-editor";
import { Hero } from "./hero";
import { ResultsDashboard } from "./results-dashboard";

type ClientResult = ComparisonResult & { persistenceWarning?: string };
type Side = "a" | "b";

const defaultOptions: AnalysisOptions = { sizes: [16, 64, 256, 1024], repeats: 3, scenario: "random", seed: 1729, runBenchmarks: true };
const freshAlgorithm = (id: string): AlgorithmInput => ({ language: "python", libraryId: id, code: getImplementation(id, "python") });
const statusLabels: Record<EquivalenceStatus, string> = { proven: "Proven", empirical: "Empirical", "not-equivalent": "Not equivalent", inconclusive: "Inconclusive" };

async function copyText(text: string) {
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* use the selection fallback below */ }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function AlgorithmLab() {
  const [a, setA] = useState<AlgorithmInput>(() => freshAlgorithm("merge-sort"));
  const [b, setB] = useState<AlgorithmInput>(() => freshAlgorithm("quick-sort"));
  const [options, setOptions] = useState<AnalysisOptions>(defaultOptions);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [recent, setRecent] = useState<ComparisonRecordSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const draft = JSON.parse(localStorage.getItem("proofwork-draft-v1") ?? "null") as { a?: AlgorithmInput; b?: AlgorithmInput; options?: AnalysisOptions } | null;
        if (draft?.a?.code !== undefined && draft.b?.code !== undefined) {
          setA(draft.a);
          setB(draft.b);
          if (draft.options) setOptions(draft.options);
        }
        const savedResult = localStorage.getItem("proofwork-result-v1");
        if (savedResult && !window.location.search.includes("comparison=")) setResult(JSON.parse(savedResult) as ClientResult);
      } catch { /* malformed local state is ignored rather than blocking the workbench */ }
      setHydrated(true);
      try {
        const response = await fetch("/api/comparisons");
        if (response.ok && active) setRecent(await response.json() as ComparisonRecordSummary[]);
      } catch { /* recent history is optional if the database is offline */ }
      const id = new URLSearchParams(window.location.search).get("comparison");
      if (id) {
        try {
          const response = await fetch(`/api/comparisons/${id}`);
          const data = await response.json() as ClientResult & { error?: string };
          if (!response.ok) throw new Error(data.error ?? "Snapshot could not be loaded");
          if (active) {
            setResult(data);
            setA(data.inputs.a);
            setB(data.inputs.b);
            setOptions(data.options);
            setDirty(false);
          }
        } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Snapshot could not be loaded"); }
      }
    };
    void restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("proofwork-draft-v1", JSON.stringify({ a, b, options }));
  }, [a, b, options, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (result) localStorage.setItem("proofwork-result-v1", JSON.stringify(result));
    else localStorage.removeItem("proofwork-result-v1");
  }, [result, hydrated]);

  const updateAlgorithm = (side: Side, next: AlgorithmInput) => {
    const setter = side === "a" ? setA : setB;
    setter((previous) => {
      let code = next.code;
      if (next.libraryId && (next.libraryId !== previous.libraryId || next.language !== previous.language)) code = getImplementation(next.libraryId, next.language);
      return { ...next, code };
    });
    setDirty(true);
  };
  const updateOptions = (next: AnalysisOptions) => { setOptions(next); setDirty(true); };
  const clearUrl = () => window.history.replaceState({}, "", window.location.pathname);

  const loadPair = (idA: string, idB: string) => {
    setA(freshAlgorithm(idA));
    setB(freshAlgorithm(idB));
    setResult(null);
    setError("");
    setDirty(false);
    clearUrl();
    scrollTo("workbench");
    notify("Example pair loaded. Run it or change either language.");
  };
  const loadInto = (side: Side, id: string) => {
    const setter = side === "a" ? setA : setB;
    const current = side === "a" ? a : b;
    setter({ language: current.language, libraryId: id, code: getImplementation(id, current.language) });
    setDirty(true);
    scrollTo("workbench");
    notify(`${algorithmLibrary.find((item) => item.id === id)?.name ?? "Algorithm"} loaded into ${side.toUpperCase()}.`);
  };
  const openSnapshot = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/comparisons/${id}`);
      const data = await response.json() as ClientResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Snapshot could not be loaded");
      setResult(data);
      setA(data.inputs.a);
      setB(data.inputs.b);
      setOptions(data.options);
      setDirty(false);
      window.history.replaceState({}, "", `${window.location.pathname}?comparison=${id}`);
      scrollTo("results");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Snapshot could not be loaded"); }
  };
  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b, options }) });
      const data = await response.json() as ClientResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
      setDirty(false);
      if (data.id) {
        window.history.replaceState({}, "", `${window.location.pathname}?comparison=${data.id}`);
        setRecent((previous) => [{ id: data.id!, createdAt: data.createdAt, nameA: data.a.name, nameB: data.b.name, languageA: data.a ? a.language : "python", languageB: b.language, status: data.equivalence.status }, ...previous.filter((item) => item.id !== data.id)].slice(0, 8));
      }
      if (data.persistenceWarning) notify("Analysis complete; database snapshot failed. Export is still available.");
      window.setTimeout(() => scrollTo("results"), 120);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed unexpectedly");
    } finally { setLoading(false); }
  };
  const clearInputs = () => {
    setA({ language: a.language, libraryId: null, code: "" });
    setB({ language: b.language, libraryId: null, code: "" });
    setResult(null);
    setDirty(false);
    setError("");
    clearUrl();
    notify("Editors cleared. Your library and language controls remain available.");
  };
  const newComparison = () => {
    setA(freshAlgorithm("merge-sort"));
    setB(freshAlgorithm("quick-sort"));
    setOptions(defaultOptions);
    setResult(null);
    setDirty(false);
    setError("");
    clearUrl();
    scrollTo("workbench");
  };
  const exportJson = () => { if (result) downloadFile(`proofwork-${result.id?.slice(0, 8) ?? "analysis"}.json`, JSON.stringify(result, null, 2), "application/json"); };
  const exportMarkdown = () => { if (result) downloadFile(`proofwork-${result.id?.slice(0, 8) ?? "report"}.md`, comparisonToMarkdown(result), "text/markdown"); };
  const share = async () => {
    if (!result?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?comparison=${result.id}`;
    await copyText(url);
    notify("Share link copied to clipboard.");
  };

  return <>
    <Hero a={a} b={b} status={result?.equivalence.status} onStart={() => scrollTo("workbench")} />
    <main className="light-shell">
      <section className="workbench section-shell" id="workbench">
        <div className="workbench-heading"><div><span className="section-kicker">LIVE ANALYSIS WORKBENCH / 01</span><h2>Put both algorithms<br />on the same stand.</h2></div><p>Separate source, language, and runtime. One shared input protocol. No result is upgraded from “tested” to “proven” without a certificate.</p></div>
        <div className="example-strip"><span><Sparkles size={14} />Start with an authored comparison</span><div>{exampleComparisons.map((example) => <button key={`${example.a}-${example.b}`} type="button" onClick={() => loadPair(example.a, example.b)} title={example.note}>{example.title}<ArrowRight size={12} /></button>)}</div></div>
        <div className="editors-grid">
          {(["a", "b"] as Side[]).map((side) => <CodeEditorPanel key={side} side={side.toUpperCase() as "A" | "B"} value={side === "a" ? a : b} onChange={(next) => updateAlgorithm(side, next)} onReset={() => {
            const current = side === "a" ? a : b;
            if (current.libraryId) updateAlgorithm(side, { ...current, code: getImplementation(current.libraryId, current.language) });
            else updateAlgorithm(side, { ...current, code: "" });
          }} />)}
        </div>
        <div className="run-console">
          <div className="run-console__top"><div><Settings2 size={17} /><span>Benchmark protocol</span><small>Theory is always analyzed; measurements are optional.</small></div><label className="switch-label"><input type="checkbox" checked={options.runBenchmarks} onChange={(event) => updateOptions({ ...options, runBenchmarks: event.target.checked })} /><span className="switch-track"><i /></span>Run benchmarks</label></div>
          <div className={`benchmark-controls ${!options.runBenchmarks ? "benchmark-controls--disabled" : ""}`}>
            <fieldset><legend>Input scenario</legend><div className="scenario-control">{(["random", "worst", "best"] as const).map((scenario) => <button key={scenario} type="button" disabled={!options.runBenchmarks} className={options.scenario === scenario ? "active" : ""} onClick={() => updateOptions({ ...options, scenario })}>{scenario === "random" ? "Seeded random" : scenario === "worst" ? "Worst-oriented" : "Best-oriented"}</button>)}</div><p>{options.scenario === "random" ? "Deterministic pseudo-random values; not a claim about your production distribution." : options.scenario === "worst" ? "Absent search target, reverse-sorted array, or denser connected graph; not guaranteed worst for every algorithm." : "First search target, sorted array, isolated traversal source, or ordered spanning-tree edges."}</p></fieldset>
            <fieldset><legend>Input sizes <span>choose up to 5</span></legend><div className="size-control">{[8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((size) => <button key={size} type="button" disabled={!options.runBenchmarks || (options.sizes.includes(size) && options.sizes.length <= 1) || (!options.sizes.includes(size) && options.sizes.length >= 5)} className={options.sizes.includes(size) ? "active" : ""} onClick={() => updateOptions({ ...options, sizes: options.sizes.includes(size) ? options.sizes.filter((item) => item !== size) : [...options.sizes, size].sort((x, y) => x - y) })}>{size}</button>)}</div></fieldset>
            <fieldset className="compact-field"><legend>Repetitions</legend><div className="repeat-control"><button type="button" disabled={!options.runBenchmarks || options.repeats <= 1} onClick={() => updateOptions({ ...options, repeats: options.repeats - 1 })}>−</button><strong>{options.repeats}</strong><button type="button" disabled={!options.runBenchmarks || options.repeats >= 5} onClick={() => updateOptions({ ...options, repeats: options.repeats + 1 })}>+</button></div><p>Median, minimum, and maximum are retained.</p></fieldset>
            <fieldset className="compact-field"><legend>Random seed</legend><div className="seed-control"><input aria-label="Benchmark random seed" type="number" value={options.seed} disabled={!options.runBenchmarks} onChange={(event) => updateOptions({ ...options, seed: Number(event.target.value) || 0 })} /><button type="button" aria-label="Generate a new seed" title="Generate a new seed" disabled={!options.runBenchmarks} onClick={() => updateOptions({ ...options, seed: Math.floor(Math.random() * 1_000_000) })}><Dices size={16} /></button></div><p>Same seed and generated inputs for A and B.</p></fieldset>
          </div>
          <div className="run-actions"><div className="run-integrity"><LockKeyhole size={15} /><span>{options.runBenchmarks ? `${options.sizes.length * options.repeats * 2} benchmark runs + shared behavioral probes` : "Static analysis + shared behavioral probes"}</span></div><div><button className="button button--ghost-dark" type="button" onClick={clearInputs}><Eraser size={15} />Clear</button><button className="button button--ghost-dark" type="button" onClick={newComparison}><FilePlus2 size={15} />New comparison</button><button className="button button--analyze" type="button" disabled={loading || !a.code.trim() || !b.code.trim()} onClick={analyze}>{loading ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}{loading ? "Analyzing…" : "Analyze & compare"}<ArrowRight size={16} /></button></div></div>
        </div>
        <AnimatePresence>{loading && <motion.div className="analysis-progress" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><div className="indeterminate-line"><i /></div><div><LoaderCircle className="spin" size={18} /><p><strong>Analysis is running on the server.</strong><span>Static parsing, sandboxed shared-input tests, then the enabled benchmark matrix. No percentage is fabricated.</span></p></div></motion.div>}</AnimatePresence>
        {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><div><strong>Analysis could not complete</strong><p>{error}</p></div><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
      </section>

      {result && <>{dirty && <div className="stale-banner section-shell"><Info size={16} /><span>Inputs or benchmark settings changed after this snapshot. Run Analyze & compare to refresh it.</span></div>}<ResultsDashboard result={result} onCopy={async () => { await copyText(comparisonToMarkdown(result)); notify("Full Markdown report copied."); }} onShare={share} onExportJson={exportJson} onExportMarkdown={exportMarkdown} /></>}

      <section className="method-section section-shell" id="method">
        <div className="section-heading-centered"><span className="section-kicker">METHODOLOGY / FOUR STATES</span><h2>Rigor means knowing<br />what you cannot claim.</h2><p>Equivalence is undecidable in general. Proofwork narrows the problem with explicit contracts, exact reviewed templates, executable witnesses, and honest unknowns.</p></div>
        <div className="verdict-method-grid">
          <article><ShieldCheck size={22} /><span>01 / DEDUCTIVE</span><h3>Proven Equivalent</h3><p>Both exact sources carry the same reviewed output contract and a valid argument under enumerated assumptions. Tests only supplement the certificate.</p></article>
          <article><FlaskConical size={22} /><span>02 / EXPERIMENTAL</span><h3>Empirically Equivalent</h3><p>Every successfully paired test agrees, but at least one source lacks a proof certificate. Untested behavior remains possible.</p></article>
          <article><CircleHelp size={22} /><span>03 / REFUTED</span><h3>Not Equivalent</h3><p>A shared-input output/behavior witness differs, or static analysis establishes distinct computational contracts.</p></article>
          <article><Info size={22} /><span>04 / UNRESOLVED</span><h3>Inconclusive</h3><p>Unsupported syntax, unavailable runtimes, missing valid pairs, or insufficient recurrence information prevents a defensible verdict.</p></article>
        </div>
        <div className="architecture-panel"><div><span className="section-kicker">MODULAR ARCHITECTURE</span><h3>Six responsibilities.<br />One shared evidence model.</h3><p>Next.js route handlers orchestrate dedicated TypeScript modules. PostgreSQL stores complete snapshots through Drizzle; native language runtimes are isolated from the web process.</p></div><div className="architecture-list">{[
          [Code2, "Frontend UI", "React client state, CodeMirror editors, accessible controls and responsive visualizations."],
          [Layers3, "Static analysis", "Exact template certification, lexical loop/recursion/allocation evidence, conservative derivations."],
          [Check, "Equivalence testing", "Shared deterministic cases, deep JSON comparison, counterexamples and proof scoping."],
          [Clock3, "Complexity analysis", "Best/average/worst bounds, recurrence explanations, V/E variables and space ownership."],
          [LockKeyhole, "Sandbox & benchmarks", "Separate processes, rlimits, timeouts, private directories, runtime instrumentation and repeats."],
          [BookOpen, "Reports & persistence", "Single typed result feeds charts, matrices, Markdown/JSON exports and Drizzle snapshots."],
        ].map(([Icon, title, text], index) => { const Component = Icon as typeof Code2; return <article key={String(title)}><span>{String(index + 1).padStart(2, "0")}</span><Component size={18} /><div><h4>{String(title)}</h4><p>{String(text)}</p></div></article>; })}</div></div>
      </section>

      <section className="library-section" id="library"><div className="section-shell"><div className="workbench-heading"><div><span className="section-kicker">INITIAL ALGORITHM LIBRARY / 10 × 3</span><h2>Known contracts.<br />Executable in three languages.</h2></div><p>Every entry has Python, C++17, and Java source, an explicit JSON contract, independently stated time and space derivations, and a scoped proof certificate.</p></div><div className="library-grid">{algorithmLibrary.map((algorithm, index) => <motion.article key={algorithm.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: (index % 2) * 0.08 }}><div className="library-card__top"><span>{String(index + 1).padStart(2, "0")}</span><code>{algorithm.family}</code></div><h3>{algorithm.name}</h3><p>{algorithm.summary}</p><div className="library-complexity"><div><span>WORST TIME</span><strong>{algorithm.time.worst}</strong></div><div><span>AUXILIARY</span><strong>{algorithm.space.auxiliary}</strong></div></div><div className="library-variables">{algorithm.time.variables.slice(0, 2).map((variable) => <code key={variable}>{variable}</code>)}</div><div className="library-actions"><button type="button" onClick={() => loadInto("a", algorithm.id)}>Load as A <Plus size={13} /></button><button type="button" onClick={() => loadInto("b", algorithm.id)}>Load as B <Plus size={13} /></button></div></motion.article>)}</div></div></section>

      <section className="history-section section-shell"><div className="history-heading"><div><History size={20} /><span><strong>Recent persisted comparisons</strong><small>Complete snapshots stored in PostgreSQL via Drizzle.</small></span></div>{recent.length > 0 && <button type="button" onClick={() => openSnapshot(recent[0].id)}>Open latest <ArrowRight size={14} /></button>}</div>{recent.length ? <div className="history-list">{recent.map((item) => <button key={item.id} type="button" onClick={() => openSnapshot(item.id)}><span className={`history-status history-status--${item.status}`}>{statusLabels[item.status]}</span><span className="history-names"><strong>{item.nameA}</strong><i>vs</i><strong>{item.nameB}</strong></span><span className="history-languages">{item.languageA} / {item.languageB}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time><ArrowRight size={15} /></button>)}</div> : <div className="history-empty"><History size={20} /><span>No snapshots loaded yet. Complete an analysis to create a shareable database record.</span></div>}</section>
    </main>
    <footer className="footer"><div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>proofwork<span className="brand-dot">.</span></span></div><p>Algorithm analysis with the epistemology left in.</p><div><a href="#workbench">Workbench</a><a href="#method">Method</a><a href="#library">Library</a><a href="/api/health">Health</a></div><span>NEXT.JS · DRIZZLE · POSTGRESQL · NATIVE SANDBOX</span></footer>
    <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}><Check size={16} />{toast}<button type="button" onClick={() => setToast("")} aria-label="Dismiss notification"><X size={14} /></button></motion.div>}</AnimatePresence>
  </>;
}
