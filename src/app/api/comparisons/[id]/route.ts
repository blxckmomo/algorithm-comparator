import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comparisons } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid comparison id." }, { status: 400 });
  try {
    const [row] = await db.select().from(comparisons).where(eq(comparisons.id, id)).limit(1);
    if (!row) return Response.json({ error: "Comparison not found." }, { status: 404 });
    return Response.json({ ...row.result, id: row.id, createdAt: row.createdAt.toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load comparison." }, { status: 500 });
  }
}
