# To-Do Agent

Put everything you need to get done into one list. The agent sorts each task into a pile and does the work it can.

- **Mine**: things only you can do. You check them off.
- **Together**: the agent does most of the work (research, drafts, plans) and you finish it.
- **Agent**: the agent handles it end to end.

For Together and Agent tasks, tap **Do it for me**. The agent:

1. writes a step-by-step plan,
2. works through it with web search, documents, checklists and spreadsheets,
3. drafts emails and calendar events,
4. checks its own work, and keeps going until every step is done.

**Run all** starts every open Agent and Together task at once, up to 8 at a time. Each task gets its own sub-agent. The board shows a live panel with progress and what each one is doing: searching, drafting, writing or checking.

A separate **checker agent** reviews each task's work before it's marked done. It checks that every part of the task was covered, that facts are real (no placeholders), and that documents and emails are ready to use. If it finds problems, the sub-agent gets them as a to-do list and fixes them, then the checker looks again. If it's still not right, the task comes to you with the checker's note.

**It never sends anything without asking you first.** Emails and calendar events appear as approval cards. You can **Approve**, **Edit** or **Reject** each one. Nothing reaches Gmail or Google Calendar until you tap Approve.

## Run it on your computer (no Google needed)

```bash
npm install
cp .env.example .env.local
# In .env.local set: ANTHROPIC_API_KEY=..., AUTH_SECRET=anything, AUTH_DEV_BYPASS=1
npm run dev
```

Open http://localhost:3000. Data is saved in `.data/`. Without an Anthropic key, sorting uses simple keywords and the agent can't run.

## Put it online (Vercel), one time setup

### 1. Google sign-in, Gmail and Calendar

1. Go to https://console.cloud.google.com and create a project.
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **OAuth consent screen**: choose External, fill in the app name and your email, and add yourself under **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: `https://YOUR-APP.vercel.app/api/auth/callback/google`. Add `http://localhost:3000/api/auth/callback/google` too if you want Google locally.
5. Copy the **Client ID** and **Client secret**.

### 2. Claude

Create an API key at https://console.anthropic.com.

### 3. Vercel

1. Import this GitHub repo at https://vercel.com/new.
2. **Storage → Create → Neon Postgres** and connect it to the project. This sets `DATABASE_URL`.
3. **Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your Claude key |
| `AUTH_SECRET` | run `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from step 1 |
| `ALLOWED_EMAIL` | your Google email (the only account that can sign in) |
| `TOKEN_ENC_KEY` | `openssl rand -base64 32` (encrypts your Google token) |

4. Set the **Build Command** to `npm run db:migrate && npm run build` so the database tables are created on each deploy.
5. Deploy, open the URL on your phone, and sign in with Google. "Add to Home Screen" makes it feel like an app.

## How it's built

- Next.js 15 (App Router), TypeScript, Tailwind v4.
- Postgres via Drizzle: Neon in production, PGlite locally.
- Auth.js with Google. Your refresh token is stored encrypted (AES-256-GCM).
- Claude:
  - `claude-haiku-5-5` sorts tasks.
  - `claude-opus-5-5` runs each sub-agent, with web search, adaptive thinking, and server-side refusal fallbacks.
  - `claude-opus-5-5` is also the checker agent, which returns a structured pass/fail verdict.
- The agent's tools can only **queue** emails and events (`pending_actions`). `src/lib/execute-action.ts` is the only code that talks to Google, and only the approve route uses it.

```bash
npm run typecheck && npm run lint && npm test
```

The tests include an approval-gate test: a full agent run queues an email and an event but makes zero Google calls until they're approved, and never for rejected ones.
