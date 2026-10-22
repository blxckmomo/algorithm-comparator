import { createRunner, type AlgorithmRunner, type ExecutionOutcome } from "./sandbox";
import { libraryById } from "./library";
import { analyzeAlgorithm } from "./static-analyzer";
import { generateBenchmarkInput, generateTestSuite } from "./test-suites";
import type {
  AlgorithmInput, AnalysisOptions, BenchmarkPoint, BenchmarkResult, BenchmarkRun, ComparisonResult,
  EquivalenceResult, FinalReport, StaticAnalysis, TestCaseResult,
} from "./types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).sort();
    const bKeys = Object.keys(bRecord).sort();
    return deepEqual(aKeys, bKeys) && aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

function infrastructureFailure(outcome: ExecutionOutcome): boolean {
  return Boolean(outcome.error && /^(UNAVAILABLE:|Execution exceeded|Runner produced|Invalid runner|Harness:|Execution exceeded the 2 MB)/.test(outcome.error));
}

function unavailableBenchmark(input: AlgorithmInput, note: string): BenchmarkResult {
  return { status: "unavailable", language: input.language, runtime: "Not measured", points: [], note, conditions: ["No empirical timing or memory value is substituted for a missing run."] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function runBenchmark(
  input: AlgorithmInput,
  analysis: StaticAnalysis,
  runner: AlgorithmRunner,
  options: AnalysisOptions,
  problem: StaticAnalysis["problem"],
): Promise<BenchmarkResult> {
  if (!options.runBenchmarks) return unavailableBenchmark(input, "Benchmarking was disabled for this comparison.");
  if (!runner.available) return unavailableBenchmark(input, runner.reason ?? "Runtime unavailable; no benchmark was fabricated.");
  const conditions = [
    `Runtime: ${runner.runtime}`,
    `Input sizes: ${options.sizes.join(", ")}; ${options.repeats} measured repetitions per size`,
    `Scenario: ${options.scenario}; deterministic seed ${options.seed}`,
    "Each repetition uses a fresh process and a freshly decoded copy of the same generated input.",
    "Timing wraps solve only; process startup, JSON parsing, and result serialization are excluded.",
    input.language === "java" ? "Memory is occupied JVM heap after solve, including runtime baseline and returned objects." : "Memory is Linux peak resident set size (ru_maxrss), including interpreter/runtime baseline.",
    "Runs are sequential within each algorithm; this is not a cross-language normalized hardware benchmark.",
  ];
  if (problem === "unknown") return { status: "unavailable", language: input.language, runtime: runner.runtime, points: [], note: "No defensible input-size model was inferred, so scaling benchmarks were not run.", conditions };
  const points: BenchmarkPoint[] = [];
  const failures: string[] = [];
  for (const size of options.sizes) {
    const generated = generateBenchmarkInput(problem, size, options.scenario, options.seed + size * 7919);
    const runs: BenchmarkRun[] = [];
    for (let iteration = 0; iteration < options.repeats; iteration += 1) {
      const outcome = await runner.execute(generated.input);
      if (outcome.ok) runs.push({ iteration: iteration + 1, milliseconds: outcome.milliseconds, memoryKiB: outcome.memoryKiB });
      else failures.push(`n=${size}, run ${iteration + 1}: ${outcome.error ?? "unknown failure"}`);
    }
    if (runs.length) {
      const times = runs.map((run) => run.milliseconds);
      const memories = runs.flatMap((run) => run.memoryKiB === null ? [] : [run.memoryKiB]);
      points.push({
        size, variables: generated.variables, medianMs: median(times), minMs: Math.min(...times), maxMs: Math.max(...times),
        memoryKiB: memories.length ? median(memories) : null, runs,
      });
    }
  }
  return {
    status: points.length ? "ok" : "failed", language: input.language, runtime: runner.runtime, points,
    note: failures.length ? `${failures.length} run(s) did not produce a measurement. ${failures.slice(0, 2).join(" | ")}` : "All requested repetitions completed; medians are shown with min/max ranges.",
    conditions,
  };
}

async function testEquivalence(
  a: StaticAnalysis,
  b: StaticAnalysis,
  runnerA: AlgorithmRunner,
  runnerB: AlgorithmRunner,
  seed: number,
): Promise<EquivalenceResult> {
  const problem = a.problem !== "unknown" ? a.problem : b.problem;
  const suite = generateTestSuite(problem, seed);
  const cases: TestCaseResult[] = [];
  let validPairs = 0;
  let mismatches = 0;
  let testsRun = 0;
  for (const test of suite) {
    const [outcomeA, outcomeB] = await Promise.all([runnerA.execute(test.input), runnerB.execute(test.input)]);
    const unavailableA = !outcomeA.ok && infrastructureFailure(outcomeA);
    const unavailableB = !outcomeB.ok && infrastructureFailure(outcomeB);
    if (!unavailableA || !unavailableB) testsRun += 1;
    let outcome: TestCaseResult["outcome"];
    let note: string;
    if (outcomeA.ok && outcomeB.ok) {
      validPairs += 1;
      if (deepEqual(outcomeA.output, outcomeB.output)) {
        outcome = "match";
        note = "Identical JSON values on this shared input. This is evidence for this case, not a universal proof.";
      } else {
        outcome = "mismatch";
        mismatches += 1;
        note = "Concrete counterexample: both runs completed but returned different values.";
      }
    } else if (unavailableA || unavailableB) {
      outcome = "unavailable";
      note = "At least one side could not be executed safely; this case provides no behavioral evidence.";
    } else if (!outcomeA.ok && !outcomeB.ok) {
      outcome = "both-failed";
      note = "Both raised runtime errors. Matching failures are not counted as evidence of equivalent valid outputs.";
    } else {
      outcome = "mismatch";
      mismatches += 1;
      note = "Behavioral witness: one algorithm returned a value while the other raised an error on the same probe.";
    }
    cases.push({
      name: test.name, category: test.category, input: test.input,
      outputA: outcomeA.ok ? outcomeA.output : undefined, outputB: outcomeB.ok ? outcomeB.output : undefined,
      errorA: outcomeA.ok ? undefined : outcomeA.error, errorB: outcomeB.ok ? undefined : outcomeB.error,
      outcome, note,
    });
  }

  const profileA = a.libraryId ? libraryById.get(a.libraryId) : undefined;
  const profileB = b.libraryId ? libraryById.get(b.libraryId) : undefined;
  const proofEligible = Boolean(a.certified && b.certified && profileA && profileB && profileA.proofGroup === profileB.proofGroup);
  const distinctContracts = a.problem !== "unknown" && b.problem !== "unknown" && a.problem !== b.problem;
  const assumptions = [...new Set([...a.assumptions, ...b.assumptions])];
  const reasoning: string[] = [];
  const limitations = ["Passing a finite test suite never establishes equivalence for untested inputs."];

  if (mismatches > 0) {
    reasoning.push(`${mismatches} shared input(s) produced different values or runtime behavior; the first concrete witness is sufficient to reject output equivalence.`);
    if (proofEligible) reasoning.push("The counterexample contradicts the reviewed certificate scope, so no proof claim is retained for this run.");
    return {
      status: "not-equivalent", title: "Not Equivalent", summary: "A concrete shared-input witness demonstrates different behavior.",
      reasoning, assumptions, testsRun, validPairs, mismatches, cases,
      limitations: [...limitations, "Runtime errors caused by infrastructure limits are excluded from counterexamples; language-level algorithm errors on a contract probe are reported as behavioral differences."],
    };
  }
  if (distinctContracts) {
    reasoning.push(`Static contract analysis classifies A as ${a.problem} and B as ${b.problem}; their specified input/output problems differ.`);
    reasoning.push("No amount of speed comparison can make distinct computational contracts functionally equivalent.");
    return { status: "not-equivalent", title: "Not Equivalent", summary: "The algorithms solve different computational problems, independently of their benchmark performance.", reasoning, assumptions, testsRun, validPairs, mismatches, cases, limitations };
  }
  if (proofEligible && profileA && profileB) {
    reasoning.push("Both sources exactly match reviewed implementations carrying the same mathematical output contract.");
    reasoning.push("The proof is deductive under the listed assumptions; shared tests are supplementary bug checks, not the basis of the proof.");
    return {
      status: "proven", title: "Proven Equivalent", summary: "A scoped mathematical argument establishes the same returned-output contract under explicit assumptions.",
      reasoning, assumptions, testsRun, validPairs, mismatches, cases,
      proof: {
        statement: `On the intersection of both input domains, A and B satisfy: ${profileA.proof.statement}`,
        assumptions: [...new Set([...profileA.proof.assumptions, ...profileB.proof.assumptions, ...assumptions])],
        lemmas: [...profileA.proof.lemmas.map((lemma) => `A — ${lemma}`), ...profileB.proof.lemmas.map((lemma) => `B — ${lemma}`)],
        scope: `${profileA.proof.scope} ${profileA.id === profileB.id ? "" : profileB.proof.scope}`.trim(),
      },
      limitations: ["The certificate covers only exact reviewed source templates and the stated mathematical domain; edits, runtime defects, numeric outside the contract, and resource exhaustion are outside the proof."],
    };
  }
  if (validPairs > 0) {
    reasoning.push(`All ${validPairs} successfully paired runs returned identical values across normal, edge, boundary, and/or seeded randomized probes.`);
    reasoning.push("No reviewed proof certificate applies to at least one source, so the conclusion remains empirical.");
    return {
      status: "empirical", title: "Empirically Equivalent", summary: `Identical outputs on ${validPairs} successfully executed shared inputs; universal equivalence is not proven.`,
      reasoning, assumptions, testsRun, validPairs, mismatches, cases,
      limitations: [...limitations, "Untested inputs, integer overflow outside the JSON contract, nontermination, and divergent complexity remain possible."],
    };
  }
  reasoning.push("No pair of valid, successfully executed outputs was available for comparison.");
  if (!runnerA.available) reasoning.push(`A: ${runnerA.reason}`);
  if (!runnerB.available) reasoning.push(`B: ${runnerB.reason}`);
  return {
    status: "inconclusive", title: "Inconclusive", summary: "There is insufficient proof or valid execution evidence to determine equivalence.",
    reasoning, assumptions, testsRun, validPairs, mismatches, cases,
    limitations: [...limitations, "Unsupported constructs and unavailable runtimes produce an inconclusive result rather than an invented verdict."],
  };
}

function compareRank(rankA: number | null, rankB: number | null): "A" | "B" | "tie" | "unknown" {
  if (rankA === null || rankB === null) return "unknown";
  if (rankA === rankB) return "tie";
  return rankA < rankB ? "A" : "B";
}

function largestCommonPoint(resultA: BenchmarkResult, resultB: BenchmarkResult) {
  const bSizes = new Set(resultB.points.map((point) => point.size));
  return [...resultA.points].filter((point) => bSizes.has(point.size)).sort((x, y) => y.size - x.size)[0];
}

function generateReport(a: StaticAnalysis, b: StaticAnalysis, equivalence: EquivalenceResult, benchmarkA: BenchmarkResult, benchmarkB: BenchmarkResult): FinalReport {
  const sameKind = a.problem !== "unknown" && a.problem === b.problem;
  const traversalConflict = a.problem === "graph-traversal" && a.certified && b.certified && a.libraryId !== b.libraryId;
  const sameProblem: FinalReport["sameProblem"] = distinctPurpose(a, b)
    ? "no"
    : a.problem === "unknown" || b.problem === "unknown"
      ? "unknown"
      : traversalConflict
        ? "no"
        : sameKind && a.certified && b.certified ? "yes" : "unknown";
  const timeWinner = sameKind ? compareRank(a.time.worstRank, b.time.worstRank) : "unknown";
  const spaceWinner = sameKind ? compareRank(a.space.auxiliaryRank, b.space.auxiliaryRank) : "unknown";
  const commonLargest = largestCommonPoint(benchmarkA, benchmarkB);
  let benchmarkWinner: FinalReport["benchmarkWinner"] = "unknown";
  if (commonLargest) {
    const pointB = benchmarkB.points.find((point) => point.size === commonLargest.size)!;
    const relative = Math.abs(commonLargest.medianMs - pointB.medianMs) / Math.max(commonLargest.medianMs, pointB.medianMs, 0.000001);
    benchmarkWinner = relative < 0.05 ? "tie" : commonLargest.medianMs < pointB.medianMs ? "A" : "B";
  }
  const timeAnswer = timeWinner === "unknown"
    ? `No cross-problem or unsupported asymptotic winner is asserted. A worst case: ${a.time.worst}; B worst case: ${b.time.worst}.`
    : timeWinner === "tie"
      ? `Neither has a strictly better established worst-case growth rank. A: ${a.time.worst}; B: ${b.time.worst}. Best- and average-case rows may still favor one side.`
      : `${timeWinner} has the better established worst-case asymptotic growth for this shared problem. A: ${a.time.worst}; B: ${b.time.worst}.`;
  const spaceAnswer = spaceWinner === "unknown"
    ? `Auxiliary-memory ordering is not established. A: ${a.space.auxiliary}; B: ${b.space.auxiliary}.`
    : spaceWinner === "tie"
      ? `Their worst-case auxiliary-space growth ranks are tied at this level of precision. A: ${a.space.auxiliary}; B: ${b.space.auxiliary}.`
      : `${spaceWinner} requires less auxiliary memory by the established growth comparison. A: ${a.space.auxiliary}; B: ${b.space.auxiliary}.`;
  const benchmarkAnswer = commonLargest
    ? `At the largest mutually measured size (${commonLargest.size}), median solve time is A ${commonLargest.medianMs.toFixed(3)} ms and B ${(benchmarkB.points.find((point) => point.size === commonLargest.size)?.medianMs ?? 0).toFixed(3)} ms. ${benchmarkWinner === "tie" ? "The difference is below the 5% tie threshold." : benchmarkWinner === "unknown" ? "" : `${benchmarkWinner} is faster for this run.`} These measurements do not prove a ranking on other inputs or machines.`
    : "No common successful benchmark point is available, so no empirical performance winner is declared.";
  const commonSizes = benchmarkA.points.filter((point) => benchmarkB.points.some((other) => other.size === point.size)).sort((x, y) => x.size - y.size);
  const leaders = commonSizes.map((point) => {
    const other = benchmarkB.points.find((candidate) => candidate.size === point.size)!;
    return Math.abs(point.medianMs - other.medianMs) / Math.max(point.medianMs, other.medianMs, 0.000001) < 0.05 ? "tie" : point.medianMs < other.medianMs ? "A" : "B";
  });
  const changed = leaders.length > 1 && leaders.some((leader) => leader !== leaders[0]);
  const scalingAnswer = commonSizes.length
    ? `${changed ? "The measured leader changes across sizes, indicating a crossover within the tested range." : "The measured leader does not change across the tested sizes."} Examine the plotted medians and ranges rather than extrapolating a guaranteed crossover. Theoretical bounds describe growth; constants, runtime startup exclusion, allocation, and small-input behavior affect measurements.`
    : "Scaling behavior could not be measured on common successful inputs; only the separate theoretical derivations are available.";
  const tradeoffs: string[] = [];
  if (timeWinner !== "unknown" && spaceWinner !== "unknown" && timeWinner !== "tie" && spaceWinner !== "tie" && timeWinner !== spaceWinner) {
    tradeoffs.push(`${timeWinner} has the asymptotic time advantage, while ${spaceWinner} has the auxiliary-space advantage; there is no absolute winner without a resource priority.`);
  }
  if (benchmarkWinner !== "unknown" && timeWinner !== "unknown" && benchmarkWinner !== timeWinner && benchmarkWinner !== "tie" && timeWinner !== "tie") {
    tradeoffs.push("The empirical leader differs from the worst-case asymptotic leader at the measured size; constants and input conditions matter.");
  }
  if (a.space.inPlace !== b.space.inPlace) tradeoffs.push(`${a.space.inPlace === true ? "A" : "B"} mutates its input in the certified implementation; use a copy if callers need the original data.`);
  if (equivalence.status === "empirical") tradeoffs.push("Equivalence is only experimental here. Do not substitute this verdict for a proof in safety- or correctness-critical use.");
  if (equivalence.status === "not-equivalent") tradeoffs.push("The implementations are not interchangeable even if one is consistently faster; select by required behavior first.");
  let recommendation: string;
  if (equivalence.status === "not-equivalent" || sameProblem === "no") {
    recommendation = "Choose according to the required computational contract, not benchmark rank. These algorithms are not drop-in substitutes; the detailed purpose and counterexample sections explain the behavioral distinction.";
  } else if (equivalence.status === "inconclusive") {
    recommendation = "Do not replace one implementation with the other yet. Add a precise shared contract, supported entry points, and representative tests; a formal certificate requires a reviewed proof, not more confidence wording.";
  } else if (timeWinner !== "unknown" && timeWinner !== "tie" && spaceWinner !== "unknown" && spaceWinner !== "tie" && timeWinner !== spaceWinner) {
    recommendation = `For large inputs where running time dominates, prefer ${timeWinner}; when auxiliary memory or in-place operation is the hard constraint, prefer ${spaceWinner}. Validate the target workload with the benchmark controls before deployment.`;
  } else if (timeWinner === "A" || timeWinner === "B") {
    recommendation = `Prefer ${timeWinner} for asymptotically demanding instances under the stated assumptions. Reconsider only when a measured small-input, memory, or implementation constraint is more important.`;
  } else if (spaceWinner === "A" || spaceWinner === "B") {
    recommendation = `Their worst-case time growth is comparable at the reported precision; prefer ${spaceWinner} when auxiliary memory is the deciding constraint, and use measured workload data to break remaining ties.`;
  } else {
    recommendation = "No category establishes a universal winner. Use the equivalence assumptions, best/average/worst rows, memory semantics, and measured ranges to select for your workload.";
  }
  return {
    sameProblem,
    equivalenceAnswer: equivalence.status === "not-equivalent" ? "No. At least one contract difference or concrete behavioral witness prevents equivalent-output substitution." : equivalence.status === "inconclusive" ? "Unknown. The available proof and execution evidence are insufficient." : `Under the stated test/proof scope, their returned outputs agree; this does not erase differences in preconditions, mutation, or resource use.`,
    proofAnswer: equivalence.status === "proven" ? "Formally established by the displayed scoped certificate for exact reviewed templates. Tests are supplementary." : equivalence.status === "empirical" ? "Only tested experimentally. No formal proof is claimed." : equivalence.status === "not-equivalent" ? "No equivalence proof applies; a counterexample or distinct contract rejects the claim." : "Neither a valid proof nor adequate experimental evidence is available.",
    timeWinner, spaceWinner, benchmarkWinner, timeAnswer, spaceAnswer, benchmarkAnswer, scalingAnswer, recommendation, tradeoffs,
  };
}

function distinctPurpose(a: StaticAnalysis, b: StaticAnalysis): boolean {
  return a.problem !== "unknown" && b.problem !== "unknown" && a.problem !== b.problem;
}

export async function analyzeAndCompare(inputs: { a: AlgorithmInput; b: AlgorithmInput }, options: AnalysisOptions): Promise<ComparisonResult> {
  const a = analyzeAlgorithm(inputs.a);
  const b = analyzeAlgorithm(inputs.b);
  const [runnerA, runnerB] = await Promise.all([createRunner(inputs.a, a.certified), createRunner(inputs.b, b.certified)]);
  try {
    const equivalence = await testEquivalence(a, b, runnerA, runnerB, options.seed);
    const sharedProblem = a.problem === b.problem ? a.problem : "unknown";
    let benchmarks: ComparisonResult["benchmarks"];
    if (a.problem !== b.problem && a.problem !== "unknown" && b.problem !== "unknown") {
      const note = "The algorithms have different input contracts; no identical valid scaling workload exists, so benchmarks were not run.";
      benchmarks = { a: unavailableBenchmark(inputs.a, note), b: unavailableBenchmark(inputs.b, note) };
    } else {
      const benchmarkA = await runBenchmark(inputs.a, a, runnerA, options, sharedProblem);
      const benchmarkB = await runBenchmark(inputs.b, b, runnerB, options, sharedProblem);
      benchmarks = { a: benchmarkA, b: benchmarkB };
    }
    const report = generateReport(a, b, equivalence, benchmarks.a, benchmarks.b);
    return {
      createdAt: new Date().toISOString(), inputs, options, a, b, equivalence, benchmarks, report,
      environment: {
        runner: "Isolated native language child processes with internal solve-time instrumentation",
        isolation: "Private 0700 working directory, scrubbed environment, no shell, CPU/address-space/file/output limits, and hard wall-clock termination",
        networkPolicy: "Custom source executes only if a Linux network namespace is successfully created. Exact reviewed templates may run with source policy alone when the host denies namespace creation; this is explicitly not a universal hostile-code guarantee.",
        measuredAt: new Date().toISOString(),
        caveat: "The MVP runner should be deployed as a separate container or microVM service for hostile multi-tenant use. Empirical results describe this host only.",
      },
    };
  } finally {
    await Promise.all([runnerA.dispose(), runnerB.dispose()]);
  }
}
