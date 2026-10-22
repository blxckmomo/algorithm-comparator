import type { ComparisonResult } from "./types";

export function comparisonToMarkdown(result: ComparisonResult): string {
  const lines = [
    "# Proofwork Algorithm Analysis Report",
    "",
    `Generated: ${result.createdAt}`,
    result.id ? `Snapshot: ${result.id}` : "Snapshot: not persisted",
    "",
    `## ${result.equivalence.title}`,
    "",
    result.equivalence.summary,
    "",
    `- Inputs attempted: ${result.equivalence.testsRun}`,
    `- Valid output pairs: ${result.equivalence.validPairs}`,
    `- Counterexamples: ${result.equivalence.mismatches}`,
    "",
    "### Reasoning",
    ...result.equivalence.reasoning.map((reason) => `- ${reason}`),
    "",
    "### Assumptions",
    ...result.equivalence.assumptions.map((assumption) => `- ${assumption}`),
    "",
    "### Limitations",
    ...result.equivalence.limitations.map((limitation) => `- ${limitation}`),
    "",
  ];
  if (result.equivalence.proof) {
    lines.push("## Scoped proof certificate", "", result.equivalence.proof.statement, "", "### Assumptions", ...result.equivalence.proof.assumptions.map((item) => `- ${item}`), "", "### Lemmas", ...result.equivalence.proof.lemmas.map((item, index) => `${index + 1}. ${item}`), "", `**Scope:** ${result.equivalence.proof.scope}`, "");
  }
  for (const [side, analysis] of [["A", result.a], ["B", result.b]] as const) {
    lines.push(
      `## Algorithm ${side}: ${analysis.name}`, "", analysis.purpose, "",
      `- Input: ${analysis.inputContract}`, `- Output: ${analysis.outputContract}`, `- Analysis basis: ${analysis.time.basis}`, "",
      "| Complexity metric | Result |", "| --- | --- |",
      `| Best time | ${analysis.time.best} |`, `| Average time | ${analysis.time.average} |`, `| Worst time | ${analysis.time.worst} |`,
      `| Big O | ${analysis.time.bigO} |`, `| Big Omega | ${analysis.time.bigOmega} |`, `| Big Theta | ${analysis.time.bigTheta} |`,
      `| Total space | ${analysis.space.total} |`, `| Auxiliary space | ${analysis.space.auxiliary} |`, `| Recursion stack | ${analysis.space.recursionStack} |`,
      `| Modifies input | ${analysis.space.inPlace} |`, "",
      `**Time derivation:** ${analysis.time.derivation}`, "", `**Average-case model:** ${analysis.time.averageModel}`, "", `**Space derivation:** ${analysis.space.derivation}`, "",
    );
  }
  lines.push("## Empirical measurements", "", "These measurements are separate from the theoretical bounds above.", "");
  for (const [side, benchmark] of [["A", result.benchmarks.a], ["B", result.benchmarks.b]] as const) {
    lines.push(`### Algorithm ${side} — ${benchmark.runtime}`, "", benchmark.note, "");
    if (benchmark.points.length) {
      lines.push("| Input size | Variables | Median ms | Min ms | Max ms | Memory KiB | Runs |", "| ---: | --- | ---: | ---: | ---: | ---: | ---: |");
      for (const point of benchmark.points) lines.push(`| ${point.size} | ${Object.entries(point.variables).map(([key, value]) => `${key}=${value}`).join(", ")} | ${point.medianMs.toFixed(4)} | ${point.minMs.toFixed(4)} | ${point.maxMs.toFixed(4)} | ${point.memoryKiB ?? "not measured"} | ${point.runs.length} |`);
      lines.push("");
    }
    lines.push(...benchmark.conditions.map((condition) => `- ${condition}`), "");
  }
  lines.push(
    "## Final report", "",
    `**Same computational problem:** ${result.report.sameProblem}`, "",
    `**Equivalence:** ${result.report.equivalenceAnswer}`, "",
    `**Proof status:** ${result.report.proofAnswer}`, "",
    `**Asymptotic time:** ${result.report.timeAnswer}`, "",
    `**Auxiliary memory:** ${result.report.spaceAnswer}`, "",
    `**Benchmarks:** ${result.report.benchmarkAnswer}`, "",
    `**Scaling:** ${result.report.scalingAnswer}`, "",
    "## Recommendation", "", result.report.recommendation, "",
    ...result.report.tradeoffs.map((tradeoff) => `- ${tradeoff}`), "",
    "## Execution environment", "", result.environment.runner, "", result.environment.isolation, "", result.environment.networkPolicy, "", result.environment.caveat,
  );
  return lines.join("\n");
}
