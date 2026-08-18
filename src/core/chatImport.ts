import fs from "node:fs";
import { getCurrentSession, saveSession } from "../storage/projectStore.js";

export function importChat(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Chat file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const session = getCurrentSession();

  session.chats.push(`# source: ${filePath}\n\n${content}`);
  saveSession(session);
}
