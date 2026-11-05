import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  partial: boolean("partial").notNull().default(false),
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

/** Active solicitations imported daily from the SAM.gov public extract (no API key needed). */
export const samNotices = pgTable("sam_notices", {
  noticeId: text("notice_id").primaryKey(),
  title: text("title").notNull(),
  solicitationNumber: text("solicitation_number"),
  agency: text("agency").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  responseDeadline: text("response_deadline"),
  responseDeadlineAt: timestamp("response_deadline_at", { withTimezone: true }),
  naics: text("naics"),
  setAside: text("set_aside"),
  link: text("link").notNull(),
  text: text("text").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});
