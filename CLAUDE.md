# To-Do List Agent

A to-do list agent that holds everything I need to get done — work, home, family, money, health, all of it — and actually goes and does the work.

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
- **Never send anything without asking me first.** No emails, messages, orders, bookings, or posts go out until I approve them. Draft first, then ask.
- **Use bigger elements.** Larger text, buttons, and spacing in any UI.

## Project

Next.js 15 web app (TypeScript, Tailwind v4), deployed on Vercel. See `README.md` for setup.

- `src/agent/`: sorting (`sort.ts`), the agent loop (`run.ts`), its tools (`tools.ts`), and prompts (`prompt.ts`). Keep `prompt.ts` in line with the rules above.
- One task, one sub-agent: `orchestrate.ts` runs a sub-agent per task (in parallel for "Run all"), then the checker agent (`checker.ts`) reviews the work. A task isn't marked done until the checker passes it; problems go back to the sub-agent once to fix.
- Board queries live in `src/lib/queries.ts`. In correlated subqueries, refer to the outer task as `"tasks"."id"`, not `${schema.tasks.id}` (that renders as a bare `"id"`).
- `src/lib/execute-action.ts`: the **only** code that calls Gmail or Calendar. Only the approve route imports it. Agent tools may only queue `pending_actions`; never let them call Google directly.
- `src/db/`: Drizzle schema. Uses Neon when `DATABASE_URL` is set, otherwise a local PGlite DB in `.data/`. After schema changes run `npm run db:generate`.
- Checks: `npm run typecheck && npm run lint && npm test`. `tests/agent.test.ts` proves the approval gate; keep it passing.
- Local dev without Google: `AUTH_DEV_BYPASS=1 AUTH_SECRET=dev npm run dev`.

## Corrections log

When I correct you, add the new rule here so you don't repeat the mistake.

- Use bigger elements.
