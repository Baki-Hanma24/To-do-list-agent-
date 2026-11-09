# To-Do List Agent

A to-do list agent that holds everything I need to get done — work, home, family, money, health, all of it — and actually goes and does the work.

## About me

- I go by **Baki** (from *Baki the Grappler*): Tae Kwon Do growing up, lifting since 12 (now 27), big bodybuilding fan. See `resources/baki.md`; the full research is in `resources/reference/baki-deep-dive.md`.
- I own a **personal training coaching business**. I started it because **I really care about people**. I love **bodybuilding** and **philosophy**.
- I'm getting busier, so I want **better workflows**: systems, batching, and templates that save time.
- I'm growing my following on **Instagram** and **TikTok**, and launching a **YouTube channel**.
- My content is **cinematic and aesthetic**: me trying workouts, training with clients, self-motivation, and philosophy. I think deeply (metacognitive).
- My content is **unscripted**: talking points only, never word-for-word scripts.
- **Signature format:** cinematic coaching reels. I demo it, teach the cue, then coach a client through it.
- **For anything content-related, follow the criteria in `resources/content-playbook.md`:** what my best reel proved works, and the checklist every reel should hit. Same criteria, not identical reels.
- When a task touches my business or content, pull from `resources/about-me.md`. That file holds the details, my voice, and blanks I'll fill in.

## What the agent does

1. **Sort every task into three piles:**
   - **Mine** — things I can do on my own.
   - **Together** — things we do together: the agent does most of the work, I finish it.
   - **Agent only** — things the agent can handle end to end.
2. **Figure out the steps** for each task before starting.
3. **Use the right tools** for each step.
4. **Check its own work** against the plan.
5. **Keep going until the job is actually done**, then say so plainly.

## How I like things

- **Everything looks premium.** Clean, polished, high-quality design in anything you build.
- **Shorter messages.** Keep replies brief and to the point.
- **Match the requested length. Never pad.**
- **Never send anything without asking me first.** No emails, messages, orders, bookings, or posts go out until I approve them. Draft first, then ask.
- **Use bigger elements.** Larger text, buttons, and spacing in any UI.
- **Review outputs before final delivery.**

## File naming rules

- Use lowercase file names.
- Use hyphens instead of spaces.
- Use descriptive names.
- Avoid special characters.

Examples:

- `venue-options.md`
- `gift-ideas-tracker.csv`
- `drivers-test-study-guide.md`

## Folder structure

- `/workflows`: workflow instructions, agent definitions, and process documents. The app's agents read these directly.
- `/outputs`: completed work and generated deliverables.
- `/resources`: reference material, source documents, examples, and research. The agents read every file here.
- `/drafts`: work in progress and temporary files.
- `/templates`: reusable templates and frameworks. The agents load these with `get_template`.
- `/src`: the web app's code. `/tests`: its tests. `/drizzle`: database migrations.

## Agent behavior

Before starting any task:

1. Understand the objective.
2. Ask clarifying questions if needed.
3. Create a plan.
4. Execute step by step.
5. Review the output.
6. Improve weak areas.
7. Deliver the final result.

- Never skip planning for complex tasks.
- Never prioritize speed over quality.
- Always optimize for usefulness and accuracy.

## Success criteria

A successful output should be:

- Clear
- Actionable
- Accurate
- Concise
- Easy to understand
- Immediately useful

## Project

Next.js 15 web app (TypeScript, Tailwind v4), deployed on Vercel. See `README.md` for setup.

- **Agent instructions live in `/workflows`:** `sub-agent.md`, `checker-agent.md`, `sorting.md`, `success-criteria.md`.
  - `src/agent/prompt.ts` builds the prompts from those files, the `/templates` list, and `/resources`.
  - Keep the workflow files in line with the rules above.
- **`src/agent/`:** sorting (`sort.ts`), the agent loop (`run.ts`), and its tools (`tools.ts`).
- **One task, one sub-agent:**
  - `orchestrate.ts` runs a sub-agent per task (in parallel for "Run all"). Then the checker agent (`checker.ts`) reviews the work.
  - A task isn't marked done until the checker passes it. Problems go back to the sub-agent once to fix.
  - Documents stay `draft` until the checker passes the task, then become `final`.
- **Board queries live in `src/lib/queries.ts`.** See the corrections log about correlated subqueries.
- **Rules the user teaches the app** (`rules` table, `src/agent/rules.ts`) are added to every sub-agent's prompt and every checker review.
- **Editor agent** (`/editor`, `src/agent/editor.ts`, `workflows/editor-agent.md`): strictly edits raw footage into an Instagram-editor plan.
  - One Opus call over browser-extracted JPEG stills (`src/lib/frames.ts`; max 36 frames, 3MB total) plus the user's notes.
  - No tools, so it can't post. Plans are saved in the `edits` table.
  - **In Claude Code:** `/edit-reel` (`.claude/skills/edit-reel/`) hands clips to the `editor` subagent (`.claude/agents/editor.md`). It reads the same `workflows/editor-agent.md` and saves plans to `outputs/edit-plans/`.
- **`src/lib/execute-action.ts` is the only code that calls Gmail or Calendar.**
  - Only the approve route imports it.
  - Agent tools may only queue `pending_actions`. Never let them call Google directly.
- **Download file names** come from `slugify()` in `src/lib/files.ts`, which follows the naming rules above.
- **`src/db/`:** Drizzle schema. Uses Neon when `DATABASE_URL` is set, otherwise a local PGlite DB in `.data/`. After schema changes, run `npm run db:generate`.
- **Checks:** `npm run typecheck && npm run lint && npm test`. `tests/agent.test.ts` proves the approval gate; keep it passing.
- **Local dev without Google:** `AUTH_DEV_BYPASS=1 AUTH_SECRET=dev npm run dev`.

## Corrections log

Never make the same mistake twice.

- **Read this log before starting any task.**
- **Log every mistake in the same turn.** When I correct you, or when you catch your own mistake (a bug, a failed check, a bad screenshot), add a rule here before moving on.
  - Format: `- **Rule.** Why: what went wrong.`
- **Fix it everywhere.** Fix every place the mistake exists, not just the one you noticed.
- **Make it catchable.** Add a test or check that would catch it again, where possible.
- **Write rules as specific instructions,** not apologies. Never remove a rule unless I say so.

Rules:

- **Use bigger elements.** Why: I asked for larger text, buttons, and spacing.
- **In correlated SQL subqueries, refer to the outer task as `"tasks"."id"`,** never `${schema.tasks.id}`. Why: it rendered as a bare `"id"`, so step counts, approval counts, and "Run all" were wrong for every task.
- **Check every UI change at phone width (390px) before shipping:** no wrapped headers, no cut-off titles, no sideways scrolling. Why: the phone layout broke repeatedly (header, add box, panel rows, document titles).
- **Hide buttons that don't apply right now.** Why: "Keep going" showed while a task was only waiting on my approval.
- **Route files export only HTTP handlers and route config.** Why: a stray export would have broken the Next.js build.
- **Run a helper script and confirm its output before deleting it.** Why: a seed script was deleted before it had run.
- **Copy exact text from the source before asserting it in a test.** Why: a test failed on "Parties" vs "parties".
- **Don't promise to wait for my OK before committing.** The repo's stop hook commits and pushes every turn. Show the content in the same message and offer to change it after. Why: I promised to show my profile before committing, then the hook forced a commit first.
- **Label guesses as guesses.** When analyzing something I can't fully see or hear (audio, intent), mark inferred parts as unconfirmed and ask. Why: the first content playbook presented a guessed structure as fact before I described the audio and hook.
- **Check the phone layout with real data loaded and every badge showing,** at 320px and 390px, not just the loading or empty state. Why: a screenshot taken before tasks loaded looked fine, but with the "needs you" badge the header covered the app name.
- **Every new header item means rechecking the header on every page at 320px and 390px.** Why: adding the 🎬 Editor link cut the app name to "To-Do A…" on iPhone 14.
