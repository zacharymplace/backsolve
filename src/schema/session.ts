import { z } from "zod";

export const SessionSchema = z.object({
  id: z.string(),
  objective: z.string(),
  created_at: z.string(),
  outcome: z.string().optional(),
  chats: z.array(z.string()).default([]),
  diffs: z.array(z.string()).default([]),
  tests: z.array(z.object({
    command: z.string(),
    output: z.string(),
    exit_code: z.number(),
    captured_at: z.string(),
    tested_revision: z.string().optional()
  })).default([]),
  decisions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  unresolved_questions: z.array(z.string()).default([]),
  next_actions: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

export type Session = z.infer<typeof SessionSchema>;
