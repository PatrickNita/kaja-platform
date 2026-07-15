import { integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
}, (table) => [uniqueIndex("members_slug_unique").on(table.slug)]);

export const updates = pgTable("updates", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  createdBy: integer("created_by").notNull().references(() => members.id),
  updatedBy: integer("updated_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("To do"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  updatedBy: integer("updated_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull().references(() => members.id),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: varchar("action", { length: 24 }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
