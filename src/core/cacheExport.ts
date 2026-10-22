import fs from "node:fs";
import path from "node:path";
import { Session } from "../schema/session.js";
import { Whyfile } from "../schema/whyfile.js";
import { renderWhyfileMarkdown } from "./whyfileBuilder.js";
import { exportProvenance, CONFIDENCE_NOTICE, ProvenanceBundle } from "./provenance.js";
import { BACKSOLVE_DIR } from "../storage/projectStore.js";

type BscacheBundle = {
  bscache_version: "0.1";
  exported_at: string;
  whyfile: Whyfile;
  confidence_notice?: string;
  whyfile_markdown?: string;
  provenance?: ProvenanceBundle;
  evidence: {
    chats: string[];
    diffs: string[];
    tests: Session["tests"];
  };
};

export function exportCache(session: Session, whyfile: Whyfile): string {
  const bundle: BscacheBundle = {
    bscache_version: "0.1",
    exported_at: new Date().toISOString(),
    whyfile,
    evidence: {
      chats: session.chats,
      diffs: session.diffs,
      tests: session.tests
    }
  };

  const markdown = renderWhyfileMarkdown(whyfile);
  const provenance = exportProvenance(session, markdown);
  bundle.confidence_notice = CONFIDENCE_NOTICE;
  if (provenance) {
    bundle.provenance = provenance;
    bundle.whyfile_markdown = markdown;
    fs.writeFileSync(path.join(BACKSOLVE_DIR, "whyfiles", `${session.id}.provenance.json`), JSON.stringify(provenance, null, 2) + "\n");
  }
  const filePath = path.join(BACKSOLVE_DIR, "caches", `${session.id}.bscache`);
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`);

  return filePath;
}
