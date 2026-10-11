import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    avatarColor: text('avatar_color').notNull(),
    isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('users_username_unique').on(sql`lower(${t.username})`)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** sha256 of the session token; the raw token only lives in the cookie. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const boards = sqliteTable('boards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  /** File name of the uploaded wallpaper in DATA_DIR/backgrounds (a "-thumb" sibling exists). */
  backgroundImage: text('background_image'),
  archivedAt: integer('archived_at'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const columns = sqliteTable(
  'columns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: real('position').notNull(),
    isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
    /** Optional "#rrggbb" tint for the list. */
    color: text('color'),
  },
  (t) => [index('columns_board_idx').on(t.boardId)],
);

export const labels = sqliteTable(
  'labels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => [index('labels_board_idx').on(t.boardId)],
);

export const fields = sqliteTable(
  'fields',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['number', 'percent', 'currency', 'text', 'url', 'date'] }).notNull(),
    showOnFront: integer('show_on_front', { mode: 'boolean' }).notNull().default(false),
    totalMode: text('total_mode', { enum: ['sum', 'avg', 'none'] }).notNull(),
    position: real('position').notNull(),
  },
  (t) => [index('fields_board_idx').on(t.boardId)],
);

export const cards = sqliteTable(
  'cards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    columnId: integer('column_id')
      .notNull()
      .references(() => columns.id),
    title: text('title').notNull(),
    notes: text('notes').notNull().default(''),
    bannerColor: text('banner_color'),
    bannerText: text('banner_text').notNull().default(''),
    dayOfWeek: integer('day_of_week'),
    position: real('position').notNull(),
    dueAt: integer('due_at'),
    productUrl: text('product_url').notNull().default(''),
    archivedAt: integer('archived_at'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [index('cards_board_idx').on(t.boardId), index('cards_column_idx').on(t.columnId)],
);

export const cardLabels = sqliteTable(
  'card_labels',
  {
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    labelId: integer('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] }), index('card_labels_label_idx').on(t.labelId)],
);

export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    /** The video this comment is on. Null for older card-level comments (shown read-only). */
    videoId: integer('video_id').references((): AnySQLiteColumn => videos.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [index('comments_card_idx').on(t.cardId), index('comments_video_idx').on(t.videoId)],
);

export const videos = sqliteTable(
  'videos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull().default(''),
    author: text('author').notNull().default(''),
    thumbnailFile: text('thumbnail_file'),
    status: text('status', { enum: ['pending', 'ok', 'error'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    position: real('position').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [index('videos_card_idx').on(t.cardId)],
);

export const videoValues = sqliteTable(
  'video_values',
  {
    videoId: integer('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.fieldId] }), index('video_values_field_idx').on(t.fieldId)],
);
