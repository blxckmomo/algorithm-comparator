import { db } from "@/db";
import { comparisons } from "@/db/schema";
import { analyzeAndCompare } from "@/lib/analysis-service";
import type { AlgorithmInput, AnalysisOptions, Language } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseAlgorithm(value: unknown): AlgorithmInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.code !== "string" || candidate.code.length > 50_000) return null;
  if (!["python", "cpp", "java"].includes(String(candidate.language))) return null;
  return {
    code: candidate.code,
    language: candidate.language as Language,
    libraryId: typeof candidate.libraryId === "string" ? candidate.libraryId : null,
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 100) : undefined,
  };
}

function parseOptions(value: unknown): AnalysisOptions {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const sizes = Array.isArray(candidate.sizes)
    ? candidate.sizes.filter((size): size is number => typeof size === "number" && Number.isInteger(size) && size >= 1 && size <= 2048).slice(0, 5)
    : [];
  return {
    sizes: [...new Set(sizes.length ? sizes : [16, 64, 256, 1024])].sort((a, b) => a - b),
    repeats: typeof candidate.repeats === "number" ? Math.max(1, Math.min(5, Math.floor(candidate.repeats))) : 3,
    scenario: candidate.scenario === "best" || candidate.scenario === "worst" ? candidate.scenario : "random",
    seed: typeof candidate.seed === "number" && Number.isInteger(candidate.seed) ? candidate.seed : 1729,
    runBenchmarks: candidate.runBenchmarks !== false,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { a?: unknown; b?: unknown; options?: unknown };
    const a = parseAlgorithm(body.a);
    const b = parseAlgorithm(body.b);
    if (!a || !b) return Response.json({ error: "Two algorithms with valid languages and source strings of at most 50,000 characters are required." }, { status: 400 });
    const result = await analyzeAndCompare({ a, b }, parseOptions(body.options));
    try {
      const [saved] = await db.insert(comparisons).values({
        nameA: result.a.name,
        nameB: result.b.name,
        languageA: a.language,
        languageB: b.language,
        status: result.equivalence.status,
        result,
      }).returning({ id: comparisons.id });
      result.id = saved.id;
    } catch (error) {
      return Response.json({ ...result, persistenceWarning: `Analysis completed, but the PostgreSQL snapshot could not be saved: ${error instanceof Error ? error.message : "unknown database error"}` });
    }
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Analysis failed unexpectedly." }, { status: 500 });
  }
}
