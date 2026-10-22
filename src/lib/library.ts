import { cppImplementations } from "./code/cpp";
import { javaImplementations } from "./code/java";
import { pythonImplementations } from "./code/python";
import type { Language, ProblemKind, ProofCertificate, SpaceAnalysis, TimeAnalysis } from "./types";

export interface LibraryAlgorithm {
  id: string;
  name: string;
  shortName: string;
  problem: ProblemKind;
  family: string;
  summary: string;
  purpose: string;
  inputContract: string;
  outputContract: string;
  assumptions: string[];
  proofGroup: string;
  proof: ProofCertificate;
  time: TimeAnalysis;
  space: SpaceAnalysis;
  implementations: Record<Language, string>;
}

const time = (value: Omit<TimeAnalysis, "basis">): TimeAnalysis => ({ ...value, basis: "certified-template" });
const space = (value: Omit<SpaceAnalysis, "basis">): SpaceAnalysis => ({ ...value, basis: "certified-template" });
const implementations = (id: string): Record<Language, string> => ({
  python: pythonImplementations[id],
  cpp: cppImplementations[id],
  java: javaImplementations[id],
});

const sortAssumptions = ["Input is a JSON array of finite integer numbers.", "Ascending, non-decreasing order is the required output.", "Equality and ordering use ordinary integer comparisons."];
const sortSpaceInput = "The input array itself occupies Θ(n); output storage is counted separately from auxiliary working storage.";

export const algorithmLibrary: LibraryAlgorithm[] = [
  {
    id: "linear-search", name: "Linear Search", shortName: "Linear", problem: "search", family: "Search",
    summary: "Scan from left to right and return the first occurrence of a target.",
    purpose: "Find the first index of a target in an integer array, or return −1 when absent.",
    inputContract: "{ arr: integer[], target: integer }; the array need not be sorted.",
    outputContract: "The smallest index i with arr[i] = target, otherwise −1.", assumptions: ["The array is finite and indexable.", "The target and elements are integers."], proofGroup: "first-index-on-sorted-domain",
    proof: { statement: "Returns the first matching index, or −1 exactly when no match exists.", assumptions: ["Finite array", "Deterministic integer equality"], lemmas: ["Induction over the scan prefix shows that no earlier element matches when index i is reached.", "A return at i witnesses a match and the loop invariant proves it is the first; exhausting the array proves absence."], scope: "On a sorted common domain this contract is equivalent to the certified lower-bound binary search." },
    time: time({ best: "Θ(1)", average: "Θ(n)", worst: "Θ(n)", bigO: "O(n)", bigOmega: "Ω(n) worst-case", bigTheta: "Θ(n) worst-case", variables: ["n = array length"], averageModel: "Successful search in arrays with exactly one matching position, uniformly distributed among the n positions; the expected scan examines (n + 1) / 2 elements.", derivation: "The loop stops at the first match. One comparison suffices in the best case; an absent target or a match at the final position requires n comparisons.", worstRank: 2, limitations: ["The average excludes unsuccessful searches; including them requires a specified miss probability."] }),
    space: space({ total: "Θ(n)", auxiliary: "Θ(1)", inputStorage: "Θ(n) for the supplied array", recursionStack: "None", inPlace: false, structures: ["Input array", "Constant number of indices"], derivation: "No input-sized container is allocated. Total space includes the existing input; auxiliary space excludes it.", auxiliaryRank: 0 }),
    implementations: implementations("linear-search"),
  },
  {
    id: "binary-search", name: "Binary Search (lower bound)", shortName: "Binary", problem: "search", family: "Search",
    summary: "Lower-bound binary search that deliberately returns the first duplicate.",
    purpose: "Find the first index of a target in a sorted integer array, or return −1 when absent.",
    inputContract: "{ arr: integer[], target: integer }; arr must be sorted in non-decreasing order.",
    outputContract: "The smallest index i with arr[i] = target, otherwise −1.", assumptions: ["arr is sorted in non-decreasing order.", "The array is finite and supports indexed access."], proofGroup: "first-index-on-sorted-domain",
    proof: { statement: "Returns the first matching index, or −1 exactly when no match exists on sorted input.", assumptions: ["Non-decreasing array", "Integer ordering is transitive"], lemmas: ["The interval [lo, hi) always contains the lower bound; arr[mid] < target discards only indices before the first possible match.", "The interval shrinks each iteration and terminates at the lower bound; the final equality test distinguishes presence from absence."], scope: "Equivalent to linear search only when linear search is also restricted to sorted input; linear search itself accepts a larger domain." },
    time: time({ best: "Θ(log n) for n > 0", average: "Θ(log n)", worst: "Θ(log n)", bigO: "O(log n)", bigOmega: "Ω(log n) for n > 0", bigTheta: "Θ(log n) for n > 0", variables: ["n = array length"], averageModel: "Target present at a uniformly random position, including duplicates; the lower-bound search depth is logarithmic regardless of an early midpoint match.", derivation: "Each iteration halves the open interval and this lower-bound implementation does not return at a midpoint match. It therefore performs Θ(log n) iterations for every nonempty input; the empty input is a constant-time boundary case.", worstRank: 1, limitations: ["The bound requires sorted input; no behavioral or complexity claim is made for unsorted arrays."] }),
    space: space({ total: "Θ(n)", auxiliary: "Θ(1)", inputStorage: "Θ(n) for the supplied array", recursionStack: "None; the implementation is iterative", inPlace: false, structures: ["Input array", "Two interval boundaries and a midpoint"], derivation: "Only constant index state is maintained beyond the input.", auxiliaryRank: 0 }),
    implementations: implementations("binary-search"),
  },
  {
    id: "bubble-sort", name: "Bubble Sort (adaptive)", shortName: "Bubble", problem: "sort", family: "Sorting",
    summary: "Adjacent swaps with an early exit when a complete pass makes no swap.",
    purpose: "Sort an integer array into non-decreasing order by exchanging adjacent inversions.",
    inputContract: "{ arr: integer[] }", outputContract: "The same array object, mutated into non-decreasing order.", assumptions: sortAssumptions, proofGroup: "ascending-permutation",
    proof: { statement: "Returns a non-decreasing permutation of the input multiset.", assumptions: sortAssumptions, lemmas: ["Every swap exchanges adjacent entries, preserving the multiset.", "After each full pass the largest unsorted element reaches its final position; a pass without swaps proves every adjacent pair is ordered, hence the whole array is ordered."], scope: "Output equality with other certified sorting templates is extensional: the returned arrays contain the same values in the same order." },
    time: time({ best: "Θ(n)", average: "Θ(n²)", worst: "Θ(n²)", bigO: "O(n²)", bigOmega: "Ω(n)", bigTheta: "Θ(n²) worst-case", variables: ["n = array length"], averageModel: "A uniformly random permutation of n distinct keys has Θ(n²) inversions in expectation; adjacent-swap passes therefore take quadratic expected time.", derivation: "Pass k examines up to n − k adjacent pairs. The triangular sum is n(n − 1)/2; the swapped flag reduces an already sorted input to one pass.", worstRank: 4, limitations: ["The average model assumes distinct uniformly permuted keys; duplicate-heavy distributions need a separate model."] }),
    space: space({ total: "Θ(n)", auxiliary: "Θ(1)", inputStorage: sortSpaceInput, recursionStack: "None", inPlace: true, structures: ["Input array mutated in place", "Boolean flag and loop indices"], derivation: "Exchanges use constant temporary state and no auxiliary array is created.", auxiliaryRank: 0 }),
    implementations: implementations("bubble-sort"),
  },
  {
    id: "insertion-sort", name: "Insertion Sort", shortName: "Insertion", problem: "sort", family: "Sorting",
    summary: "Grow a sorted prefix by shifting larger entries one position right.",
    purpose: "Sort an integer array into non-decreasing order by inserting each entry into a sorted prefix.",
    inputContract: "{ arr: integer[] }", outputContract: "The same array object, mutated into non-decreasing order.", assumptions: sortAssumptions, proofGroup: "ascending-permutation",
    proof: { statement: "Returns a non-decreasing permutation of the input multiset.", assumptions: sortAssumptions, lemmas: ["Assignments only shift existing entries and finally place the saved current entry, preserving the multiset.", "The prefix [0, i) is sorted before iteration i; shifting larger entries and inserting the saved value establishes the invariant for i + 1."], scope: "The final sorted array is unique for a fixed integer multiset, so any certified ascending sorter has the same returned output." },
    time: time({ best: "Θ(n)", average: "Θ(n²)", worst: "Θ(n²)", bigO: "O(n²)", bigOmega: "Ω(n)", bigTheta: "Θ(n²) worst-case", variables: ["n = array length"], averageModel: "For a uniformly random permutation of distinct keys, each new element moves through Θ(i) positions on average, giving Θ(n²) expected shifts.", derivation: "The outer loop runs n − 1 times. The inner loop is skipped for sorted input but shifts up to i entries on reverse-sorted input; Σi is Θ(n²).", worstRank: 4, limitations: ["Average-case analysis depends on the stated permutation model, not on arbitrary real-world arrays."] }),
    space: space({ total: "Θ(n)", auxiliary: "Θ(1)", inputStorage: sortSpaceInput, recursionStack: "None", inPlace: true, structures: ["Input array mutated in place", "Saved value and indices"], derivation: "The sorted prefix resides in the input array and shifting needs only one saved value.", auxiliaryRank: 0 }),
    implementations: implementations("insertion-sort"),
  },
  {
    id: "merge-sort", name: "Merge Sort", shortName: "Merge", problem: "sort", family: "Sorting",
    summary: "Recursively sort halves and merge them with stable linear passes.",
    purpose: "Return a new non-decreasing array containing exactly the input values.",
    inputContract: "{ arr: integer[] }", outputContract: "A new sorted array; the supplied array is not modified.", assumptions: sortAssumptions, proofGroup: "ascending-permutation",
    proof: { statement: "Returns a non-decreasing permutation of the input multiset.", assumptions: sortAssumptions, lemmas: ["Splitting and concatenating preserve the multiset; the merge loop repeatedly takes the smallest available head, so its output is ordered.", "By induction on subarray length, both recursive results are sorted permutations; the merge lemma then establishes the result for their concatenation."], scope: "Although merge sort does not mutate its input, its returned value is extensionally equal to that of the certified in-place sorters." },
    time: time({ best: "Θ(n log n)", average: "Θ(n log n)", worst: "Θ(n log n)", bigO: "O(n log n)", bigOmega: "Ω(n log n)", bigTheta: "Θ(n log n)", variables: ["n = array length"], averageModel: "No probabilistic assumption is needed: every input follows the same recurrence apart from base cases.", derivation: "T(n) = 2T(n/2) + Θ(n), with Θ(1) base cost. There are Θ(log n) levels and Θ(n) merge work per level.", worstRank: 3, limitations: ["The Θ(n) slice/copy costs are included; this is not an in-place merge variant."] }),
    space: space({ total: "Θ(n)", auxiliary: "Θ(n)", inputStorage: sortSpaceInput, recursionStack: "Θ(log n) frames; simultaneous slice/merge buffers dominate at Θ(n)", inPlace: false, structures: ["Left/right slices", "Merged output arrays", "Recursion stack"], derivation: "The recurrence S(n) = S(n/2) + Θ(n) for live temporary storage gives Θ(n); recursion depth alone is only Θ(log n).", auxiliaryRank: 2 }),
    implementations: implementations("merge-sort"),
  },
  {
    id: "quick-sort", name: "Quick Sort (middle pivot)", shortName: "Quick", problem: "sort", family: "Sorting",
    summary: "In-place Hoare-style partitioning around the middle element.",
    purpose: "Sort the supplied integer array in place using recursive partitioning.",
    inputContract: "{ arr: integer[] }", outputContract: "The same array object, mutated into non-decreasing order.", assumptions: sortAssumptions, proofGroup: "ascending-permutation",
    proof: { statement: "Returns a non-decreasing permutation of the input multiset.", assumptions: sortAssumptions, lemmas: ["All mutations are swaps, so the multiset is invariant.", "After partitioning, entries in the left subproblem are no greater than entries in the right subproblem; induction on strictly smaller subranges proves both sides sorted."], scope: "The proof covers integer arrays and the exact terminating partition template; changing partition logic invalidates certification." },
    time: time({ best: "Θ(n log n)", average: "Θ(n log n)", worst: "Θ(n²)", bigO: "O(n²)", bigOmega: "Ω(n²) worst-case", bigTheta: "Θ(n²) worst-case; Θ(n log n) average", variables: ["n = array length"], averageModel: "For a uniformly random permutation of distinct keys, the middle-position pivot is a uniformly random rank; the standard quicksort recurrence gives Θ(n log n) expected time.", derivation: "A partition costs Θ(k). Balanced partitions yield T(n) = 2T(n/2) + Θ(n); repeatedly extremely unbalanced partitions yield T(n) = T(n − 1) + Θ(n) = Θ(n²).", worstRank: 4, limitations: ["Sorted input is not the worst case for this middle-pivot version; adversarial pivot patterns can still produce quadratic depth.", "Average-case is an expectation over input permutations, not a guarantee for every run."] }),
    space: space({ total: "Θ(n)", auxiliary: "O(n) worst; Θ(log n) average", inputStorage: sortSpaceInput, recursionStack: "O(n) worst-case frames; Θ(log n) for balanced recursion", inPlace: true, structures: ["Input array mutated in place", "Recursive frames and constant partition state"], derivation: "No auxiliary array is allocated. Worst-case recursion can be linear; expected balanced recursion is logarithmic under the same random-permutation model.", auxiliaryRank: 2 }),
    implementations: implementations("quick-sort"),
  },
  {
    id: "bfs", name: "Breadth-First Search", shortName: "BFS", problem: "graph-traversal", family: "Graph traversal",
    summary: "Visit reachable vertices in non-decreasing distance layers from a source.",
    purpose: "Return the breadth-first visitation order of all vertices reachable from source.",
    inputContract: "{ adj: integer[][], source: integer }; adj[u] lists outgoing neighbors, V = adj.length, E = total adjacency entries.",
    outputContract: "BFS visit order, with FIFO queue tie-breaking by adjacency-list order.", assumptions: ["Every neighbor is a valid vertex index.", "The source is a valid index.", "Adjacency order is part of the deterministic tie-breaking contract."], proofGroup: "bfs-order",
    proof: { statement: "Returns exactly the reachable vertices in FIFO breadth-first order.", assumptions: ["Valid adjacency list and source", "Deterministic neighbor order"], lemmas: ["A vertex is enqueued exactly once because it is marked when enqueued; every enqueued vertex has a witness path from source.", "FIFO processing establishes the distance-layer invariant; induction over the queue gives the specified BFS order."], scope: "This proves BFS semantics only. DFS has a different valid traversal order and is not output-equivalent in general." },
    time: time({ best: "O(V + E)", average: "Θ(V + E) for reachable-component exploration", worst: "Θ(V + E)", bigO: "O(V + E)", bigOmega: "Ω(1) if only an isolated source is visited", bigTheta: "Θ(V + E) when all vertices and edges are reachable", variables: ["V = vertex count", "E = adjacency-entry count", "Vᵣ, Eᵣ = reachable counts"], averageModel: "For a specified graph in which the reachable component has Vᵣ vertices and Eᵣ adjacency entries, running time is Θ(Vᵣ + Eᵣ); no random graph model is required.", derivation: "Each reachable vertex enters the FIFO queue once and each outgoing adjacency entry of a visited vertex is inspected once. An isolated source visits only one vertex.", worstRank: 2, limitations: ["V + E describes the reachable portion; JSON parsing outside solve is excluded from measured function time."] }),
    space: space({ total: "Θ(V + E)", auxiliary: "O(V)", inputStorage: "Θ(V + E) for the adjacency list", recursionStack: "None; a FIFO queue is used", inPlace: false, structures: ["Adjacency list (input)", "Visited set Θ(V)", "FIFO queue O(V)", "Output order O(V)"], derivation: "Queue and visited state hold each reachable vertex at most once. Total memory also includes the adjacency list; output storage is reported separately conceptually.", auxiliaryRank: 2 }),
    implementations: implementations("bfs"),
  },
  {
    id: "dfs", name: "Depth-First Search (recursive)", shortName: "DFS", problem: "graph-traversal", family: "Graph traversal",
    summary: "Follow each unvisited branch to completion before backtracking.",
    purpose: "Return the recursive depth-first preorder of all vertices reachable from source.",
    inputContract: "{ adj: integer[][], source: integer }; V = adj.length and E = total adjacency entries.",
    outputContract: "DFS preorder, using adjacency-list order to choose the next branch.", assumptions: ["Every neighbor and source is a valid vertex index.", "Recursion depth is supported by the runtime.", "Adjacency order determines sibling tie-breaking."], proofGroup: "dfs-order",
    proof: { statement: "Returns exactly the reachable vertices in recursive DFS preorder.", assumptions: ["Valid adjacency list and source", "Sufficient recursion stack"], lemmas: ["A vertex is visited exactly once because it is marked before its outgoing edges are explored; reachability follows by path induction.", "Appending on entry and recursively completing each unvisited neighbor is the definition of DFS preorder for the given adjacency order."], scope: "BFS and DFS both traverse a graph but have different output contracts; equal outputs on trees or special graphs do not imply general equivalence." },
    time: time({ best: "O(V + E)", average: "Θ(V + E) for reachable-component exploration", worst: "Θ(V + E)", bigO: "O(V + E)", bigOmega: "Ω(1) if only an isolated source is visited", bigTheta: "Θ(V + E) when the whole graph is reachable", variables: ["V = vertex count", "E = adjacency-entry count", "Vᵣ, Eᵣ = reachable counts"], averageModel: "Given the reachable component, each of its Vᵣ vertices and Eᵣ adjacency entries is processed once; no distributional averaging is needed.", derivation: "Recursive calls are guarded by the visited set. Each vertex is entered once and each outgoing adjacency entry is examined once.", worstRank: 2, limitations: ["A host recursion limit can make deep valid graphs fail even though the asymptotic bound holds."] }),
    space: space({ total: "Θ(V + E)", auxiliary: "O(V)", inputStorage: "Θ(V + E) for the adjacency list", recursionStack: "O(V) in a long path; Θ(1) beyond fixed frames for an isolated source", inPlace: false, structures: ["Adjacency list (input)", "Visited set Θ(V)", "Recursion stack O(V)", "Output order O(V)"], derivation: "The visited set and output grow with reachable vertices, and the call stack can contain one frame per vertex on a path.", auxiliaryRank: 2 }),
    implementations: implementations("dfs"),
  },
  {
    id: "prim", name: "Prim’s MST (lazy heap)", shortName: "Prim", problem: "mst", family: "Minimum spanning tree",
    summary: "Grow one tree using the cheapest crossing edge and a lazy priority queue.",
    purpose: "Compute the total weight of a minimum spanning tree of a connected undirected weighted graph.",
    inputContract: "{ v: integer, edges: [u, v, weight][], start?: integer }; edge list represents an undirected graph.",
    outputContract: "Integer minimum spanning tree weight; raises an error for a disconnected graph.", assumptions: ["The graph is undirected and connected.", "Vertices are numbered 0 through V − 1.", "Weights are finite integers; parallel edges and negative weights are allowed.", "No self-loop is needed for a minimum spanning tree."], proofGroup: "mst-total-weight",
    proof: { statement: "Returns the weight of some minimum spanning tree, which is the unique MST weight even when edge weights tie.", assumptions: ["Connected undirected finite graph", "Additive integer weights"], lemmas: ["Whenever the heap selects the cheapest edge crossing the cut between the current tree and the remaining vertices, the cut property guarantees some MST contains that edge.", "The algorithm accepts V − 1 such edges and their total is therefore the MST weight; all MSTs have this same weight by definition of optimality."], scope: "The certificate concerns total weight, not a particular edge set. Prim and Kruskal may choose different equally optimal trees." },
    time: time({ best: "O(E log E)", average: "O(E log E); Θ(E log E) for a comparison-heavy lazy heap workload", worst: "O(E log E) = O(E log V) for simple graphs", bigO: "O(E log E); O(E log V) on simple graphs", bigOmega: "Ω(E) to inspect the edge list", bigTheta: "Not a single Θ bound over all graph shapes; Θ(E log E) for a heap-dominated workload", variables: ["V = vertex count", "E = undirected edge count"], averageModel: "No random input distribution is used. The bound follows from at most 2E directed adjacency entries and O(E) lazy heap insertions; for simple graphs E ≤ V(V − 1)/2, so log E = O(log V).", derivation: "Building adjacency costs Θ(V + E). Each edge can cause a constant number of heap pushes, and each heap operation costs O(log E). The simpler O(E log V) form is valid for simple graphs.", worstRank: 3, limitations: ["With multigraphs or parallel edges, use O(E log E); the O(E log V) simplification assumes a simple graph.", "The returned value is weight only, not an MST edge list."] }),
    space: space({ total: "Θ(V + E)", auxiliary: "O(V + E)", inputStorage: "Θ(E) for the input edge list", recursionStack: "None", inPlace: false, structures: ["Input edge list", "Adjacency lists Θ(V + E)", "Lazy binary heap O(E)", "Visited flags Θ(V)"], derivation: "The adjacency representation stores two entries per undirected edge. Stale heap entries are not removed, so the heap can contain O(E), rather than only O(V), entries.", auxiliaryRank: 2 }),
    implementations: implementations("prim"),
  },
  {
    id: "kruskal", name: "Kruskal’s MST (union-find)", shortName: "Kruskal", problem: "mst", family: "Minimum spanning tree",
    summary: "Sort edges by weight and join components with union by size and path compression.",
    purpose: "Compute the total weight of a minimum spanning tree by accepting cheapest non-cycle edges.",
    inputContract: "{ v: integer, edges: [u, v, weight][] }; edge list represents an undirected graph.",
    outputContract: "Integer minimum spanning tree weight; raises an error for a disconnected graph.", assumptions: ["The graph is undirected and connected.", "Vertices are numbered 0 through V − 1.", "Weights are finite integers; ties and negative weights are allowed."], proofGroup: "mst-total-weight",
    proof: { statement: "Returns the common minimum spanning tree weight for a connected undirected graph.", assumptions: ["Connected undirected finite graph", "Additive integer weights"], lemmas: ["When an edge joins two components, it is a cheapest edge crossing that component cut; the cut property guarantees some MST contains it.", "Union-find rejects exactly edges whose endpoints are already connected, so V − 1 accepted edges form a spanning tree and the cut lemma proves minimality."], scope: "Equivalent to Prim for returned total weight. It does not assert that both implementations select identical edges when weights tie." },
    time: time({ best: "O(E log E)", average: "Θ(E log E) from sorting plus near-linear union-find work", worst: "O(E log E)", bigO: "O(E log E)", bigOmega: "Ω(E log E) for comparison sorting in the general case", bigTheta: "Θ(E log E) for general comparison-sorted input", variables: ["V = vertex count", "E = undirected edge count", "α(V) = inverse Ackermann function"], averageModel: "For a uniformly random ordering of distinct edge weights, general comparison sorting takes Θ(E log E) expected time. Union by size with path compression costs O(E α(V)) and does not dominate.", derivation: "Sorting E edges costs Θ(E log E) in the general comparison model. At most 2E finds and V − 1 unions cost O(E α(V)); for simple graphs E log E = Θ(E log V) up to constant factors in the exponent relation.", worstRank: 3, limitations: ["Early termination after V − 1 accepted edges can avoid scanning sorted edges but not the initial full sort in this template."] }),
    space: space({ total: "Θ(V + E)", auxiliary: "O(V + E)", inputStorage: "Θ(E) for the supplied edge list", recursionStack: "O(log V) with union by size before/amid path compression; dominated by edge storage", inPlace: false, structures: ["Sortable edge copy Θ(E)", "Parent and size arrays Θ(V)", "Find recursion stack O(log V)"], derivation: "The implementation materializes and sorts an edge list and maintains two vertex-indexed arrays. Sorting runtime internals may add implementation-dependent temporary storage.", auxiliaryRank: 2 }),
    implementations: implementations("kruskal"),
  },
];

export const libraryById = new Map(algorithmLibrary.map((algorithm) => [algorithm.id, algorithm]));

export const exampleComparisons = [
  { a: "binary-search", b: "linear-search", title: "Same answer, different search strategy", note: "A scoped proof on sorted arrays, including duplicate-aware first-index behavior." },
  { a: "bubble-sort", b: "merge-sort", title: "Quadratic in-place vs linearithmic buffered", note: "Equivalent sorted outputs with a clear asymptotic and memory trade-off." },
  { a: "quick-sort", b: "insertion-sort", title: "Small inputs can invert the ranking", note: "Compare worst-case guarantees with measured constants across input sizes." },
  { a: "bfs", b: "dfs", title: "Same traversal family, different output", note: "A concrete graph witness demonstrates why visitation order matters." },
  { a: "prim", b: "kruskal", title: "Equal MST weight, different constructions", note: "Proof covers total weight, not identity of a chosen tree under ties." },
  { a: "binary-search", b: "bubble-sort", title: "Different computational problems", note: "Contract analysis rejects equivalence independently of benchmark speed." },
] as const;

export function getImplementation(id: string, language: Language): string {
  return libraryById.get(id)?.implementations[language] ?? "";
}
