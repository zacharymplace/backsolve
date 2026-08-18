import { execSync } from "node:child_process";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

export function captureTest(command: string): { exitCode: number; output: string } {
  let output: string;
  let exitCode = 0;

  try {
    output = execSync(command, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 32,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    output = `${execError.stdout ?? ""}${execError.stderr ?? ""}`;
    exitCode = typeof execError.status === "number" ? execError.status : 1;
  }

  const session = getCurrentSession();

  session.tests.push({
    command,
    output,
    exit_code: exitCode,
    captured_at: new Date().toISOString()
  });

  saveSession(session);

  return { exitCode, output };
}
