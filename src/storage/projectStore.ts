import fs from "node:fs";
import path from "node:path";
import { Session, SessionSchema } from "../schema/session.js";

export const BACKSOLVE_DIR = ".backsolve";

export function ensureProject(): void {
  const dirs = [
    BACKSOLVE_DIR,
    `${BACKSOLVE_DIR}/sessions`,
    `${BACKSOLVE_DIR}/whyfiles`,
    `${BACKSOLVE_DIR}/evidence`,
    `${BACKSOLVE_DIR}/decisions`,
    `${BACKSOLVE_DIR}/risks`,
    `${BACKSOLVE_DIR}/caches`
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const configPath = path.join(BACKSOLVE_DIR, "backsolve.config.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
      schema_version: "0.1",
      project: path.basename(process.cwd()),
      created_at: new Date().toISOString()
    }, null, 2));
  }
}

export function createSession(objective: string): Session {
  ensureProject();

  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const session: Session = {
    id,
    objective,
    created_at: new Date().toISOString(),
    chats: [],
    diffs: [],
    tests: [],
    decisions: [],
    risks: [],
    notes: []
  };

  saveSession(session);
  fs.writeFileSync(path.join(BACKSOLVE_DIR, "current-session"), id);
  return session;
}

export function getCurrentSession(): Session {
  const currentPath = path.join(BACKSOLVE_DIR, "current-session");

  if (!fs.existsSync(currentPath)) {
    throw new Error("No active Backsolve session. Run: backsolve capture \"Objective\"");
  }

  const id = fs.readFileSync(currentPath, "utf8").trim();
  const sessionPath = path.join(BACKSOLVE_DIR, "sessions", `${id}.json`);
  const raw = JSON.parse(fs.readFileSync(sessionPath, "utf8"));

  return SessionSchema.parse(raw);
}

export function saveSession(session: Session): void {
  ensureProject();

  fs.writeFileSync(
    path.join(BACKSOLVE_DIR, "sessions", `${session.id}.json`),
    JSON.stringify(session, null, 2)
  );
}
