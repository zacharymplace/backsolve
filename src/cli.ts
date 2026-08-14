#!/usr/bin/env node
import { Command } from "commander";
import { ensureProject, createSession, getCurrentSession } from "./storage/projectStore.js";

const program = new Command();

program
  .name("backsolve")
  .description("Local-first AI work reconstruction engine.")
  .version("0.1.0");

program.command("init").action(() => {
  ensureProject();
  console.log("Backsolve initialized at .backsolve/");
});

program.command("capture")
  .argument("<objective>")
  .action((objective: string) => {
    const session = createSession(objective);
    console.log(`Session started: ${session.id}`);
  });

program.command("review").action(() => {
  const session = getCurrentSession();
  console.log(JSON.stringify(session, null, 2));
});

program.command("demo").action(() => {
  ensureProject();
  const session = createSession("Demo reconstruction session");
  console.log(`Demo session created: ${session.id}`);
});

program.parse();
