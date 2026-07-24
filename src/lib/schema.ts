import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

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
  body: text("body").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("To do"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  updatedBy: integer("updated_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const taskAssignees = pgTable("task_assignees", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => members.id),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: integer("completed_by").references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("task_assignees_task_member_unique").on(table.taskId, table.memberId),
  index("task_assignees_member_task_idx").on(table.memberId, table.taskId),
]);

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

export const workspaceItemImages = pgTable("workspace_item_images", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull(),
  itemId: integer("item_id").notNull().references(() => workspaceItems.id),
  pathname: text("pathname").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  uploadedBy: integer("uploaded_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("workspace_item_images_pathname_unique").on(table.pathname),
  index("workspace_item_images_brand_item_position_idx").on(table.brand, table.itemId, table.position),
]);

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
  title: text("title"),
  catalogueGroup: varchar("catalogue_group", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("activity_created_id_idx").on(table.createdAt.desc(), table.id.desc()),
  index("activity_brand_created_id_idx").on(table.brand, table.createdAt.desc(), table.id.desc()),
  uniqueIndex("activity_attention_entity_unique").on(table.brand, table.entityType, table.entityId).where(sql`${table.action} = 'attention_requested'`),
]);

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

export const entryReactions = pgTable("entry_reactions", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  reactionType: varchar("reaction_type", { length: 20 }).notNull(),
  memberId: integer("member_id").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("entry_reactions_entity_member_type_unique").on(table.brand, table.entityType, table.entityId, table.memberId, table.reactionType),
  index("entry_reactions_brand_entity_created_idx").on(table.brand, table.entityType, table.entityId, table.createdAt),
]);

export const telegramOutbox = pgTable("telegram_outbox", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").references(() => activity.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").notNull().references(() => members.id),
  memberName: varchar("member_name", { length: 64 }).notNull(),
  brand: varchar("brand", { length: 20 }).notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: varchar("action", { length: 24 }).notNull(),
  title: text("title").notNull(),
  catalogueGroup: varchar("catalogue_group", { length: 20 }),
  reactionType: varchar("reaction_type", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [
  index("telegram_outbox_actor_sent_created_idx").on(table.actorId, table.sentAt, table.createdAt),
  uniqueIndex("telegram_outbox_activity_unique").on(table.activityId).where(sql`${table.activityId} is not null`),
]);

export const telegramDebounce = pgTable("telegram_debounce", {
  actorId: integer("actor_id").primaryKey().references(() => members.id),
  generation: varchar("generation", { length: 64 }).notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  sentGeneration: varchar("sent_generation", { length: 64 }),
  processingGeneration: varchar("processing_generation", { length: 64 }),
  processingAt: timestamp("processing_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
