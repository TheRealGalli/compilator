import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  planTier: text("plan_tier", { enum: ['free', 'pro', 'enterprise'] }).default('free').notNull(),
  usageMetrics: jsonb("usage_metrics").$type<{ total_compilations: number, last_reset: string }>().default({ total_compilations: 0, last_reset: new Date().toISOString() }),
  subscriptionStatus: text("subscription_status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  googleId: true,
  avatarUrl: true,
  planTier: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
