import { execSync } from "node:child_process";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

export function scanDiff(baseRef?: string): void {
  const args = baseRef ? ["diff", baseRef] : ["diff"];

  let diffText: string;

  try {
    diffText = execSync(`git ${args.join(" ")}`, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 32
    });
  } catch (error) {
    throw new Error(
      `git diff failed: ${(error as Error).message}`
    );
  }

  if (!diffText.trim()) {
    throw new Error(
      baseRef
        ? `No diff found against ${baseRef}. Nothing to scan.`
        : "No unstaged/uncommitted diff found. Nothing to scan."
    );
  }

  const session = getCurrentSession();
  const header = `# scope: ${baseRef ?? "working tree"}\n\n`;

  session.diffs.push(header + diffText);
  saveSession(session);
}
