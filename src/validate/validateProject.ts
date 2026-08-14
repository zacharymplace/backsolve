import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { WhyfileSchema } from "../schema/whyfile.js";

const dir = ".backsolve/whyfiles";

if (!fs.existsSync(".backsolve")) {
  console.log("No .backsolve directory yet. Run backsolve init.");
  process.exit(0);
}

if (!fs.existsSync(dir)) {
  console.log("No Whyfiles directory yet.");
  process.exit(0);
}

const files = fs.readdirSync(dir).filter((file) => file.endsWith(".why.md"));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf8");
  const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);

  if (!yamlMatch) {
    throw new Error(`Missing YAML block in ${file}`);
  }

  const parsed = YAML.parse(yamlMatch[1]);
  WhyfileSchema.parse(parsed);
}

console.log(`Validated ${files.length} Whyfile(s).`);
