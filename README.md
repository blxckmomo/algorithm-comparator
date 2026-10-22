# Proofwork — Algorithm Analysis and Comparison Platform

Proofwork compares two algorithms through four independent evidence layers:

1. **Static analysis** identifies exact reviewed templates, loops, nesting, recursion, allocations, mutations, graph inputs, and supported structural bounds.
2. **Functional equivalence** executes identical JSON inputs where possible, reports concrete counterexamples, and distinguishes scoped proof from finite experimental evidence.
3. **Time and space analysis** reports best/average/worst time, O/Ω/Θ, input variables, average-case models, total vs. auxiliary space, input ownership, recursion stacks, and derivations.
4. **Empirical benchmarking** uses fresh isolated processes, repeated generated inputs, internal solve-time instrumentation, runtime memory metrics, interactive charts, and recorded conditions.

The initial library contains Linear Search, lower-bound Binary Search, Bubble Sort, Insertion Sort, Merge Sort, Quick Sort, BFS, DFS, Prim's MST, and Kruskal's MST. Every algorithm has Python, C++17, and Java implementations and a shared mathematical contract.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- CodeMirror 6 language modes and syntax highlighting
- Motion for scroll and interface transitions; custom responsive SVG charts
- PostgreSQL with Drizzle ORM for complete comparison snapshots
- Native Python 3, g++ (C++17), and javac/java execution adapters
- Linux-oriented restricted-process runner using private directories, scrubbed environments, `setrlimit`, hard timeouts, output limits, and network namespaces when the host permits them

## Local setup

### Requirements

- Node.js 20 or newer and npm
- PostgreSQL 14 or newer
- Python 3 on `PATH` as `python3` (required by the execution supervisor)
- Optional for cross-language execution: `g++`, `javac`, and `java` on `PATH`

A missing C++ or Java toolchain produces an explicit unavailable/inconclusive execution result; static analysis and available-language results still work. No benchmark values are substituted for unavailable runs.

### Install and configure

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env`, for example:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Create the configured database if necessary, then apply the Drizzle schema:

```bash
npx drizzle-kit push
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`. Choose an authored example or load any two library algorithms, then select **Analyze & compare**.

Production validation and startup:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
npm run start
```

Health check: `GET /api/health`.

## Source entry-point contracts

The runner decodes one JSON value from standard input and passes it to `solve`. Timing starts after JSON decoding and ends before result serialization.

- **Python:** define `def solve(data):` and return a JSON-serializable value.
- **C++:** define `Json solve(Json& data)`. The harness provides `at(key)`, `array()`, `object()`, `integer()`, numeric constructors, and `Json(std::vector<long long>)`. The required standard library and JSON type are already included; user `#include` directives are blocked.
- **Java:** declare `public class Algorithm` with `public static Object solve(Object data)`. JSON objects become `Map<String,Object>`, arrays become `List<Object>`, and integer numbers become `Long`. Only `java.util` imports are allowlisted.

Library input shapes:

```text
Search:    { "arr": [1, 2, 4], "target": 2 }       -> first index or -1
Sort:      { "arr": [3, 1, 2] }                    -> ascending array
Traversal: { "adj": [[1, 2], [], []], "source": 0 } -> visit order
MST:       { "v": 3, "edges": [[0,1,4],[1,2,2],[0,2,9]], "start": 0 } -> MST weight
```

For graph analysis, `V` is the vertex count and `E` is the edge or adjacency-entry count. Prim and Kruskal return **total MST weight**, not an edge set, so their proof remains valid when tied weights permit different trees.

## Verification semantics

- **Proven Equivalent:** both exact source texts match reviewed implementations with the same mathematical output contract. The report lists assumptions, lemmas, and scope. Editing certified source invalidates the certificate.
- **Empirically Equivalent:** all successfully paired shared-input runs agree, but no applicable proof certificate exists. This is not universal equivalence.
- **Not Equivalent:** at least one concrete behavioral/output witness differs, or the established computational contracts differ.
- **Inconclusive:** no proof applies and insufficient valid execution or static evidence exists.

The general equivalence problem is undecidable. Proofwork does not claim to solve it for arbitrary programs. Average-case bounds are omitted unless a distribution or explicit graph workload justifies them. Unsupported recurrences and unclear memory ownership remain “Not established.”

## Sandbox model and production deployment

User source is never evaluated inside the Next.js process. The server writes source to a private `0700` temporary directory and starts a separate supervisor process. The supervisor applies CPU, address-space, file-size, file-descriptor, and core-dump limits, removes inherited secrets from the child environment, and executes without a shell. Runs have hard wall-clock timeouts and stdout caps. It attempts `CLONE_NEWNET` before every compilation or execution.

**Important boundary:** if the host denies network-namespace creation, arbitrary custom code is not executed. Exact reviewed library templates can still run under source validation and process limits; the UI labels this fallback and does not describe it as a universal hostile-code guarantee. This MVP runner is not a substitute for a dedicated hostile multi-tenant sandbox.

For production, deploy the execution adapter as a separate service using one disposable container, gVisor sandbox, Firecracker microVM, or equivalent per job. Add a read-only root filesystem, a mounted empty tmpfs working directory, seccomp, cgroup CPU/memory/pids limits, dropped capabilities, no credentials, and an egress-denied network. Keep compilation inside the same isolation boundary. The web application should communicate with that service over a narrow authenticated job protocol.

Memory metrics are environment-specific: Python and C++ report Linux peak RSS (`ru_maxrss`, including runtime baseline); Java reports occupied JVM heap after `solve`. These are recorded as empirical environment measurements, not language-independent space-complexity proofs.

## Project modules

```text
src/components/           Live workbench, hero, editors, charts, result/report views
src/lib/static-analyzer.ts Exact-template certification and conservative static analysis
src/lib/analysis-service.ts Shared orchestration, verdicts, benchmarks, final report
src/lib/sandbox/          Process supervisor, JSON harnesses, validation and runners
src/lib/test-suites.ts    Shared edge/boundary/random cases and graph workload generation
src/lib/library.ts        Individually authored contracts, bounds, assumptions and proofs
src/lib/code/             Python, C++ and Java implementations
src/lib/report-export.ts  Markdown serialization from the same typed result
src/app/api/analyze/      Analysis endpoint and snapshot persistence
src/app/api/comparisons/  Recent and shareable snapshot endpoints
src/db/                   Drizzle client and PostgreSQL schema
```

Draft source and settings are kept in browser local storage. Completed analyses are inserted into PostgreSQL and receive a shareable `?comparison=<uuid>` URL. Markdown and JSON exports are generated from the same result object that drives every dashboard view.
