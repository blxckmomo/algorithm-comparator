"use client";

import { motion, useReducedMotion } from "motion/react";
import { BarChart3, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { BenchmarkResult } from "@/lib/types";

type Metric = "time" | "memory";
type SelectedPoint = { side: "A" | "B"; size: number; x: number; y: number; value: number; detail: string };

function formatValue(value: number, metric: Metric): string {
  if (metric === "memory") return value >= 1024 ? `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} MiB` : `${value.toFixed(0)} KiB`;
  if (value < 0.01) return `${(value * 1000).toFixed(1)} µs`;
  return `${value.toFixed(value >= 100 ? 1 : 3)} ms`;
}

function MetricChart({ metric, a, b, nameA, nameB }: { metric: Metric; a: BenchmarkResult; b: BenchmarkResult; nameA: string; nameB: string }) {
  const [logScale, setLogScale] = useState(false);
  const [selected, setSelected] = useState<SelectedPoint | null>(null);
  const reduced = useReducedMotion();
  const width = 720;
  const height = 290;
  const margin = { left: 66, right: 24, top: 26, bottom: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const model = useMemo(() => {
    const getValue = (result: BenchmarkResult, size: number) => {
      const point = result.points.find((candidate) => candidate.size === size);
      if (!point) return null;
      return metric === "time" ? point.medianMs : point.memoryKiB;
    };
    const sizes = [...new Set([...a.points.map((point) => point.size), ...b.points.map((point) => point.size)])].sort((x, y) => x - y);
    const values = sizes.flatMap((size) => [getValue(a, size), getValue(b, size)]).filter((value): value is number => value !== null && value > 0);
    const minSize = sizes[0] ?? 1;
    const maxSize = sizes.at(-1) ?? 1;
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, maxValue);
    const x = (size: number) => margin.left + (maxSize === minSize ? innerWidth / 2 : ((size - minSize) / (maxSize - minSize)) * innerWidth);
    const y = (value: number) => {
      if (logScale) {
        const low = Math.log(Math.max(minValue * 0.8, 0.000001));
        const high = Math.log(maxValue * 1.15);
        return margin.top + innerHeight - ((Math.log(Math.max(value, 0.000001)) - low) / Math.max(high - low, 0.000001)) * innerHeight;
      }
      return margin.top + innerHeight - (value / (maxValue * 1.12)) * innerHeight;
    };
    const series = (result: BenchmarkResult) => sizes.flatMap((size) => {
      const value = getValue(result, size);
      return value === null || value <= 0 ? [] : [{ size, value, x: x(size), y: y(value) }];
    });
    const ticks = Array.from({ length: 5 }, (_, index) => {
      if (logScale) {
        const low = Math.log(Math.max(minValue * 0.8, 0.000001));
        const high = Math.log(maxValue * 1.15);
        return Math.exp(low + (index / 4) * (high - low));
      }
      return (index / 4) * maxValue * 1.12;
    });
    return { sizes, x, y, seriesA: series(a), seriesB: series(b), ticks };
  }, [a, b, innerHeight, innerWidth, logScale, metric, margin.left, margin.top]);

  const selectPoint = (side: "A" | "B", point: { size: number; value: number; x: number; y: number }) => {
    const result = side === "A" ? a : b;
    const data = result.points.find((candidate) => candidate.size === point.size);
    const detail = metric === "time" && data
      ? `${data.runs.length} run(s), range ${formatValue(data.minMs, metric)}–${formatValue(data.maxMs, metric)}`
      : data ? Object.entries(data.variables).map(([key, value]) => `${key}=${value}`).join(", ") : "Measured value";
    setSelected({ side, size: point.size, x: point.x, y: point.y, value: point.value, detail });
  };
  const pathFor = (points: { x: number; y: number }[]) => points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const signature = `${metric}-${logScale}-${a.points.length}-${b.points.length}-${a.points.at(-1)?.medianMs}-${b.points.at(-1)?.medianMs}`;

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div><span className="section-kicker">EMPIRICAL / {metric === "time" ? "TIME" : "MEMORY"}</span><h3>{metric === "time" ? "Execution time" : "Memory consumption"}</h3></div>
        <div className="scale-toggle" aria-label="Y-axis scale">
          <button type="button" className={!logScale ? "active" : ""} onClick={() => setLogScale(false)}>Linear</button>
          <button type="button" className={logScale ? "active" : ""} onClick={() => setLogScale(true)}>Log</button>
        </div>
      </div>
      <div className="chart-legend"><span><i className="series-a" />A · {nameA}</span><span><i className="series-b" />B · {nameB}</span></div>
      {model.sizes.length ? (
        <div className="chart-wrap" onMouseLeave={() => setSelected(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric === "time" ? "Execution time" : "Memory usage"} versus input size for algorithms A and B`}>
            {model.ticks.map((tick, index) => {
              const y = model.y(tick);
              return <g key={index}><line className="chart-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} /><text className="chart-tick" x={margin.left - 10} y={y + 4} textAnchor="end">{formatValue(tick, metric)}</text></g>;
            })}
            {model.sizes.map((size) => <text className="chart-tick" key={size} x={model.x(size)} y={height - 17} textAnchor="middle">{size}</text>)}
            <text className="chart-axis-title" x={margin.left + innerWidth / 2} y={height - 1} textAnchor="middle">INPUT SIZE</text>
            <motion.path key={`a-${signature}`} className="chart-line chart-line--a" d={pathFor(model.seriesA)} fill="none" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
            <motion.path key={`b-${signature}`} className="chart-line chart-line--b" d={pathFor(model.seriesB)} fill="none" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.08 }} />
            {([{ side: "A" as const, points: model.seriesA }, { side: "B" as const, points: model.seriesB }]).map((series) => series.points.map((point) => (
              <g key={`${series.side}-${point.size}`}>
                <circle className={`chart-point chart-point--${series.side.toLowerCase()}`} cx={point.x} cy={point.y} r={5} />
                <circle
                  className="chart-hit" cx={point.x} cy={point.y} r={14} tabIndex={0} role="button"
                  aria-label={`Algorithm ${series.side}, input ${point.size}: ${formatValue(point.value, metric)}`}
                  onMouseEnter={() => selectPoint(series.side, point)} onFocus={() => selectPoint(series.side, point)} onBlur={() => setSelected(null)}
                />
              </g>
            )))}
          </svg>
          {selected && <div className={`chart-tooltip chart-tooltip--${selected.side.toLowerCase()}`} style={{ left: `${(selected.x / width) * 100}%`, top: `${(selected.y / height) * 100}%` }}>
            <span>{selected.side} / SIZE {selected.size}</span><strong>{formatValue(selected.value, metric)}</strong><small>{selected.detail}</small>
          </div>}
        </div>
      ) : <div className="chart-empty"><BarChart3 size={25} /><strong>No measured points</strong><p>{a.note || b.note || "Enable benchmarking and provide a supported shared input contract."}</p></div>}
      <div className="chart-footnote"><Info size={13} /><span>{metric === "time" ? "Median of solve-time repetitions; hover a point for min/max." : "Runtime-inclusive RSS for Python/C++; occupied JVM heap for Java. Cross-runtime memory is not perfectly like-for-like."}</span></div>
    </section>
  );
}

export function PerformanceCharts({ a, b, nameA, nameB }: { a: BenchmarkResult; b: BenchmarkResult; nameA: string; nameB: string }) {
  return <div className="charts-grid"><MetricChart metric="time" a={a} b={b} nameA={nameA} nameB={nameB} /><MetricChart metric="memory" a={a} b={b} nameA={nameA} nameB={nameB} /></div>;
}
