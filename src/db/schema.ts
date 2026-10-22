import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { ComparisonResult, EquivalenceStatus, Language } from "@/lib/types";

export const comparisons = pgTable("algorithm_comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  nameA: text("name_a").notNull(),
  nameB: text("name_b").notNull(),
  languageA: varchar("language_a", { length: 16 }).$type<Language>().notNull(),
  languageB: varchar("language_b", { length: 16 }).$type<Language>().notNull(),
  status: varchar("status", { length: 32 }).$type<EquivalenceStatus>().notNull(),
  result: jsonb("result").$type<ComparisonResult>().notNull(),
});

export type ComparisonRow = typeof comparisons.$inferSelect;
