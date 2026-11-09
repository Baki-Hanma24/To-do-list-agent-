# templates

Reusable frameworks the agent follows when it writes something. Before writing a document that fits one of these, the agent loads it with its `get_template` tool. Then it replaces every `{placeholder}` with real content and drops sections that don't apply.

| Template | Use for |
| --- | --- |
| `research-comparison.md` | "Find the best…", comparisons, buying guides |
| `event-plan.md` | Parties, trips, gatherings |
| `email-draft.md` | Emails and invites |
| `study-guide.md` | Study guides and explainers |
| `shopping-list.csv` | Shopping lists and trackers (spreadsheet) |

To add your own, drop a `.md` or `.csv` file here. Start it with an HTML comment saying what it's for, like `<!-- Use for: ... -->`. The agent sees new templates automatically.
