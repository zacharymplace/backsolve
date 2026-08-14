import { z } from "zod";

export const ConfidenceSchema = z.enum([
  "confirmed",
  "inferred",
  "unsupported",
  "contradicted",
  "needs_review"
]);

export const WhyfileSchema = z.object({
  schema_version: z.literal("0.1"),
  objective: z.string(),
  outcome: z.string(),
  context_used: z.array(z.string()).default([]),
  files_changed: z.array(z.string()).default([]),
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    evidence: z.array(z.string()).default([]),
    confidence: ConfidenceSchema.default("needs_review"),
    status: z.enum(["proposed", "accepted", "rejected", "superseded"]).default("proposed")
  })).default([]),
  validation: z.array(z.object({
    command: z.string(),
    result: z.string(),
    evidence: z.string().optional()
  })).default([]),
  risks: z.array(z.object({
    risk: z.string(),
    severity: z.enum(["low", "medium", "high"]).default("medium"),
    mitigation: z.string().optional(),
    status: z.enum(["open", "accepted", "resolved"]).default("open")
  })).default([]),
  unresolved_questions: z.array(z.string()).default([]),
  next_actions: z.array(z.string()).default([]),
  reconstruction_confidence: z.number().min(0).max(1).default(0.5)
});

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type Whyfile = z.infer<typeof WhyfileSchema>;
