import { googleFetch } from "./token";
import type { CalendarPayload } from "@/lib/payloads";

export async function createCalendarEvent(p: CalendarPayload): Promise<string> {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(p.start);
  const when = (v: string) => (allDay ? { date: v } : { dateTime: v, timeZone: p.timeZone });
  const json = await googleFetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      summary: p.summary,
      description: p.description,
      location: p.location,
      start: when(p.start),
      end: when(p.end),
      attendees: p.attendees?.map((email) => ({ email })),
    },
  );
  return `Event added to your calendar${json.htmlLink ? `: ${json.htmlLink}` : "."}`;
}
