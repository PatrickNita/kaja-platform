import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, primaryKey, pgTable, serial, text, timestamp, uuid, uniqueIndex, varchar } from "drizzle-orm/pg-core";

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
  productName: varchar("product_name", { length: 160 }),
  flavor: varchar("flavor", { length: 200 }),
  feedbackId: uuid("feedback_id").defaultRandom().notNull().unique(),
  feedbackSlug: varchar("feedback_slug", { length: 200 }),
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
}, (table) => [uniqueIndex("workspace_items_brand_feedback_slug_unique").on(table.brand, table.feedbackSlug).where(sql`${table.feedbackSlug} is not null`)]);

export const productFeedback = pgTable("product_feedback", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => workspaceItems.id),
  body: text("body").notNull(),
  requestId: uuid("request_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("product_feedback_item_created_idx").on(table.itemId, table.createdAt.desc(), table.id.desc())]);

export const feedbackRateLimits = pgTable("feedback_rate_limits", {
  sourceHash: varchar("source_hash", { length: 64 }).primaryKey(),
  hits: integer("hits").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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

export const attachmentFolders = pgTable("attachment_folders", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }).notNull().default(""),
  published: boolean("published").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  brand: varchar("brand", { length: 20 }).notNull().default("kaja"),
  filename: varchar("filename", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 64 }).notNull().default("application/pdf"),
  folderId: integer("folder_id").references(() => attachmentFolders.id),
  pathname: text("pathname").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("attachments_pathname_unique").on(table.pathname),
  index("attachments_folder_idx").on(table.folderId),
  uniqueIndex("attachments_folder_filename_unique").on(table.folderId, table.filename).where(sql`${table.deletedAt} is null and ${table.folderId} is not null`),
]);

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


// B2B is isolated from the internal workspace catalogue and member sessions.
export const b2bAccessGroups = pgTable('b2b_access_groups', {
 id:serial('id').primaryKey(),contactKey:text('contact_key').notNull().unique(),tokenHash:varchar('token_hash',{length:64}).notNull().unique(),tokenCipher:text('token_cipher').notNull(),version:integer('version').notNull().default(1),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export const b2bLocations = pgTable('b2b_locations', {
 companyName:varchar('company_name',{length:160}),idno:varchar('idno',{length:32}),
 accessGroupId:integer('access_group_id').notNull().references(()=>b2bAccessGroups.id),
 id: serial('id').primaryKey(), name: varchar('name',{length:160}).notNull(), address: varchar('address',{length:500}).notNull(),
 contact: varchar('contact',{length:160}).notNull(), phone: varchar('phone',{length:40}).notNull(),
 tokenHash: varchar('token_hash',{length:64}).notNull().unique(), tokenCipher: text('token_cipher').notNull(),
 version: integer('version').notNull().default(1), detailsVersion: integer('details_version').notNull().default(1),
 createdBy: integer('created_by').notNull().references(()=>members.id), updatedBy: integer('updated_by').notNull().references(()=>members.id),
 createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(), updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const b2bProducts = pgTable('b2b_products', {
 id: integer('id').primaryKey(),name: varchar('name',{length:160}).notNull(),flavor:varchar('flavor',{length:160}).notNull(),
 grams:integer('grams').notNull().default(200),price:integer('price').notNull().default(40000),position:integer('position').notNull(),
 stock:integer('stock').notNull().default(100),stockVersion:integer('stock_version').notNull().default(1),
});
export const b2bOrders = pgTable('b2b_orders', {
 id:serial('id').primaryKey(),locationId:integer('location_id').notNull().references(()=>b2bLocations.id),
 locationSnapshot:jsonb('location_snapshot').notNull(),author:varchar('author',{length:160}).notNull(),authorMemberId:integer('author_member_id').references(()=>members.id),
 requestKey:uuid('request_key').notNull().unique(),status:varchar('status',{length:20}).notNull().default('placed'),version:integer('version').notNull().default(1),total:integer('total').notNull(),
 confirmedBy:integer('confirmed_by').references(()=>members.id),paidBy:integer('paid_by').references(()=>members.id),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),confirmedAt:timestamp('confirmed_at',{withTimezone:true}),paidAt:timestamp('paid_at',{withTimezone:true}),
},table=>[index('b2b_orders_location_created').on(table.locationId,table.createdAt.desc(),table.id.desc())]);
export const b2bOrderItems = pgTable('b2b_order_items', {
 orderId:integer('order_id').notNull().references(()=>b2bOrders.id),productId:integer('product_id').notNull().references(()=>b2bProducts.id),
 name:varchar('name',{length:160}).notNull(),flavor:varchar('flavor',{length:160}).notNull(),grams:integer('grams').notNull(),price:integer('price').notNull(),quantity:integer('quantity').notNull(),
},table=>[primaryKey({columns:[table.orderId,table.productId]})]);
export const b2bCashback = pgTable('b2b_cashback', {
 orderId:integer('order_id').primaryKey().references(()=>b2bOrders.id),locationId:integer('location_id').notNull().references(()=>b2bLocations.id),amount:integer('amount').notNull(),creditedBy:integer('credited_by').notNull().references(()=>members.id),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[index('b2b_cashback_location').on(table.locationId)]);

export const b2bNotifications = pgTable("b2b_notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => b2bOrders.id),
  orderVersion: integer("order_version").notNull(),
  payload: jsonb("payload").notNull(),
  sentParts: integer("sent_parts").notNull().default(0),
  sentAt: timestamp("sent_at", {withTimezone:true}),
  processingToken: uuid("processing_token"),
  processingAt: timestamp("processing_at", {withTimezone:true}),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
},table=>[
  uniqueIndex("b2b_notifications_order_version").on(table.orderId,table.orderVersion),
  index("b2b_notifications_pending_idx").on(table.id).where(sql`${table.sentAt} is null`),
]);

export const memberOrderSeen = pgTable("member_order_seen", {
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => b2bOrders.id, { onDelete: "cascade" }),
  seenVersion: integer("seen_version").notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.memberId, table.orderId] })]);
export const memberFeedbackSeen = pgTable("member_feedback_seen", {
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  feedbackId: integer("feedback_id").notNull().references(() => productFeedback.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.memberId, table.feedbackId] })]);
