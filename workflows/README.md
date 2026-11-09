# workflows

Agent definitions and process documents. **The app reads these files directly**, so editing one changes how the agents behave. No code changes needed.

| File | What it is |
| --- | --- |
| `sorting.md` | How each new task is sorted into Mine / Together / Agent |
| `sub-agent.md` | Instructions for the sub-agent that works on one task |
| `checker-agent.md` | Instructions for the checker that reviews each task before it's marked done |
| `success-criteria.md` | What a good result looks like. Given to both the sub-agent and the checker |

## The process

1. **Sort.** A new task is placed in a pile (`sorting.md`).
2. **Sub-agent.** "Do it for me" or "Run all" gives each task its own sub-agent (`sub-agent.md`). It runs these steps:
   - understand
   - ask
   - plan
   - execute
   - review
   - improve
   - deliver
3. **Check.** The checker reviews the work against `success-criteria.md` (`checker-agent.md`).
   - Problems go back to the sub-agent once to fix.
   - Documents stay **drafts** until the checker passes them; then they become **final** outputs.
4. **Your approval.** Emails and calendar events wait for you to tap Approve. Nothing is sent without it.
