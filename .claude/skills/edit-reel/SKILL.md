---
name: edit-reel
description: Turn the user's raw reel clips into a step-by-step edit plan for Instagram's editor, using the editor subagent. Use when the user types /edit-reel, sends clips and asks to edit them, or asks for an edit plan.
---

# /edit-reel

1. **Get the clips.** Use the video files the user attached or named, in the order they gave. Uploaded files are usually listed in the message, like `@"/root/.claude/uploads/.../file.mov"`. If there are no clips, ask for them and stop.
2. **Get the notes.** The editor can't hear audio. If the user hasn't said what happens (what they said, sounds or music, anything off camera, the caption idea), ask once in one short message, then wait. If they say "just go", continue without notes.
3. **Hand off to the `editor` subagent** (Agent tool, `subagent_type: "editor"`). Give it:
   - the clip paths, in order, or say the order is unknown
   - the user's notes, word for word
   - the scratchpad directory for frames, if this session has one
4. **Reply briefly** (the user likes short messages):
   - the verdict
   - the top 3 changes
   - any playbook misses
   - a link to the saved plan file

   Don't paste the whole plan unless asked. It's in the file.

The editor never posts anything. The user edits and posts in Instagram themselves.
