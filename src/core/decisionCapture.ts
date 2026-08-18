import { z } from "zod";
import { ConfidenceSchema } from "../schema/whyfile.js";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

const CapturedDecisionSchema = z.object({
  decision: z.string(),
  rationale: z.string(),
  evidence: z.array(z.string()).default([]),
  confidence: ConfidenceSchema.default("needs_review"),
  status: z.enum(["proposed", "accepted", "rejected", "superseded"]).default("proposed")
});

export type CapturedDecision = z.infer<typeof CapturedDecisionSchema>;

export function addDecision(input: {
  decision: string;
  rationale: string;
  evidence?: string[];
  confidence?: string;
  status?: string;
}): void {
  const parsed = CapturedDecisionSchema.parse({
    decision: input.decision,
    rationale: input.rationale,
    evidence: input.evidence ?? [],
    confidence: input.confidence,
    status: input.status
  });

  const session = getCurrentSession();
  session.decisions.push(JSON.stringify(parsed));
  saveSession(session);
}

export function parseCapturedDecision(raw: string): CapturedDecision {
  return CapturedDecisionSchema.parse(JSON.parse(raw));
}
