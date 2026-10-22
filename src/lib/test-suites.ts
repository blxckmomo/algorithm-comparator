import type { BenchmarkScenario, ProblemKind } from "./types";

export interface GeneratedCase {
  name: string;
  category: "normal" | "edge" | "boundary" | "randomized";
  input: unknown;
}

export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function integer(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function generateTestSuite(problem: ProblemKind, seed = 1729): GeneratedCase[] {
  const random = rng(seed);
  if (problem === "search") {
    const randomArr = Array.from({ length: 23 }, () => integer(random, -8, 12)).sort((a, b) => a - b);
    return [
      { name: "Unique value in the middle", category: "normal", input: { arr: [1, 3, 5, 7, 9, 11], target: 7 } },
      { name: "First of many duplicates", category: "boundary", input: { arr: [2, 4, 4, 4, 4, 8], target: 4 } },
      { name: "Target absent between values", category: "normal", input: { arr: [1, 3, 5, 7], target: 4 } },
      { name: "Target below minimum", category: "boundary", input: { arr: [10, 20, 30], target: -1 } },
      { name: "Target above maximum", category: "boundary", input: { arr: [10, 20, 30], target: 99 } },
      { name: "Empty array", category: "edge", input: { arr: [], target: 5 } },
      { name: "Single matching element", category: "edge", input: { arr: [5], target: 5 } },
      { name: "Negative values and duplicates", category: "normal", input: { arr: [-9, -4, -4, 0, 2], target: -4 } },
      { name: "Seeded sorted array: present", category: "randomized", input: { arr: randomArr, target: randomArr[11] } },
      { name: "Seeded sorted array: absent", category: "randomized", input: { arr: randomArr, target: 100 } },
    ];
  }
  if (problem === "sort") {
    const randomArr = Array.from({ length: 26 }, () => integer(random, -30, 30));
    return [
      { name: "Ordinary unsorted values", category: "normal", input: { arr: [8, 3, 7, 1, 9, 2] } },
      { name: "Already sorted", category: "boundary", input: { arr: [1, 2, 3, 4, 5, 6] } },
      { name: "Reverse sorted", category: "boundary", input: { arr: [6, 5, 4, 3, 2, 1] } },
      { name: "Heavy duplicate counts", category: "edge", input: { arr: [4, 1, 4, 4, 0, 1, 0, 4] } },
      { name: "Negative and positive keys", category: "normal", input: { arr: [0, -8, 3, -2, 9, -8] } },
      { name: "Empty array", category: "edge", input: { arr: [] } },
      { name: "Single element", category: "edge", input: { arr: [42] } },
      { name: "Two inverted elements", category: "boundary", input: { arr: [2, 1] } },
      { name: "Seeded random permutation-like input", category: "randomized", input: { arr: randomArr } },
      { name: "Extreme safe integer magnitudes", category: "boundary", input: { arr: [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 0, 1] } },
    ];
  }
  if (problem === "graph-traversal") {
    const randomAdj: number[][] = Array.from({ length: 12 }, () => []);
    for (let u = 1; u < 12; u += 1) randomAdj[integer(random, 0, u - 1)].push(u);
    for (let i = 0; i < 10; i += 1) {
      const u = integer(random, 0, 11);
      const v = integer(random, 0, 11);
      if (u !== v) randomAdj[u].push(v);
    }
    return [
      { name: "Branching graph exposes visit order", category: "normal", input: { adj: [[1, 2], [3], [3, 4], [], []], source: 0 } },
      { name: "Isolated source", category: "edge", input: { adj: [[], [0], []], source: 0 } },
      { name: "Single vertex", category: "boundary", input: { adj: [[]], source: 0 } },
      { name: "Directed chain", category: "boundary", input: { adj: [[1], [2], [3], []], source: 0 } },
      { name: "Cycle with cross edge", category: "normal", input: { adj: [[1, 2], [2, 3], [0, 3], [1]], source: 0 } },
      { name: "Disconnected component", category: "edge", input: { adj: [[1], [], [3], []], source: 2 } },
      { name: "Self loop", category: "edge", input: { adj: [[0, 1], [1]], source: 0 } },
      { name: "Seeded directed graph", category: "randomized", input: { adj: randomAdj, source: 0 } },
    ];
  }
  if (problem === "mst") {
    const v = 11;
    const edges: number[][] = [];
    for (let vertex = 1; vertex < v; vertex += 1) edges.push([integer(random, 0, vertex - 1), vertex, integer(random, -8, 30)]);
    for (let i = 0; i < 15; i += 1) {
      const u = integer(random, 0, v - 1);
      const w = integer(random, 0, v - 1);
      if (u !== w) edges.push([u, w, integer(random, -8, 30)]);
    }
    return [
      { name: "Connected weighted graph", category: "normal", input: { v: 5, edges: [[0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5], [3, 4, 3]], start: 0 } },
      { name: "Single vertex tree", category: "boundary", input: { v: 1, edges: [], start: 0 } },
      { name: "Two vertices", category: "edge", input: { v: 2, edges: [[0, 1, 7]], start: 0 } },
      { name: "Equal-weight triangle", category: "boundary", input: { v: 3, edges: [[0, 1, 2], [1, 2, 2], [0, 2, 2]], start: 0 } },
      { name: "Negative edge weights", category: "normal", input: { v: 4, edges: [[0, 1, -5], [1, 2, 2], [0, 2, -1], [2, 3, 4], [1, 3, 8]], start: 0 } },
      { name: "Parallel edges", category: "edge", input: { v: 3, edges: [[0, 1, 9], [0, 1, 2], [1, 2, 3], [0, 2, 20]], start: 0 } },
      { name: "Disconnected graph error contract", category: "edge", input: { v: 4, edges: [[0, 1, 1], [2, 3, 1]], start: 0 } },
      { name: "Seeded connected sparse graph", category: "randomized", input: { v, edges, start: 0 } },
    ];
  }
  return [
    { name: "Null probe", category: "edge", input: null },
    { name: "Zero probe", category: "boundary", input: 0 },
    { name: "Positive integer probe", category: "normal", input: 7 },
    { name: "Empty array object probe", category: "edge", input: { arr: [] } },
    { name: "Small array object probe", category: "normal", input: { arr: [3, 1, 2] } },
  ];
}

export function generateBenchmarkInput(problem: ProblemKind, size: number, scenario: BenchmarkScenario, seed: number): { input: unknown; variables: Record<string, number> } {
  const random = rng(seed);
  const n = Math.max(1, Math.floor(size));
  if (problem === "search") {
    const arr = Array.from({ length: n }, (_, i) => i * 2);
    const target = scenario === "best" ? 0 : scenario === "worst" ? n * 2 + 1 : arr[integer(random, 0, n - 1)];
    return { input: { arr, target }, variables: { n } };
  }
  if (problem === "sort") {
    const arr = Array.from({ length: n }, (_, i) => scenario === "best" ? i : scenario === "worst" ? n - i : integer(random, -n * 4, n * 4));
    return { input: { arr }, variables: { n } };
  }
  if (problem === "graph-traversal") {
    const adj: number[][] = Array.from({ length: n }, () => []);
    if (scenario !== "best") {
      for (let v = 1; v < n; v += 1) adj[scenario === "worst" ? v - 1 : integer(random, 0, v - 1)].push(v);
      const extras = scenario === "worst" ? n * 3 : n;
      for (let i = 0; i < extras; i += 1) {
        const u = integer(random, 0, n - 1);
        const v = integer(random, 0, n - 1);
        if (u !== v) adj[u].push(v);
      }
    }
    const e = adj.reduce((sum, neighbors) => sum + neighbors.length, 0);
    return { input: { adj, source: 0 }, variables: { V: n, E: e } };
  }
  if (problem === "mst") {
    const edges: number[][] = [];
    for (let v = 1; v < n; v += 1) {
      const u = scenario === "best" ? v - 1 : integer(random, 0, v - 1);
      edges.push([u, v, scenario === "best" ? v : integer(random, -n, n * 3)]);
    }
    if (scenario !== "best") {
      const extras = scenario === "worst" ? n * 4 : n * 2;
      for (let i = 0; i < extras; i += 1) {
        const u = integer(random, 0, n - 1);
        const v = integer(random, 0, n - 1);
        if (u !== v) edges.push([u, v, integer(random, -n, n * 3)]);
      }
    }
    return { input: { v: n, edges, start: 0 }, variables: { V: n, E: edges.length } };
  }
  const arr = Array.from({ length: n }, () => integer(random, -n, n));
  return { input: { arr }, variables: { n } };
}
