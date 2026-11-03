import { integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const reports = pgTable("reports", {
  noticeId: text("notice_id").primaryKey(),
  status: text("status").notNull(),
  noticeLanguage: text("notice_language"),
  buyerPlatform: text("buyer_platform"),
  facts: jsonb("facts"),
  signals: jsonb("signals").notNull().default([]),
  riskScore: integer("risk_score").notNull().default(0),
  summary: text("summary"),
  reppo: jsonb("reppo"),
  audit: jsonb("audit").notNull().default([]),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  droppedEvidence: integer("dropped_evidence").notNull().default(0),
  error: text("error"),
  progress: text("progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reppoQueue = pgTable("reppo_queue", {
  noticeId: text("notice_id").primaryKey(),
  enqueuedAt: timestamp("enqueued_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
});
