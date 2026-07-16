import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
}, (table) => [uniqueIndex("members_slug_unique").on(table.slug)]);

export const updates = pgTable("updates", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
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
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
  title: varchar("title", { length: 160 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("To do"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  updatedBy: integer("updated_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const workspaceItems = pgTable("workspace_items", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
  section: varchar("section", { length: 20 }).notNull(),
  catalogueGroup: varchar("catalogue_group", { length: 20 }),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("To do"),
  merchImageUrl: text("merch_image_url"),
  merchImagePathname: text("merch_image_pathname"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  updatedBy: integer("updated_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
  filename: varchar("filename", { length: 255 }).notNull(),
  pathname: text("pathname").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [uniqueIndex("attachments_pathname_unique").on(table.pathname)]);

export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
  actorId: integer("actor_id").notNull().references(() => members.id),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: varchar("action", { length: 24 }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  authorId: integer("author_id").notNull().references(() => members.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [index("comments_brand_entity_created_idx").on(table.brand, table.entityType, table.entityId, table.createdAt)]);

export const commentReactions = pgTable("comment_reactions", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull(),
  commentId: integer("comment_id").notNull().references(() => comments.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("comment_reactions_comment_member_unique").on(table.commentId, table.memberId),
  index("comment_reactions_brand_comment_created_idx").on(table.brand, table.commentId, table.createdAt),
]);
