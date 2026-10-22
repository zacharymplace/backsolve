import YAML from "yaml";
import { z } from "zod";
import { WhyfileSchema } from "../schema/whyfile.js";
import { SessionSchema } from "../schema/session.js";
import { verifyBundle } from "./provenance.js";

// Validate the whole cache, not just a valid Whyfile inside an arbitrary envelope.
const CacheSchema = z.object({
  bscache_version: z.literal("0.1"),
  exported_at: z.string().datetime({ offset: true }),
  whyfile: WhyfileSchema,
  confidence_notice: z.string().optional(),
  whyfile_markdown: z.string().optional(),
  provenance: z.unknown().optional(),
  evidence: z.object({ chats: z.array(z.string()), diffs: z.array(z.string()), tests: SessionSchema.shape.tests.removeDefault() }).strict()
}).strict();

export function verifyCache(raw: unknown): { hasProvenance: boolean } {
  const cache = CacheSchema.parse(raw);
  if (cache.provenance === undefined) return { hasProvenance: false };
  if (!cache.whyfile_markdown) throw new Error("Missing bound Whyfile Markdown");
  const provenance = verifyBundle(cache.provenance, cache.whyfile_markdown);
  const match = cache.whyfile_markdown.match(/```yaml\n([\s\S]*?)\n```/);
  if (!match || JSON.stringify(WhyfileSchema.parse(YAML.parse(match[1]))) !== JSON.stringify(cache.whyfile)) throw new Error("Cache Whyfile does not match bound Markdown");
  // Test output appears twice for compatibility: ensure the sidecar does not bless
  // evidence.tests that differs from its hashed output or rendered validation.
  const expected = cache.evidence.tests.map((test, index) => {
    const id = `validation-${index + 1}`;
    const validation = provenance.manifest.validations.find(v => v.evidence_ref === id);
    if (!validation || validation.command !== test.command || validation.exit_code !== test.exit_code || validation.captured_at !== test.captured_at || validation.tested_revision !== test.tested_revision || Buffer.from(provenance.files[id], "base64").toString("utf8") !== test.output) throw new Error(`Cache test differs from provenance: ${id}`);
    return { command: test.command, result: test.exit_code === 0 ? "pass" : "fail", evidence: test.output.slice(0, 4000) };
  });
  if (JSON.stringify(expected) !== JSON.stringify(cache.whyfile.validation)) throw new Error("Cache tests do not match Whyfile validation");
  const generated = provenance.manifest.validations.filter(v => /^validation-[1-9][0-9]*$/.test(v.evidence_ref));
  if (generated.length !== cache.evidence.tests.length) throw new Error("Stale or duplicate captured test provenance");
  return { hasProvenance: true };
}
