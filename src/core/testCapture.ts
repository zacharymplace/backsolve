import { spawnSync } from "node:child_process";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

export function captureTest(command: string, testedRevision?: string): { exitCode: number; output: string } {
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\nCapture error: ${result.error.message}` : ""}`;
  const exitCode = result.error ? 1 : (result.status ?? 1);

  const session = getCurrentSession();

  session.tests.push({
    command,
    output,
    exit_code: exitCode,
    captured_at: new Date().toISOString(),
    tested_revision: testedRevision
  });

  saveSession(session);

  return { exitCode, output };
}
