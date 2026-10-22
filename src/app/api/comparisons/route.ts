import { desc } from "drizzle-orm";
import { db } from "@/db";
import { comparisons } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select({
      id: comparisons.id,
      createdAt: comparisons.createdAt,
      nameA: comparisons.nameA,
      nameB: comparisons.nameB,
      languageA: comparisons.languageA,
      languageB: comparisons.languageB,
      status: comparisons.status,
    }).from(comparisons).orderBy(desc(comparisons.createdAt)).limit(8);
    return Response.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load recent comparisons." }, { status: 500 });
  }
}
