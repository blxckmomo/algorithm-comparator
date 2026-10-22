"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpRight, BookOpenCheck, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clipboard, Clock3, Code2, Copy, Database, FileJson, FlaskConical, Gauge, Info,
  MemoryStick, Minus, Scale, ShieldCheck, X, XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ComparisonResult, EquivalenceStatus, StaticAnalysis, TestCaseResult } from "@/lib/types";
import { PerformanceCharts } from "./performance-chart";

const statusContent: Record<EquivalenceStatus, { label: string; title: string; icon: typeof CheckCircle2 }> = {
  proven: { label: "FORMAL / SCOPED", title: "Proven Equivalent", icon: ShieldCheck },
  empirical: { label: "EXPERIMENTAL", title: "Empirically Equivalent", icon: FlaskConical },
  "not-equivalent": { label: "COUNTEREXAMPLE / CONTRACT", title: "Not Equivalent", icon: XCircle },
  inconclusive: { label: "INSUFFICIENT EVIDENCE", title: "Inconclusive", icon: CircleHelp },
};

function Reveal({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const reduced = useReducedMotion();
  return <motion.section id={id} className={className} initial={reduced ? false : { opacity: 0, y: 54, clipPath: "inset(0 0 12% 0)" }} whileInView={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.section>;
}

function SectionTitle({ index, eyebrow, title, description }: { index: string; eyebrow: string; title: string; description: string }) {
  return <div className="result-section-title"><span className="result-index">{index}</span><div><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div>;
}

function formatJson(value: unknown): string {
  if (value === undefined) return "—";
  const text = JSON.stringify(value);
  return text.length > 900 ? `${text.slice(0, 900)}…` : text;
}

function TestRow({ test, index }: { test: TestCaseResult; index: number }) {
  return <details className={`test-case test-case--${test.outcome}`}>
    <summary>
      <span className="test-number">{String(index + 1).padStart(2, "0")}</span>
      <span className={`test-outcome test-outcome--${test.outcome}`}>{test.outcome === "match" ? <Check size={13} /> : test.outcome === "mismatch" ? <X size={13} /> : <Minus size={13} />}{test.outcome.replace("-", " ")}</span>
      <span className="test-name"><strong>{test.name}</strong><small>{test.category}</small></span>
      <ChevronDown size={15} className="test-chevron" />
    </summary>
    <div className="test-detail">
      <p>{test.note}</p>
      <div className="test-io"><div><span>SHARED INPUT</span><pre>{formatJson(test.input)}</pre></div><div><span>ALGORITHM A {test.errorA ? "ERROR" : "OUTPUT"}</span><pre>{formatJson(test.errorA ?? test.outputA)}</pre></div><div><span>ALGORITHM B {test.errorB ? "ERROR" : "OUTPUT"}</span><pre>{formatJson(test.errorB ?? test.outputB)}</pre></div></div>
    </div>
  </details>;
}

function EquivalencePanel({ result }: { result: ComparisonResult }) {
  const [filter, setFilter] = useState<"all" | "mismatch" | "match">("all");
  const { equivalence } = result;
  const meta = statusContent[equivalence.status];
  const Icon = meta.icon;
  const filtered = equivalence.cases.filter((test) => filter === "all" || test.outcome === filter);
  return <Reveal className="result-block" id="verdict">
    <SectionTitle index="01" eyebrow="FUNCTIONAL EQUIVALENCE" title="Evidence before adjectives." description="A finite test can reject equivalence with one witness. Only a scoped deductive certificate can establish it." />
    <div className={`verdict-panel verdict-panel--${equivalence.status}`}>
      <div className="verdict-panel__main">
        <div className="verdict-icon"><Icon size={30} /></div>
        <div><span className="verdict-label">{meta.label}</span><h3>{equivalence.title}</h3><p>{equivalence.summary}</p></div>
      </div>
      <div className="verdict-stats"><div><strong>{equivalence.testsRun}</strong><span>inputs attempted</span></div><div><strong>{equivalence.validPairs}</strong><span>valid output pairs</span></div><div><strong>{equivalence.mismatches}</strong><span>counterexamples</span></div></div>
    </div>
    <div className="reasoning-grid">
      <div className="reasoning-card"><h4><BookOpenCheck size={17} /> Reasoning trail</h4><ol>{equivalence.reasoning.map((reason, index) => <li key={index}><span>{index + 1}</span><p>{reason}</p></li>)}</ol></div>
      <div className="reasoning-card"><h4><Scale size={17} /> Assumptions & limits</h4><ul className="assumption-list">{equivalence.assumptions.slice(0, 7).map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><div className="limitation-note"><Info size={15} /><p>{equivalence.limitations[0]}</p></div></div>
    </div>
    {equivalence.proof && <div className="proof-certificate">
      <div className="proof-certificate__head"><ShieldCheck size={20} /><div><span>PROOF CERTIFICATE</span><h4>Scope is part of the theorem.</h4></div><span className="verified-chip"><Check size={12} /> Reviewed template</span></div>
      <p className="proof-statement">{equivalence.proof.statement}</p>
      <div className="proof-columns"><div><h5>Assumptions</h5><ul>{equivalence.proof.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h5>Proof lemmas</h5><ol>{equivalence.proof.lemmas.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></div></div>
      <p className="proof-scope"><strong>Scope & non-claims:</strong> {equivalence.proof.scope}</p>
    </div>}
    <div className="test-suite">
      <div className="test-suite__header"><div><span className="section-kicker">SHARED-INPUT TEST LEDGER</span><h4>{filtered.length} case{filtered.length === 1 ? "" : "s"} shown</h4></div><div className="filter-tabs">{(["all", "mismatch", "match"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All cases" : item === "match" ? "Matches" : "Mismatches"}</button>)}</div></div>
      <AnimatePresence mode="popLayout" initial={false}><motion.div key={filter} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>{filtered.length ? filtered.map((test) => <TestRow key={test.name} test={test} index={equivalence.cases.indexOf(test)} />) : <div className="empty-filter">No cases in this category.</div>}</motion.div></AnimatePresence>
    </div>
  </Reveal>;
}

function TimeView({ analysis }: { analysis: StaticAnalysis }) {
  const rows = [["Best case", analysis.time.best], ["Average case", analysis.time.average], ["Worst case", analysis.time.worst], ["Big O", analysis.time.bigO], ["Big Omega", analysis.time.bigOmega], ["Big Theta", analysis.time.bigTheta]];
  return <div className="analysis-view"><div className="complexity-grid">{rows.map(([label, value]) => <div key={label} className={label === "Worst case" ? "complexity-cell complexity-cell--primary" : "complexity-cell"}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="derivation-block"><h5>Derivation</h5><p>{analysis.time.derivation}</p></div><div className="model-block"><span>INPUT VARIABLES</span><div>{analysis.time.variables.map((variable) => <code key={variable}>{variable}</code>)}</div><span>AVERAGE-CASE MODEL</span><p>{analysis.time.averageModel}</p></div>{analysis.time.limitations.length > 0 && <ul className="analysis-limitations">{analysis.time.limitations.map((item) => <li key={item}>{item}</li>)}</ul>}</div>;
}

function SpaceView({ analysis }: { analysis: StaticAnalysis }) {
  const rows = [["Total space", analysis.space.total], ["Auxiliary space", analysis.space.auxiliary], ["Input storage", analysis.space.inputStorage], ["Recursion stack", analysis.space.recursionStack], ["Modifies input in place", analysis.space.inPlace === "unknown" ? "Not established" : analysis.space.inPlace ? "Yes" : "No"]];
  return <div className="analysis-view"><div className="space-list">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="derivation-block"><h5>Memory derivation</h5><p>{analysis.space.derivation}</p></div><div className="structure-tags">{analysis.space.structures.map((structure) => <span key={structure}><Database size={12} />{structure}</span>)}</div></div>;
}

function EvidenceView({ analysis }: { analysis: StaticAnalysis }) {
  return <div className="analysis-view"><div className="evidence-intro"><Code2 size={18} /><p>Lexical evidence supports the derivation; it is not a substitute for one. Line numbers refer to the submitted source.</p></div>{analysis.evidence.length ? <div className="evidence-list">{analysis.evidence.map((item, index) => <div key={`${item.line}-${index}`}><span className={`evidence-kind evidence-kind--${item.kind}`}>{item.kind.replace("-", " ")}</span><code>L{item.line}</code><div><pre>{item.source}</pre><p>{item.note}</p></div></div>)}</div> : <div className="empty-filter">No supported structural evidence was extracted.</div>}</div>;
}

function AlgorithmAnalysisCard({ side, analysis }: { side: "A" | "B"; analysis: StaticAnalysis }) {
  const [tab, setTab] = useState<"time" | "space" | "evidence">("time");
  return <article className={`analysis-card analysis-card--${side.toLowerCase()}`}>
    <div className="analysis-card__head"><div className={`algorithm-monogram algorithm-monogram--${side.toLowerCase()}`}>{side}</div><div><span>{analysis.certified ? "REVIEWED TEMPLATE" : "UNVERIFIED / EDITED SOURCE"}</span><h3>{analysis.name}</h3></div>{analysis.certified ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}</div>
    <div className="purpose-block"><span>PRIMARY PURPOSE</span><p>{analysis.purpose}</p><div><code>IN {analysis.inputContract}</code><code>OUT {analysis.outputContract}</code></div></div>
    <div className="analysis-tabs" role="tablist" aria-label={`Algorithm ${side} analysis views`}><button type="button" role="tab" aria-selected={tab === "time"} className={tab === "time" ? "active" : ""} onClick={() => setTab("time")}><Clock3 size={14} />Time</button><button type="button" role="tab" aria-selected={tab === "space"} className={tab === "space" ? "active" : ""} onClick={() => setTab("space")}><MemoryStick size={14} />Space</button><button type="button" role="tab" aria-selected={tab === "evidence"} className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}><Code2 size={14} />Evidence <span>{analysis.evidence.length}</span></button></div>
    <AnimatePresence mode="wait" initial={false}><motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>{tab === "time" ? <TimeView analysis={analysis} /> : tab === "space" ? <SpaceView analysis={analysis} /> : <EvidenceView analysis={analysis} />}</motion.div></AnimatePresence>
    <div className="analysis-basis"><Info size={13} /><span>Basis: {tab === "space" ? analysis.space.basis : analysis.time.basis}. {analysis.certified ? "Exact source match required." : "No certificate inferred from naming or intent."}</span></div>
  </article>;
}

function measuredAtLargest(result: ComparisonResult, side: "a" | "b", metric: "time" | "memory"): string {
  const own = result.benchmarks[side];
  const other = result.benchmarks[side === "a" ? "b" : "a"];
  const otherSizes = new Set(other.points.map((point) => point.size));
  const point = [...own.points].filter((candidate) => otherSizes.has(candidate.size)).sort((x, y) => y.size - x.size)[0];
  if (!point) return "Not measured";
  if (metric === "time") return `${point.medianMs.toFixed(3)} ms @ ${point.size}`;
  return point.memoryKiB === null ? "Not measured" : point.memoryKiB >= 1024 ? `${(point.memoryKiB / 1024).toFixed(1)} MiB @ ${point.size}` : `${point.memoryKiB.toFixed(0)} KiB @ ${point.size}`;
}

function ComparisonTable({ result }: { result: ComparisonResult }) {
  const rows = [
    ["Primary purpose", result.a.purpose, result.b.purpose],
    ["Functional equivalence", `${result.equivalence.title} — shared verdict`, `${result.equivalence.title} — shared verdict`],
    ["Best-case time complexity", result.a.time.best, result.b.time.best],
    ["Average-case time complexity", result.a.time.average, result.b.time.average],
    ["Worst-case time complexity", result.a.time.worst, result.b.time.worst],
    ["Total space complexity", result.a.space.total, result.b.space.total],
    ["Auxiliary space complexity", result.a.space.auxiliary, result.b.space.auxiliary],
    ["Measured execution time", measuredAtLargest(result, "a", "time"), measuredAtLargest(result, "b", "time")],
    ["Measured memory usage", measuredAtLargest(result, "a", "memory"), measuredAtLargest(result, "b", "memory")],
  ];
  return <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th><th><span className="table-side table-side--a">A</span>{result.a.name}</th><th><span className="table-side table-side--b">B</span>{result.b.name}</th></tr></thead><tbody>{rows.map(([metric, a, b]) => <tr key={metric}><th>{metric}</th><td>{a}</td><td>{b}</td></tr>)}</tbody></table></div>;
}

function FinalReport({ result }: { result: ComparisonResult }) {
  const report = result.report;
  const sameProblemText = report.sameProblem === "yes" ? "Yes, within the established shared contract." : report.sameProblem === "no" ? "No shared computational contract was established; their required purposes or ordered outputs differ." : "Broadly related, but intent is inferred rather than established; the shared-problem question remains unresolved.";
  const questions = [
    ["Do both solve the same computational problem?", sameProblemText],
    ["Are outputs equivalent under the specified conditions?", report.equivalenceAnswer],
    ["Proof or experimental evidence?", report.proofAnswer],
    ["Which has better asymptotic time?", report.timeAnswer],
    ["Which needs less auxiliary memory?", report.spaceAnswer],
    ["Which performs better in benchmarks?", report.benchmarkAnswer],
    ["How do advantages change with input size?", report.scalingAnswer],
  ];
  return <Reveal className="result-block final-report" id="report">
    <SectionTitle index="05" eyebrow="INTELLIGENT FINAL REPORT" title="A recommendation with its caveats attached." description="The conclusion weighs correctness first, then asymptotics, memory, and this host’s measurements—without forcing an absolute winner." />
    <div className="report-questions">{questions.map(([question, answer], index) => <motion.article key={question} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}><span>{String(index + 1).padStart(2, "0")}</span><h4>{question}</h4><p>{answer}</p></motion.article>)}</div>
    <div className="recommendation-panel"><div className="recommendation-panel__label"><Gauge size={21} /><span>CONDITIONAL RECOMMENDATION</span></div><h3>{report.recommendation}</h3>{report.tradeoffs.length ? <div className="tradeoff-list"><h4>Trade-offs, not a trophy</h4>{report.tradeoffs.map((tradeoff) => <p key={tradeoff}><Scale size={15} />{tradeoff}</p>)}</div> : <p className="no-tradeoff">No conflicting category leader was detected at the reported precision. Assumptions and measurement limits still apply.</p>}<div className="report-conditions"><span>Prefer A when its contract, precondition, mutation behavior, or resource profile matches your constraints.</span><span>Prefer B on the same basis—not because a single benchmark number looks smaller.</span></div></div>
  </Reveal>;
}

export function ResultsDashboard({ result, onCopy, onShare, onExportJson, onExportMarkdown }: { result: ComparisonResult; onCopy: () => void; onShare: () => void; onExportJson: () => void; onExportMarkdown: () => void }) {
  return <div className="results-shell" id="results">
    <div className="results-toolbar"><div><span className="live-dot" /><strong>Analysis complete</strong><span>{new Date(result.createdAt).toLocaleString()}</span>{result.id && <code>SNAPSHOT {result.id.slice(0, 8)}</code>}</div><div><button type="button" onClick={onCopy}><Copy size={14} />Copy report</button><button type="button" onClick={onShare} disabled={!result.id}><Clipboard size={14} />Share</button><button type="button" onClick={onExportMarkdown}><ArrowDownToLine size={14} />Markdown</button><button type="button" onClick={onExportJson}><FileJson size={14} />JSON</button></div></div>
    {(result as ComparisonResult & { persistenceWarning?: string }).persistenceWarning && <div className="persistence-warning"><AlertTriangle size={16} />{(result as ComparisonResult & { persistenceWarning?: string }).persistenceWarning}</div>}
    <EquivalencePanel result={result} />
    <Reveal className="result-block" id="complexity"><SectionTitle index="02" eyebrow="STATIC COMPLEXITY ANALYSIS" title="Bounds, variables, and why they hold." description="Reviewed templates carry complete derivations. Edited code receives only what its visible control flow can justify." /><div className="analysis-cards"><AlgorithmAnalysisCard side="A" analysis={result.a} /><AlgorithmAnalysisCard side="B" analysis={result.b} /></div></Reveal>
    <Reveal className="result-block" id="benchmarks"><SectionTitle index="03" eyebrow="EMPIRICAL PERFORMANCE" title="Measured here. Not universal law." description="Identical generated inputs, fresh processes, repeated solve-time measurements, and runtime-specific memory instrumentation." /><PerformanceCharts a={result.benchmarks.a} b={result.benchmarks.b} nameA={result.a.name} nameB={result.b.name} /><div className="benchmark-ledger"><details><summary><FlaskConical size={16} /><span>Benchmark conditions & run integrity</span><ChevronDown size={15} /></summary><div className="benchmark-conditions"><div><h4>A · {result.a.name}</h4><p>{result.benchmarks.a.note}</p><ul>{result.benchmarks.a.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div><div><h4>B · {result.b.name}</h4><p>{result.benchmarks.b.note}</p><ul>{result.benchmarks.b.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div></div></details><div className="environment-strip"><ShieldCheck size={16} /><div><strong>{result.environment.runner}</strong><p>{result.environment.isolation}</p><p>{result.environment.networkPolicy}</p><small>{result.environment.caveat}</small></div></div></div></Reveal>
    <Reveal className="result-block" id="comparison"><SectionTitle index="04" eyebrow="SIDE-BY-SIDE MATRIX" title="One table. Separate kinds of truth." description="Theory, formal verification, and empirical measurements occupy distinct rows so one cannot silently impersonate another." /><ComparisonTable result={result} /></Reveal>
    <FinalReport result={result} />
  </div>;
}
