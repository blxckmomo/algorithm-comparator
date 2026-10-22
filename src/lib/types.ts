export type Language = "python" | "cpp" | "java";
export type ProblemKind = "search" | "sort" | "graph-traversal" | "mst" | "unknown";
export type EquivalenceStatus = "proven" | "empirical" | "not-equivalent" | "inconclusive";
export type BenchmarkScenario = "worst" | "random" | "best";

export interface AlgorithmInput {
  code: string;
  language: Language;
  libraryId?: string | null;
  name?: string;
}

export interface AnalysisOptions {
  sizes: number[];
  repeats: number;
  scenario: BenchmarkScenario;
  seed: number;
  runBenchmarks: boolean;
}

export interface CodeEvidence {
  line: number;
  kind: "loop" | "nested-loop" | "recursion" | "allocation" | "mutation" | "early-exit" | "graph" | "operation";
  source: string;
  note: string;
}

export interface TimeAnalysis {
  best: string;
  average: string;
  worst: string;
  bigO: string;
  bigOmega: string;
  bigTheta: string;
  variables: string[];
  averageModel: string;
  derivation: string;
  basis: "certified-template" | "static-derivation" | "insufficient";
  worstRank: number | null;
  limitations: string[];
}

export interface SpaceAnalysis {
  total: string;
  auxiliary: string;
  inputStorage: string;
  recursionStack: string;
  inPlace: boolean | "unknown";
  structures: string[];
  derivation: string;
  basis: "certified-template" | "static-derivation" | "insufficient";
  auxiliaryRank: number | null;
}

export interface StaticAnalysis {
  name: string;
  purpose: string;
  problem: ProblemKind;
  inputContract: string;
  outputContract: string;
  assumptions: string[];
  certified: boolean;
  libraryId?: string;
  time: TimeAnalysis;
  space: SpaceAnalysis;
  evidence: CodeEvidence[];
  unsupported: string[];
}

export interface TestCaseResult {
  name: string;
  category: "normal" | "edge" | "boundary" | "randomized";
  input: unknown;
  outputA?: unknown;
  outputB?: unknown;
  errorA?: string;
  errorB?: string;
  outcome: "match" | "mismatch" | "both-failed" | "unavailable";
  note: string;
}

export interface ProofCertificate {
  statement: string;
  assumptions: string[];
  lemmas: string[];
  scope: string;
}

export interface EquivalenceResult {
  status: EquivalenceStatus;
  title: string;
  summary: string;
  reasoning: string[];
  assumptions: string[];
  testsRun: number;
  validPairs: number;
  mismatches: number;
  cases: TestCaseResult[];
  proof?: ProofCertificate;
  limitations: string[];
}

export interface BenchmarkRun {
  iteration: number;
  milliseconds: number;
  memoryKiB: number | null;
}

export interface BenchmarkPoint {
  size: number;
  variables: Record<string, number>;
  medianMs: number;
  minMs: number;
  maxMs: number;
  memoryKiB: number | null;
  runs: BenchmarkRun[];
}

export interface BenchmarkResult {
  status: "ok" | "unavailable" | "failed";
  language: Language;
  runtime: string;
  points: BenchmarkPoint[];
  note: string;
  conditions: string[];
}

export interface FinalReport {
  sameProblem: "yes" | "no" | "unknown";
  equivalenceAnswer: string;
  proofAnswer: string;
  timeWinner: "A" | "B" | "tie" | "unknown";
  spaceWinner: "A" | "B" | "tie" | "unknown";
  benchmarkWinner: "A" | "B" | "tie" | "unknown";
  timeAnswer: string;
  spaceAnswer: string;
  benchmarkAnswer: string;
  scalingAnswer: string;
  recommendation: string;
  tradeoffs: string[];
}

export interface ComparisonResult {
  id?: string;
  createdAt: string;
  inputs: { a: AlgorithmInput; b: AlgorithmInput };
  options: AnalysisOptions;
  a: StaticAnalysis;
  b: StaticAnalysis;
  equivalence: EquivalenceResult;
  benchmarks: { a: BenchmarkResult; b: BenchmarkResult };
  report: FinalReport;
  environment: {
    runner: string;
    isolation: string;
    networkPolicy: string;
    measuredAt: string;
    caveat: string;
  };
}

export interface ComparisonRecordSummary {
  id: string;
  createdAt: string;
  nameA: string;
  nameB: string;
  languageA: Language;
  languageB: Language;
  status: EquivalenceStatus;
}
