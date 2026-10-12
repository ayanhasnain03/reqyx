import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const waitlist = pgTable("waitlist", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("landing"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
