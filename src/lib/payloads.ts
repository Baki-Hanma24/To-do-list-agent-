import { z } from "zod";

const emails = z.array(z.string().email()).min(1);

export const emailPayload = z.object({
  to: emails,
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
});

export const calendarPayload = z.object({
  summary: z.string().min(1).max(300),
  start: z.string().min(10), // YYYY-MM-DD (all day) or ISO date-time
  end: z.string().min(10),
  timeZone: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export type EmailPayload = z.infer<typeof emailPayload>;
export type CalendarPayload = z.infer<typeof calendarPayload>;
