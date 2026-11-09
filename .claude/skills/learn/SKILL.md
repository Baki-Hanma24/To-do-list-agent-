---
name: learn
description: Review this session and update the user's skills, agents, templates, and reference files with what was learned. Use when the user types /learn, says "keep updating your skills", "remember this", or at the end of a session with new information about them or their content.
---

# /learn: keep the skills up to date

1. **Review this session.** List what's new, and keep only what's durable (not one-off details):
   - facts about the user
   - their content: what worked, new formats, numbers
   - Baki
   - preferences and corrections
   - repeated workflows

2. **Update the right file for each item** (see "Keep improving" in `CLAUDE.md`):

   | What you learned | Where it goes |
   |---|---|
   | About the user | `resources/about-me.md` |
   | Content results and criteria | `resources/content-playbook.md` (criteria, not copies; analyze new reels with `templates/reel-breakdown.md`) |
   | Baki | `resources/baki.md`; long research goes in `resources/reference/baki-deep-dive.md` |
   | Reusable formats | `templates/` (start with `<!-- Use for: ... -->`) |
   | How agents behave | `workflows/*.md` |
   | Editor behavior | `.claude/agents/editor.md` |
   | Repeated multi-step workflows | a new skill in `.claude/skills/<name>/SKILL.md` |
   | A mistake or correction | a rule in the `CLAUDE.md` corrections log |

3. **Edit, don't pile on.** Merge with existing lines and replace anything outdated. Keep each top-level `/resources` file under 6K characters.
   - Check with `wc -c resources/*.md`.
   - Move long material to `resources/reference/`.

4. **Run the checks:** `npm test` (it guards that the resources stay in the agents' prompt and aren't cut off).

5. **Report in a few lines:** what you updated and where. If nothing durable was learned, say so.
