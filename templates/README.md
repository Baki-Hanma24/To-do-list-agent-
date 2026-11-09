# templates

Reusable frameworks the agent follows when it writes something. Before writing a document that fits one of these, the agent loads it with its `get_template` tool. Then it replaces every `{placeholder}` with real content and drops sections that don't apply.

| Template | Use for |
| --- | --- |
| `research-comparison.md` | "Find the best…", comparisons, buying guides |
| `event-plan.md` | Parties, trips, gatherings |
| `email-draft.md` | Emails and invites |
| `study-guide.md` | Study guides and explainers |
| `shopping-list.csv` | Shopping lists and trackers (spreadsheet) |
| `youtube-video-script.md` | YouTube videos: titles, hook, timestamped outline, B-roll, description |
| `social-post-batch.md` | One idea turned into a reel/TikTok/Short script, an Instagram caption, and stories |
| `coaching-reel.md` | My signature reel: I demo, teach the cue, then coach a client through it |
| `content-calendar.csv` | Planning posts across Instagram, TikTok, and YouTube (spreadsheet) |
| `client-check-in.md` | Weekly client check-ins |
| `training-program.md` | Training programs and workout plans |

To add your own, drop a `.md` or `.csv` file here. Start a `.md` file with an HTML comment saying what it's for, like `<!-- Use for: ... -->`. A `.csv` file is described by its header row. The agent sees new templates automatically.
