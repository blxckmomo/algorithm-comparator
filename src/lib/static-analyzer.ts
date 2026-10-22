import { algorithmLibrary, libraryById } from "./library";
import type { AlgorithmInput, CodeEvidence, ProblemKind, SpaceAnalysis, StaticAnalysis, TimeAnalysis } from "./types";

function canonicalize(code: string, language: AlgorithmInput["language"]): string {
  const lines = code.replace(/\r/g, "").split("\n").map((line) => line.replace(/\t/g, "    ").trimEnd());
  if (language === "python") {
    return lines.filter((line) => line.trim() && !line.trimStart().startsWith("#")).join("\n").trim();
  }
  return lines
    .filter((line) => line.trim() && !line.trimStart().startsWith("//"))
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .trim();
}

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

export function extractEvidence(code: string): CodeEvidence[] {
  const lines = code.replace(/\r/g, "").split("\n");
  const evidence: CodeEvidence[] = [];
  const activeLoops: { indent: number }[] = [];
  const declarations: { name: string; index: number }[] = [];
  for (const [index, line] of lines.entries()) {
    const patterns = [
      /^\s*def\s+([A-Za-z_]\w*)/,
      /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>, ?[\]]+)\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{?/,
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && !["if", "for", "while", "switch", "return"].includes(match[1])) declarations.push({ name: match[1], index });
    }
  }
  const recursiveNames = new Set<string>();
  for (const declaration of declarations) {
    const body: string[] = [];
    if (/^\s*def\s+/.test(lines[declaration.index])) {
      const parentIndent = indentation(lines[declaration.index]);
      for (let index = declaration.index + 1; index < lines.length; index += 1) {
        if (lines[index].trim() && indentation(lines[index]) <= parentIndent) break;
        body.push(lines[index]);
      }
    } else {
      let depth = 0;
      let opened = false;
      for (let index = declaration.index; index < lines.length; index += 1) {
        if (index > declaration.index) body.push(lines[index]);
        for (const character of lines[index]) {
          if (character === "{") { depth += 1; opened = true; }
          if (character === "}") depth -= 1;
        }
        if (opened && depth === 0) break;
      }
    }
    const call = new RegExp(`\\b${declaration.name}\\s*\\(`);
    if (body.some((line) => call.test(line))) recursiveNames.add(declaration.name);
  }

  lines.forEach((line, index) => {
    const source = line.trim();
    if (!source) return;
    const isLoop = /^(for|while)\b/.test(source) || /\b(for|while)\s*\(/.test(source);
    if (isLoop) {
      const indent = indentation(line);
      while (activeLoops.length && indent <= activeLoops[activeLoops.length - 1].indent) activeLoops.pop();
      const depth = activeLoops.length + 1;
      evidence.push({
        line: index + 1,
        kind: depth > 1 ? "nested-loop" : "loop",
        source,
        note: depth > 1 ? `Lexically nested at loop depth ${depth}; its iteration bound must be included in the derivation.` : "A visible iteration construct; its bound and body determine the work growth.",
      });
      activeLoops.push({ indent });
    }
    if (/\b(return|break)\b/.test(source) && activeLoops.length) {
      evidence.push({ line: index + 1, kind: "early-exit", source, note: "An early exit can improve best-case or data-dependent running time, but does not by itself improve the worst case." });
    }
    if (/(\[[^\]]+\]\s*=[^=]|\.set\s*\(|std::swap|\bswap\s*\(|\b[a-zA-Z_]\w*\[[^\]]+\],\s*[^=]+=)/.test(source)) {
      evidence.push({ line: index + 1, kind: "mutation", source, note: "An indexed write or swap suggests mutation; certified profiles determine whether the mutated object is the caller's input." });
    }
    if (/(new\s+[A-Za-z]|\blist\(|\bset\(|merged\s*=\s*\[\]|reserve\s*\(|push_back|append\s*\(|ArrayDeque|PriorityQueue)/.test(source)) {
      evidence.push({ line: index + 1, kind: "allocation", source, note: "Input-dependent allocation or container growth can contribute to auxiliary memory; capacity and lifetime determine the bound." });
    }
    if (/\b(adj|edges|vertices|vertex)\b/.test(source) && evidence.filter((item) => item.kind === "graph").length < 3) {
      evidence.push({ line: index + 1, kind: "graph", source, note: "Graph-related state detected. Complexity must distinguish vertices V, edges E, and the graph representation." });
    }
    for (const name of recursiveNames) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(source)) {
        evidence.push({ line: index + 1, kind: "recursion", source, note: `Self-call inside ${name}; its recurrence and maximum active stack depth influence time and auxiliary space.` });
        break;
      }
    }
  });
  return evidence.slice(0, 36);
}

function inferProblem(code: string): { problem: ProblemKind; purpose: string; input: string; output: string } {
  const lower = code.toLowerCase();
  if (/\bedges\b/.test(lower) && /(mst|kruskal|prim|parent|in_tree|intree|minimum)/.test(lower)) {
    return { problem: "mst", purpose: "Heuristic classification: appears to compute a minimum-spanning-tree quantity from an edge list.", input: "Expected graph object with v and edges; this contract is inferred, not verified.", output: "Output contract is not statically established." };
  }
  if (/\badj\b/.test(lower) && /\bsource\b/.test(lower)) {
    return { problem: "graph-traversal", purpose: "Heuristic classification: appears to traverse a graph from a source vertex.", input: "Expected { adj, source } with V vertices and E adjacency entries; inferred from identifiers.", output: "Traversal result contract is not statically established." };
  }
  if (/\btarget\b/.test(lower) && /\barr\b/.test(lower)) {
    return { problem: "search", purpose: "Heuristic classification: appears to search an array for a target.", input: "Expected { arr, target }; ordering and duplicate semantics are not established.", output: "Index, Boolean, or value semantics must be established by execution or documentation." };
  }
  if (/\barr\b/.test(lower) && /(sort|swap|pivot|merge|insertion|bubble)/.test(lower)) {
    return { problem: "sort", purpose: "Heuristic classification: appears to reorder an array, possibly into sorted order.", input: "Expected { arr }; key type and ordering are not established.", output: "Returned permutation and mutation behavior must be checked experimentally." };
  }
  return { problem: "unknown", purpose: "Purpose not established from the available source.", input: "No reliable input contract was inferred.", output: "No reliable output contract was inferred." };
}

const unknownTime = (limitations: string[]): TimeAnalysis => ({
  best: "Not established", average: "Not established — no explicit input distribution", worst: "Not established", bigO: "Not established", bigOmega: "Not established", bigTheta: "Not established",
  variables: ["Input-size variables could not be justified"], averageModel: "None supplied; an average-case bound would be unjustified.", derivation: "The source does not match a certified template and its visible control flow is insufficient for a sound asymptotic derivation.", basis: "insufficient" as const, worstRank: null, limitations,
});

const unknownSpace = (): SpaceAnalysis => ({
  total: "Not established", auxiliary: "Not established", inputStorage: "Input representation and ownership are not established", recursionStack: "Not established", inPlace: "unknown" as const,
  structures: ["Unresolved runtime and input allocations"], derivation: "No sound memory bound is issued without a certified template or sufficiently constrained visible operations.", basis: "insufficient" as const, auxiliaryRank: null,
});

export function analyzeAlgorithm(input: AlgorithmInput): StaticAnalysis {
  const canonical = canonicalize(input.code, input.language);
  const match = algorithmLibrary.find((candidate) => canonicalize(candidate.implementations[input.language], input.language) === canonical);
  const evidence = extractEvidence(input.code);
  if (match) {
    return {
      name: match.name, purpose: match.purpose, problem: match.problem, inputContract: match.inputContract, outputContract: match.outputContract,
      assumptions: match.assumptions, certified: true, libraryId: match.id, time: match.time, space: match.space, evidence,
      unsupported: [],
    };
  }

  const inferred = inferProblem(input.code);
  const unsupported: string[] = [];
  if (!/\bsolve\s*\(/.test(input.code)) unsupported.push("No recognizable solve entry point; execution will be unavailable.");
  if (/\b(eval|exec|compile|__import__|ProcessBuilder|Runtime\.getRuntime|\bsystem\s*\()\s*\(?/.test(input.code)) unsupported.push("Dynamic execution or host-process constructs are outside the analysis and execution policy.");
  if (!input.code.trim()) unsupported.push("The editor is empty.");

  const lines = input.code.split("\n");
  const loops = lines.filter((line) => /^\s*(for|while)\b/.test(line) || /\b(for|while)\s*\(/.test(line));
  const hasWhile = loops.some((line) => /\bwhile\b/.test(line));
  const helperNames = [...input.code.matchAll(/^\s*def\s+([A-Za-z_]\w*)/gm)].map((match) => match[1]).filter((name) => name !== "solve");
  const recursive = helperNames.some((name) => (input.code.match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? []).length > 1);
  if (hasWhile) unsupported.push("A while-loop bound is not inferred automatically; an explicit variant or certified template is required.");
  if (recursive) unsupported.push("Recursion detected; no recurrence is invented without a certified recurrence derivation.");

  let timeAnalysis = unknownTime(unsupported.length ? [...unsupported] : ["Only reviewed templates receive exact best/average/worst and Θ bounds."]);
  let spaceAnalysis = unknownSpace();
  const linearForLoops = loops.length > 0 && loops.every((line) => /\bfor\b/.test(line) && /(range\s*\(|len\s*\(|\.size\s*\(|\.length\b|:\s*(?:data|arr|a)\b)/.test(line));
  if (linearForLoops && !recursive && inferred.problem !== "graph-traversal" && inferred.problem !== "mst") {
    let depth = 0;
    const stack: number[] = [];
    for (const line of lines) {
      if (!(/^\s*for\b/.test(line) || /\bfor\s*\(/.test(line))) continue;
      const indent = indentation(line);
      while (stack.length && indent <= stack[stack.length - 1]) stack.pop();
      stack.push(indent);
      depth = Math.max(depth, stack.length);
    }
    const bound = depth === 1 ? "O(n)" : `O(n^${depth})`;
    timeAnalysis = {
      best: "Not established", average: "Not established — no explicit input distribution", worst: `${bound} structural upper bound`, bigO: `${bound} under stated structural assumptions`, bigOmega: "Not established", bigTheta: "Not established",
      variables: ["n = relevant input collection length"], averageModel: "No average-case bound issued because no probability model was supplied.",
      derivation: `Detected ${loops.length} for-loop(s) with maximum lexical nesting ${depth}, with bounds tied to an input collection. The upper bound assumes constant-time visible bodies and linear iteration counts; early exits do not weaken this upper bound.`,
      basis: "static-derivation", worstRank: depth === 1 ? 2 : depth === 2 ? 4 : 5,
      limitations: ["This is a structural upper bound, not a tight Θ result.", "Unseen runtime costs, overloaded operations, or nonstandard iteration semantics invalidate the derivation.", ...unsupported],
    };
    if (!evidence.some((item) => item.kind === "allocation")) {
      spaceAnalysis = {
        total: "Input storage + O(1) visible working state", auxiliary: "O(1) for visible scalar state", inputStorage: "Depends on the supplied input representation", recursionStack: "None detected", inPlace: evidence.some((item) => item.kind === "mutation") ? true : "unknown",
        structures: ["Input object", "Scalar loop state"], derivation: "No input-sized allocation or recursion was detected. This excludes costs inside unknown library or runtime operations.", basis: "static-derivation", auxiliaryRank: 0,
      };
    }
  }

  const requestedName = input.libraryId ? libraryById.get(input.libraryId)?.name : undefined;
  return {
    name: requestedName ? `${requestedName} (edited)` : input.name || "Custom algorithm",
    purpose: inferred.purpose, problem: inferred.problem, inputContract: inferred.input, outputContract: inferred.output,
    assumptions: ["No formal assumptions are certified for edited code; empirical cases use the inferred contract only."], certified: false,
    time: timeAnalysis, space: spaceAnalysis, evidence, unsupported,
  };
}
