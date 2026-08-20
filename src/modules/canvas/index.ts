import { randomUUID } from 'crypto';
import { and, eq, gte, inArray, like, not, notInArray } from 'drizzle-orm';
import { db, t } from '@/db';
import { emit } from '@/lib/events';
import { localDate, TZ } from '@/lib/dates';
import { getSettings } from '@/lib/settings';
import type { ModuleManifest } from "../types";
import { getConfig } from "@/lib/config";

export const canvasConfigured = () => Boolean(getConfig().canvas.baseUrl && getConfig().canvas.token);

async function cfetch(path: string) {
  const { baseUrl, token } = getConfig().canvas;
  if (!baseUrl || !token) throw new Error("Canvas is not set up — add your school URL and token in Settings");
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

type CCourse = {
  id: number; name: string; course_code?: string;
  enrollments?: { computed_current_grade?: string; computed_current_score?: number }[];
  term?: { name?: string; start_at?: string | null; end_at?: string | null };
};
type CAssignment = {
  id: number; name: string; due_at: string | null; points_possible: number | null;
  html_url: string; description?: string | null;
  submission?: { workflow_state?: string; score?: number | null };
};

type CanvasSettings = { remindHoursBefore: number; hideZeroPoint: boolean };

// Demo rows are prefixed so real syncs never wipe them; cleared via POST clear-demo.
const FAKE = 'fake-';

const stripHtml = (html: string | null | undefined) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim().slice(0, 600) || null;

// A course belongs to the current semester if its term window contains "now".
// Terms without dates (e.g. "Default Term") are kept — enrollment_state=active
// already scopes the list.
function inCurrentTerm(c: CCourse, now: Date): boolean {
  const start = c.term?.start_at ? new Date(c.term.start_at) : null;
  const end = c.term?.end_at ? new Date(c.term.end_at) : null;
  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}

// Rebuild the day_items spine + due-soon reminders from whatever is in the DB
// (real + demo rows). Muted assignments and — when hideZeroPoint is on —
// zero-point busywork are excluded everywhere.
async function rebuildDayItems() {
  const settings = await getSettings<CanvasSettings>('canvas');
  const now = new Date();
  const courses = await db().select().from(t.canvasCourses);
  const code = Object.fromEntries(courses.map((c) => [c.id, c.code ?? c.name]));
  const assignments = await db().query.canvasAssignments.findMany({
    where: (a, { and: andOp, eq: eqOp, isNotNull }) => andOp(eqOp(a.muted, false), isNotNull(a.dueAt)),
  });

  const dayRows: (typeof t.dayItems.$inferInsert)[] = [];
  for (const a of assignments) {
    if (settings.hideZeroPoint && a.pointsPossible === 0) continue;
    const due = a.dueAt!;
    dayRows.push({
      id: randomUUID(),
      date: localDate(due),
      moduleId: 'canvas',
      kind: 'task',
      time: due,
      title: a.name,
      subtitle: code[a.courseId] ?? '',
      url: a.htmlUrl,
      payload: { courseId: a.courseId, points: a.pointsPossible, submitted: a.submitted },
      status: a.submitted ? 'done' : 'pending',
      externalId: a.id,
    });

    // Reminder push N hours before due (default 12h), deduped so it fires once.
    const remindAt = new Date(due.getTime() - (settings.remindHoursBefore ?? 12) * 3600e3);
    if (!a.submitted && due > now && remindAt > now) {
      await db().insert(t.notifications)
        .values({
          id: randomUUID(), moduleId: 'canvas',
          title: `Due soon: ${a.name}`,
          body: `${code[a.courseId] ?? ''} — due ${due.toLocaleString('en-US', { timeZone: TZ })}`,
          url: a.htmlUrl, scheduledFor: remindAt,
          dedupeKey: `canvas:${a.id}:remind`,
        })
        .onConflictDoNothing();
    }
  }

  await db().transaction(async (tx) => {
    await tx.delete(t.dayItems).where(eq(t.dayItems.moduleId, 'canvas'));
    if (dayRows.length) await tx.insert(t.dayItems).values(dayRows);
  });
  return dayRows.length;
}

async function sync() {
  const now = new Date();
  const all: CCourse[] = await cfetch(
    '/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=term&per_page=50',
  );
  const courses = all.filter((c) => inCurrentTerm(c, now));
  const keepIds: string[] = [];

  for (const c of courses) {
    keepIds.push(String(c.id));
    const enr = c.enrollments?.[0];
    await db().insert(t.canvasCourses)
      .values({
        id: String(c.id), name: c.name, code: c.course_code ?? null,
        grade: enr?.computed_current_grade ?? null, score: enr?.computed_current_score ?? null,
        term: c.term?.name ?? null, updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: t.canvasCourses.id,
        set: {
          name: c.name, grade: enr?.computed_current_grade ?? null,
          score: enr?.computed_current_score ?? null,
          term: c.term?.name ?? null, updatedAt: new Date(),
        },
      });

    // No bucket filter: "upcoming" hides overdue work. Fetch by due date and
    // keep the last 30 days + everything ahead (5-6 classes fit one page).
    const assignments: CAssignment[] = await cfetch(
      `/api/v1/courses/${c.id}/assignments?include[]=submission&order_by=due_at&per_page=100`,
    );
    const seen: string[] = [];
    for (const a of assignments) {
      const due = a.due_at ? new Date(a.due_at) : null;
      if (due && due.getTime() < now.getTime() - 30 * 864e5) continue;
      seen.push(String(a.id));
      const submitted = ['submitted', 'graded', 'complete'].includes(a.submission?.workflow_state ?? '');
      // NB: `muted` is intentionally absent from the update set — user choice survives syncs.
      await db().insert(t.canvasAssignments)
        .values({
          id: String(a.id), courseId: String(c.id), name: a.name,
          dueAt: due, pointsPossible: a.points_possible, htmlUrl: a.html_url,
          description: stripHtml(a.description),
          submitted, score: a.submission?.score ?? null, updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: t.canvasAssignments.id,
          set: {
            name: a.name, dueAt: due, pointsPossible: a.points_possible,
            description: stripHtml(a.description),
            submitted, score: a.submission?.score ?? null, updatedAt: new Date(),
          },
        });
    }
    // Drop assignments Canvas deleted (demo rows excluded).
    await db().delete(t.canvasAssignments).where(and(
      eq(t.canvasAssignments.courseId, String(c.id)),
      not(like(t.canvasAssignments.id, `${FAKE}%`)),
      seen.length ? notInArray(t.canvasAssignments.id, seen) : undefined,
    ));
  }

  // Drop courses from past semesters (and their assignments); demo rows excluded.
  const stale = await db().select({ id: t.canvasCourses.id }).from(t.canvasCourses)
    .where(and(
      not(like(t.canvasCourses.id, `${FAKE}%`)),
      keepIds.length ? notInArray(t.canvasCourses.id, keepIds) : undefined,
    ));
  if (stale.length) {
    const ids = stale.map((s) => s.id);
    await db().delete(t.canvasAssignments).where(inArray(t.canvasAssignments.courseId, ids));
    await db().delete(t.canvasCourses).where(inArray(t.canvasCourses.id, ids));
  }

  const count = await rebuildDayItems();
  await emit('canvas', 'canvas.synced', { assignments: count, courses: courses.length });
}

// ---------- demo data (development until real assignments exist) ----------

async function seedDemo() {
  const h = 3600e3;
  const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * h);
  const courses = [
    { id: `${FAKE}c-1`, name: 'AP Calculus BC', code: 'AP CALC BC', grade: 'A', score: 93.4 },
    { id: `${FAKE}c-2`, name: 'AP Physics C: Mechanics', code: 'AP PHYS C', grade: 'B+', score: 88.1 },
    { id: `${FAKE}c-3`, name: 'AP English Literature', code: 'AP LIT', grade: 'A-', score: 91.7 },
    { id: `${FAKE}c-4`, name: 'AP US History', code: 'APUSH', grade: 'B', score: 85.9 },
    { id: `${FAKE}c-5`, name: 'Spanish 3 Honors', code: 'SPAN 3H', grade: 'A+', score: 96.2 },
  ];
  type Row = [course: number, name: string, dueH: number | null, pts: number, desc: string,
    submitted?: boolean, score?: number | null];
  const rows: Row[] = [
    [1, 'Problem Set 4: Related Rates', -20, 20, 'Solve problems 1–14 from section 4.6. Show the full setup: draw the diagram, label variables, and state the rate equation before differentiating.'],
    [2, 'Lab Report: Projectile Motion', 7, 30, 'Write up Tuesday’s launcher lab. Include data tables, uncertainty analysis, and compare your measured range to the kinematics prediction.'],
    [3, 'Hamlet Act III Reading Quiz', 26, 15, 'Reading check on Act III. Focus on the nunnery scene, the play-within-a-play, and the closet scene. Know who says the major lines.'],
    [4, 'DBQ Essay: Progressive Era', 50, 60, 'Timed-style DBQ using the 7 provided documents. Thesis, contextualization, evidence from at least 4 documents, and complexity point.'],
    [5, 'Oral Presentation: La Familia', 55, 25, 'Present your family tree in Spanish for 3–4 minutes. Use at least 10 vocabulary words from unit 2 and both regular and irregular verbs.'],
    [1, 'Problem Set 5: Optimization', 74, 20, 'Section 4.7 problems 2–18 even. Classic optimization: fences, boxes, distances. Verify each answer with the second-derivative test.'],
    [4, 'Weekly Check-In Survey', 98, 0, 'Weekly participation survey. How is the unit pacing? Any questions before Friday’s review session?'],
    [2, 'Lab Prep Quiz: Rotational Dynamics', 122, 10, 'Short pre-lab quiz on torque and moment of inertia. Covers the intro video and the first two pages of the lab handout.'],
    [3, 'Poetry Response Journal', 146, 0, 'Weekly reading journal entry — one page responding to this week’s poem. Graded complete/incomplete.'],
    [1, 'Unit 5 Exam: Applications of Derivatives', 194, 100, 'In-class exam covering related rates, linearization, optimization, and curve sketching. One page of handwritten notes allowed.'],
    [5, 'Ensayo: Mi Verano', 218, 40, 'Write a 300-word essay about your summer in the preterite and imperfect. Rough draft due for peer review on Wednesday.'],
    [1, 'Problem Set 3: Implicit Differentiation', -96, 20, 'Section 4.5 problems 1–12.', true, 19],
    [3, 'Socratic Seminar Prep: Hamlet Act II', -72, 10, 'Prepare three discussion questions and two textual quotes.', true, 10],
    [4, 'Chapter 22 Reading Notes', -48, 15, 'Cornell notes on chapter 22: The Progressive Era.', true, null],
  ];

  for (const c of courses) {
    await db().insert(t.canvasCourses)
      .values({ ...c, term: 'Fall 2026 (demo)', updatedAt: new Date() })
      .onConflictDoUpdate({ target: t.canvasCourses.id, set: { ...c, updatedAt: new Date() } });
  }
  for (let i = 0; i < rows.length; i++) {
    const [ci, name, dueH, pts, desc, submitted = false, score = null] = rows[i];
    const vals = {
      id: `${FAKE}a-${i + 1}`, courseId: `${FAKE}c-${ci}`, name,
      dueAt: dueH == null ? null : at(dueH), pointsPossible: pts,
      htmlUrl: 'https://canvas.example.edu/demo', description: desc,
      submitted, muted: false, score, updatedAt: new Date(),
    };
    await db().insert(t.canvasAssignments).values(vals)
      .onConflictDoUpdate({ target: t.canvasAssignments.id, set: vals });
  }
  await rebuildDayItems();
}

async function clearDemo() {
  await db().delete(t.canvasAssignments).where(like(t.canvasAssignments.id, `${FAKE}%`));
  await db().delete(t.canvasCourses).where(like(t.canvasCourses.id, `${FAKE}%`));
  await rebuildDayItems();
}

// ---------- module API ----------

async function api(req: Request, path: string[]): Promise<Response | null> {
  if (req.method === 'GET' && path[0] === 'overview') {
    const settings = await getSettings<CanvasSettings>('canvas');
    const courses = await db().select().from(t.canvasCourses);
    const assignments = await db().query.canvasAssignments.findMany({
      orderBy: (a, { asc }) => [asc(a.dueAt)],
    });
    return Response.json({ courses, assignments, settings });
  }
  if (req.method === 'GET' && path[0] === 'courses') {
    return Response.json(await db().select().from(t.canvasCourses));
  }
  if (req.method === 'GET' && path[0] === 'assignments') {
    const rows = await db().query.canvasAssignments.findMany({
      orderBy: (a, { asc }) => [asc(a.dueAt)],
    });
    return Response.json(rows);
  }
  if (req.method === 'POST' && path[0] === 'mute') {
    const { id, muted } = await req.json() as { id: string; muted: boolean };
    await db().update(t.canvasAssignments).set({ muted: !!muted })
      .where(eq(t.canvasAssignments.id, String(id)));
    await rebuildDayItems();
    return Response.json({ ok: true });
  }
  if (req.method === 'POST' && path[0] === 'sync') {
    await sync();
    return Response.json({ ok: true });
  }
  if (req.method === 'POST' && path[0] === 'seed') {
    await seedDemo();
    return Response.json({ ok: true });
  }
  if (req.method === 'POST' && path[0] === 'clear-demo') {
    await clearDemo();
    return Response.json({ ok: true });
  }
  return null;
}

async function dashboardData() {
  const settings = await getSettings<CanvasSettings>('canvas');
  const now = new Date();
  const visible = await db().query.canvasAssignments.findMany({
    where: (a, { and: andOp, eq: eqOp, isNotNull }) =>
      andOp(eqOp(a.submitted, false), eqOp(a.muted, false), isNotNull(a.dueAt)),
    orderBy: (a, { asc }) => [asc(a.dueAt)],
  });
  const upcoming = visible.filter((a) =>
    a.dueAt! >= now && !(settings.hideZeroPoint && a.pointsPossible === 0));
  const overdue = visible.filter((a) =>
    a.dueAt! < now && !(settings.hideZeroPoint && a.pointsPossible === 0));

  const today = localDate(now);
  const weekEnd = new Date(now.getTime() + 7 * 864e5);
  const counts = {
    today: upcoming.filter((a) => localDate(a.dueAt!) === today).length,
    week: upcoming.filter((a) => a.dueAt! <= weekEnd).length,
    overdue: overdue.length,
    total: upcoming.length,
  };

  const courses = await db().select().from(t.canvasCourses);
  const courseName = Object.fromEntries(courses.map((c) => [c.id, c.code ?? c.name]));
  return {
    assignments: [...overdue, ...upcoming].slice(0, 6)
      .map((a) => ({ ...a, course: courseName[a.courseId] ?? '' })),
    counts,
    courses,
  };
}

export const canvas: ModuleManifest = {
  enabled: canvasConfigured,
  id: 'canvas',
  name: 'Canvas',
  tileSize: 'tall',
  syncEveryMin: 5,
  sync,
  api,
  dashboardData,
  defaultSettings: { remindHoursBefore: 12, hideZeroPoint: false },
};
