import { z } from "zod";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

const CapturedRiskSchema = z.object({
  risk: z.string(),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  mitigation: z.string().optional(),
  status: z.enum(["open", "accepted", "resolved"]).default("open")
});

export type CapturedRisk = z.infer<typeof CapturedRiskSchema>;

export function addRisk(input: {
  risk: string;
  severity?: string;
  mitigation?: string;
  status?: string;
}): void {
  const parsed = CapturedRiskSchema.parse({
    risk: input.risk,
    severity: input.severity,
    mitigation: input.mitigation,
    status: input.status
  });

  const session = getCurrentSession();
  session.risks.push(JSON.stringify(parsed));
  saveSession(session);
}

export function parseCapturedRisk(raw: string): CapturedRisk {
  return CapturedRiskSchema.parse(JSON.parse(raw));
}
