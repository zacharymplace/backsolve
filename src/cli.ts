#!/usr/bin/env node
import fs from "node:fs";
import { verifyCache } from "./core/cacheVerify.js";
import { attachProvenance, loadProvenance, CONFIDENCE_NOTICE } from "./core/provenance.js";
import { Command } from "commander";
import { ensureProject, createSession, getCurrentSession, saveSession } from "./storage/projectStore.js";
import { importChat } from "./core/chatImport.js";
import { scanDiff } from "./core/diffScan.js";
import { captureTest } from "./core/testCapture.js";
import { addDecision } from "./core/decisionCapture.js";
import { addRisk } from "./core/riskCapture.js";
import { writeWhyfile } from "./core/whyfileBuilder.js";
import { exportCache } from "./core/cacheExport.js";

const program = new Command();

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

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
  console.log(JSON.stringify({ session, provenance: loadProvenance(session)?.manifest, confidence_notice: CONFIDENCE_NOTICE }, null, 2));
});

program.command("import-chat")
  .argument("<file>")
  .action((file: string) => {
    importChat(file);
    console.log(`Chat imported: ${file}`);
  });

program.command("scan-diff")
  .option("--base <ref>", "diff against a base ref instead of the working tree")
  .action((options: { base?: string }) => {
    scanDiff(options.base);
    console.log(options.base ? `Diff scanned against ${options.base}` : "Working tree diff scanned");
  });

program.command("add-test")
  .argument("<command>")
  .option("--revision <revision>", "explicit tested revision; omit when unknown")
  .action((command: string, options: { revision?: string }) => {
    const { exitCode } = captureTest(command, options.revision);
    console.log(`Test captured (exit ${exitCode}): ${command}`);
  });

program.command("add-decision")
  .requiredOption("--decision <text>", "what was decided")
  .requiredOption("--rationale <text>", "why it was decided")
  .option("--evidence <item>", "supporting evidence (repeatable)", collect, [])
  .option("--confidence <level>", "confirmed | inferred | unsupported | contradicted | needs_review")
  .option("--status <status>", "proposed | accepted | rejected | superseded")
  .action((options: { decision: string; rationale: string; evidence: string[]; confidence?: string; status?: string }) => {
    addDecision(options);
    console.log(`Decision recorded: ${options.decision}`);
  });

program.command("add-risk")
  .requiredOption("--risk <text>", "what could go wrong")
  .option("--severity <level>", "low | medium | high")
  .option("--mitigation <text>", "how the risk is mitigated")
  .option("--status <status>", "open | accepted | resolved")
  .action((options: { risk: string; severity?: string; mitigation?: string; status?: string }) => {
    addRisk(options);
    console.log(`Risk recorded: ${options.risk}`);
  });

program.command("set-outcome")
  .argument("<text>")
  .action((text: string) => {
    const session = getCurrentSession();
    session.outcome = text;
    saveSession(session);
    console.log("Outcome recorded.");
  });

program.command("add-question")
  .argument("<text>")
  .action((text: string) => {
    const session = getCurrentSession();
    session.unresolved_questions.push(text);
    saveSession(session);
    console.log("Unresolved question recorded.");
  });

program.command("add-next-action")
  .argument("<text>")
  .action((text: string) => {
    const session = getCurrentSession();
    session.next_actions.push(text);
    saveSession(session);
    console.log("Next action recorded.");
  });

program.command("whyfile").action(() => {
  const session = getCurrentSession();
  const { whyfile, filePath } = writeWhyfile(session);
  console.log(`Whyfile written: ${filePath}`);
  console.log(`Evidence-completeness score: ${whyfile.reconstruction_confidence}`);
  console.log(CONFIDENCE_NOTICE);
});

program.command("attach-provenance")
  .argument("<manifest>", "versioned provenance manifest with evidence paths relative to it")
  .action((manifest: string) => {
    attachProvenance(getCurrentSession(), manifest);
    console.log("Provenance attached; hashes and references checked. This is not truth verification or approval.");
  });

const cache = program.command("cache");

cache.command("export").action(() => {
  const session = getCurrentSession();
  const { whyfile } = writeWhyfile(session);
  const filePath = exportCache(session, whyfile);
  console.log(`Cache exported: ${filePath}`);
});

cache.command("verify")
  .argument("<file>")
  .action((file: string) => {
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    const { hasProvenance } = verifyCache(bundle);
    console.log(hasProvenance
      ? "Cache schema, provenance hashes and references verified. Historical assertions remain assertions."
      : "Legacy cache schema valid; no provenance supplied.");
    console.log(CONFIDENCE_NOTICE);
  });

program.command("demo").action(() => {
  ensureProject();
  const session = createSession("Demo reconstruction session");
  console.log(`Demo session created: ${session.id}`);
});

program.parse();
