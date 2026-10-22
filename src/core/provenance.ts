import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Session } from "../schema/session.js";

export const CONFIDENCE_NOTICE = "Evidence-completeness heuristic (0–1), not a probability of truth, runtime readiness, or approval. Inferred rationale and missing historical telemetry can still score 1.0.";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const ProvenanceSchema = z.object({
  provenance_version: z.literal("0.1"),
  session_id: z.string().min(1),
  reconstruction_mode: z.enum(["retrospective", "contemporaneous"]),
  reconstructed_at: z.string().datetime({ offset: true }),
  subject: z.object({ repository: z.string().min(1), base_revision: z.string().optional(), release_revision: z.string().optional(), tag: z.string().optional() }).strict(),
  whyfile_sha256: digest.optional(),
  evidence: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/), path: z.string().min(1), sha256: digest,
    kind: z.enum(["artifact", "command_output", "operator_report", "screenshot"]),
    collected_at: z.string().datetime({ offset: true }), observed_at: z.string().datetime({ offset: true }).optional(), source_uri: z.string().optional()
  }).strict()),
  claims: z.array(z.object({ id: z.string().min(1), claim: z.string(), evidence_refs: z.array(z.string()).min(1), limitation: z.string() }).strict()).default([]),
  validations: z.array(z.object({ command: z.string(), exit_code: z.number().int(), captured_at: z.string().datetime({ offset: true }), tested_revision: z.string().optional(), evidence_ref: z.string() }).strict()).default([])
}).strict();
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type ProvenanceBundle = { manifest: Provenance; files: Record<string, string> };
export function sha256(data: string | Buffer): string { return createHash("sha256").update(data).digest("hex"); }
function localFile(root: string, relative: string): string {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw new Error(`Unsafe evidence path: ${relative}`);
  const base = fs.realpathSync(root), file = fs.realpathSync(path.resolve(root, relative));
  if (!file.startsWith(base + path.sep) || !fs.statSync(file).isFile()) throw new Error(`Evidence escapes root: ${relative}`);
  return file;
}
export function verifyBundle(raw: unknown, whyfile?: string): ProvenanceBundle {
  const envelope = z.object({ manifest: ProvenanceSchema, files: z.record(z.string()) }).strict().parse(raw);
  const m = envelope.manifest, ids = new Set<string>();
  for (const e of m.evidence) {
    if (ids.has(e.id)) throw new Error(`Duplicate evidence ID: ${e.id}`);
    ids.add(e.id);
    if (!Object.hasOwn(envelope.files, e.id) || sha256(Buffer.from(envelope.files[e.id], "base64")) !== e.sha256) throw new Error(`Missing or changed evidence: ${e.id}`);
  }
  if (Object.keys(envelope.files).some(id => !ids.has(id))) throw new Error("Unreferenced bundled evidence");
  if (new Set(m.claims.map(c => c.id)).size !== m.claims.length) throw new Error("Duplicate claim ID");
  if (new Set(m.validations.map(v => v.evidence_ref)).size !== m.validations.length) throw new Error("Duplicate validation evidence reference");
  for (const ref of [...m.claims.flatMap(c => c.evidence_refs), ...m.validations.map(v => v.evidence_ref)]) {
    if (!ids.has(ref)) throw new Error(`Missing evidence reference: ${ref}`);
  }
  if (whyfile !== undefined && m.whyfile_sha256 !== sha256(whyfile)) throw new Error("Whyfile hash mismatch");
  return envelope;
}
export function readManifest(file: string): ProvenanceBundle {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (raw.manifest) return verifyBundle(raw);
  const manifest = ProvenanceSchema.parse(raw);
  const files: Record<string, string> = Object.create(null);
  for (const e of manifest.evidence) files[e.id] = fs.readFileSync(localFile(path.dirname(file), e.path)).toString("base64");
  return verifyBundle({ manifest, files });
}
function sidecarPath(session: Session): string {
  return path.join(".backsolve", "provenance", `${session.id}.json`);
}
export function attachProvenance(session: Session, file: string): void {
  const bundle = readManifest(file);
  if (bundle.manifest.session_id !== session.id) throw new Error("Sidecar session_id must match the active session");
  // Snapshot bytes when attached; later edits to original files cannot silently change exports.
  fs.mkdirSync(path.dirname(sidecarPath(session)), { recursive: true });
  fs.writeFileSync(sidecarPath(session), JSON.stringify(bundle, null, 2) + "\n");
}
export function loadProvenance(session: Session): ProvenanceBundle | undefined {
  const file = sidecarPath(session);
  if (!fs.existsSync(file)) return undefined;
  const bundle = verifyBundle(JSON.parse(fs.readFileSync(file, "utf8")));
  if (bundle.manifest.session_id !== session.id) throw new Error("Stored sidecar session_id does not match active session");
  return bundle;
}
export function exportProvenance(session: Session, whyfileMarkdown: string): ProvenanceBundle | undefined {
  const bundle = loadProvenance(session);
  if (!bundle) return undefined;
  // Preserve full output and its capture time. Never bind it to the release revision by inference.
  for (const validation of bundle.manifest.validations) {
    const match = validation.evidence_ref.match(/^validation-([1-9][0-9]*)$/);
    if (match && Number(match[1]) > session.tests.length) throw new Error("Stale captured test provenance");
  }
  session.tests.forEach((test, index) => {
    const id = `validation-${index + 1}`;
    const previous = bundle.manifest.evidence.find(e => e.id === id);
    if (previous) {
      const validation = bundle.manifest.validations.find(v => v.evidence_ref === id);
      if (previous.sha256 !== sha256(test.output) || !validation || validation.command !== test.command || validation.exit_code !== test.exit_code || validation.captured_at !== test.captured_at || validation.tested_revision !== test.tested_revision) throw new Error(`Reserved evidence ID conflict: ${id}`);
      return;
    }
    bundle.files[id] = Buffer.from(test.output).toString("base64");
    bundle.manifest.evidence.push({ id, path: `validation/${id}.txt`, sha256: sha256(test.output), kind: "command_output", collected_at: test.captured_at });
    bundle.manifest.validations.push({ command: test.command, exit_code: test.exit_code, captured_at: test.captured_at, tested_revision: test.tested_revision, evidence_ref: id });
  });
  bundle.manifest.whyfile_sha256 = sha256(whyfileMarkdown);
  return verifyBundle(bundle, whyfileMarkdown);
}
