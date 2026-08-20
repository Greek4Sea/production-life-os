import {
  pgTable, text, boolean, integer, jsonb, timestamp, date, bigserial,
  doublePrecision, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// ---------- platform core ----------

// Single-user app: one row, holding the Google refresh token used by all sync jobs.
export const googleTokens = pgTable('google_tokens', {
  id: text('id').primaryKey().default('default'),
  email: text('email').notNull(),
  refreshToken: text('refresh_token').notNull(),
  scopes: text('scopes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Bearer tokens for non-browser clients (future personal-ai-v2).
export const apiTokens = pgTable('api_tokens', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moduleSettings = pgTable('module_settings', {
  moduleId: text('module_id').primaryKey(),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// THE spine: every module contributes its day-relevant items here.
export const dayItems = pgTable('day_items', {
  id: text('id').primaryKey(),
  date: date('date').notNull(),
  moduleId: text('module_id').notNull(),
  kind: text('kind').notNull(), // event | task | metric | note
  time: timestamp('time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  url: text('url'),
  payload: jsonb('payload'),
  status: text('status').notNull().default('pending'), // pending | done | skipped
  externalId: text('external_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('day_items_module_external').on(t.moduleId, t.externalId),
  index('day_items_date').on(t.date),
]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  url: text('url'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('scheduled'), // scheduled | sent | failed | canceled
  sentAt: timestamp('sent_at', { withTimezone: true }),
  dedupeKey: text('dedupe_key').unique(),
  readAt: timestamp('read_at', { withTimezone: true }), // in-app bell read state
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Append-only event log — the poll bus for the future AI (GET /api/events?since=<id>).
export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  moduleId: text('module_id').notNull(),
  type: text('type').notNull(),
  payload: jsonb('payload'),
});

export const syncState = pgTable('sync_state', {
  moduleId: text('module_id').primaryKey(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  cursor: jsonb('cursor'),
  lastError: text('last_error'),
});

// ---------- module: canvas ----------

export const canvasCourses = pgTable('mod_canvas_courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  grade: text('grade'),        // letter grade if available
  score: doublePrecision('score'), // percentage
  term: text('term'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const canvasAssignments = pgTable('mod_canvas_assignments', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  name: text('name').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  pointsPossible: doublePrecision('points_possible'),
  htmlUrl: text('html_url'),
  description: text('description'), // plain-text summary of the assignment
  submitted: boolean('submitted').notNull().default(false),
  muted: boolean('muted').notNull().default(false), // user chose to hide (smart filtering)
  score: doublePrecision('score'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('canvas_assignments_due').on(t.dueAt)]);

export const canvasAnnouncements = pgTable('mod_canvas_announcements', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  htmlUrl: text('html_url'),
});

// ---------- module: competitions (fencing) ----------
export const compEvents = pgTable('mod_comp_events', {
  uid: text('uid').primaryKey(), // sha1(source:key)[:16] — same scheme as the Python tracker
  name: text('name').notNull(),
  kind: text('kind').notNull(), // ROC | RJCC | NAC | ...
  ageCategory: text('age_category'),
  city: text('city'),
  state: text('state'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  regCloses: timestamp('reg_closes', { withTimezone: true }),
  url: text('url'),
  source: text('source').notNull(),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
}, (tb) => [index('comp_events_start').on(tb.startDate)]);

// My competition results + rating history, scraped monthly from
// fencingtracker.com by scripts/fencingtracker_scrape.py (GitHub Actions)
// and pushed to POST /api/fencing/ingest.
export const fencingResults = pgTable('mod_fencing_results', {
  uid: text('uid').primaryKey(), // sha1(date|tournament|event)[:16]
  date: date('date').notNull(),
  tournament: text('tournament').notNull(),
  event: text('event').notNull(),
  place: integer('place'),
  fieldSize: integer('field_size'),
  ratingEarned: text('rating_earned'),
  eventClass: text('event_class'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (tb) => [index('fencing_results_date').on(tb.date)]);

export const fencingRatings = pgTable('mod_fencing_ratings', {
  weapon: text('weapon').primaryKey(), // Épée | Foil | Saber
  rating: text('rating').notNull(),    // e.g. A26
  earnedAt: date('earned_at'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- module: fitness ----------
// An external fitness app pushes its daily numbers here (POST /api/fitness/ingest).
export const fitnessDays = pgTable('mod_fitness_days', {
  date: date('date').primaryKey(),
  eaten: integer('eaten').notNull().default(0),
  burned: integer('burned').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- module: recipes ----------
export const recipes = pgTable('mod_recipes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  servings: integer('servings'),
  timeMin: integer('time_min'),
  calories: integer('calories'), // estimated kcal per serving
  tags: jsonb('tags').$type<string[]>().default([]),
  ingredients: jsonb('ingredients').$type<string[]>().notNull().default([]),
  steps: jsonb('steps').$type<string[]>().notNull().default([]),
  lighter: jsonb('lighter').$type<string[]>().default([]), // calorie-cutting swaps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- module: farm (Life OS Farm game) ----------
// Single row ('main'): the whole game save as a jsonb blob. version = the
// client-side save-format version (migrations run in the browser).
export const farmState = pgTable('mod_farm_state', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  state: jsonb('state').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- module: tasks ----------
export const tasks = pgTable('mod_tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  due: timestamp('due', { withTimezone: true }),
  allDay: boolean('all_day').notNull().default(false),
  repeatDays: integer('repeat_days'), // every N days; null = one-off
  done: boolean('done').notNull().default(false),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (tb) => [index('tasks_due').on(tb.due)]);

// ---------- module: spotify ----------

export const spotifyTokens = pgTable('mod_spotify_tokens', {
  id: text('id').primaryKey().default('default'),
  refreshToken: text('refresh_token').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- module: gmail ----------

export const gmailMessages = pgTable('mod_gmail_messages', {
  id: text('id').primaryKey(), // gmail message id
  threadId: text('thread_id').notNull(),
  fromAddr: text('from_addr').notNull(),
  subject: text('subject'),
  snippet: text('snippet'),
  category: text('category').notNull(), // important | normal | newsletter | noise
  summary: text('summary'),
  unread: boolean('unread').notNull().default(true),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (tb) => [index('gmail_messages_received').on(tb.receivedAt)]);

// ---------- module: gcal ----------
// Events live in day_items (kind 'event'); this caches the user's calendar list for settings.
export const gcalCalendars = pgTable('mod_gcal_calendars', {
  id: text('id').primaryKey(),
  summary: text('summary').notNull(),
  color: text('color'),
  primary: boolean('primary').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
