import { CONFIDENCE_NOTICE } from "./provenance.js";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Whyfile, WhyfileSchema } from "../schema/whyfile.js";
import { Session } from "../schema/session.js";
import { BACKSOLVE_DIR } from "../storage/projectStore.js";
import { parseCapturedDecision } from "./decisionCapture.js";
import { parseCapturedRisk } from "./riskCapture.js";

const CHAT_SOURCE_LINE = /^# source: (.+)$/m;
const DIFF_FILE_LINE = /^diff --git a\/(.+?) b\/(.+)$/gm;

function extractChatSource(chat: string): string {
  const match = chat.match(CHAT_SOURCE_LINE);
  return match ? `chat: ${match[1]}` : "chat: (unlabeled)";
}

function extractChangedFiles(diffs: string[]): string[] {
  const files = new Set<string>();

  for (const diff of diffs) {
    for (const match of diff.matchAll(DIFF_FILE_LINE)) {
      const file = match[2];

      // Backsolve's own session/whyfile/cache bookkeeping lives under
      // .backsolve/ and is tracked in git, but it is not part of the work
      // being reconstructed -- excluding it keeps files_changed meaningful.
      if (!file.startsWith(`${BACKSOLVE_DIR}/`)) {
        files.add(file);
      }
    }
  }

  return [...files].sort();
}

/**
 * Deterministic, no ML/LLM involved. Starts at 1.0 and applies fixed
 * penalties for missing or weak evidence, floored at 0. Each penalty is
 * independent so the score reflects how many distinct evidence gaps
 * exist, not just whether any exist.
 */
function computeReconstructionConfidence(session: Session, decisions: ReturnType<typeof parseCapturedDecision>[]): number {
  let confidence = 1;

  if (session.tests.length === 0) {
    confidence -= 0.3;
  } else if (session.tests.some((test) => test.exit_code !== 0)) {
    confidence -= 0.2;
  }

  const weakDecisions = decisions.filter((decision) =>
    decision.confidence === "unsupported" ||
    decision.confidence === "contradicted" ||
    decision.confidence === "needs_review"
  );

  if (decisions.length > 0 && weakDecisions.length > 0) {
    confidence -= 0.2;
  }

  if (session.chats.length === 0) {
    confidence -= 0.15;
  }

  if (session.diffs.length === 0) {
    confidence -= 0.15;
  }

  return Math.max(0, Number(confidence.toFixed(2)));
}

export function buildWhyfile(session: Session): Whyfile {
  if (!session.outcome) {
    throw new Error(
      "Session has no outcome recorded. Run: backsolve set-outcome \"<what actually happened>\""
    );
  }

  const decisions = session.decisions.map(parseCapturedDecision);
  const risks = session.risks.map(parseCapturedRisk);

  const whyfile: Whyfile = {
    schema_version: "0.1",
    objective: session.objective,
    outcome: session.outcome,
    context_used: session.chats.map(extractChatSource),
    files_changed: extractChangedFiles(session.diffs),
    decisions,
    validation: session.tests.map((test) => ({
      command: test.command,
      result: test.exit_code === 0 ? "pass" : "fail",
      evidence: test.output.slice(0, 4000)
    })),
    risks,
    unresolved_questions: session.unresolved_questions,
    next_actions: session.next_actions,
    reconstruction_confidence: computeReconstructionConfidence(session, decisions)
  };

  return WhyfileSchema.parse(whyfile);
}

export function renderWhyfileMarkdown(whyfile: Whyfile): string {
  const lines = [
    `# ${whyfile.objective}`,
    "",
    "## Outcome",
    "",
    whyfile.outcome,
    "",
    `Confidence score: ${CONFIDENCE_NOTICE}`,
    "",
    "```yaml",
    YAML.stringify(whyfile).trimEnd(),
    "```",
    ""
  ];

  return lines.join("\n");
}

export function writeWhyfile(session: Session): { whyfile: Whyfile; filePath: string } {
  const whyfile = buildWhyfile(session);
  const filePath = path.join(BACKSOLVE_DIR, "whyfiles", `${session.id}.why.md`);

  fs.writeFileSync(filePath, renderWhyfileMarkdown(whyfile));

  return { whyfile, filePath };
}
