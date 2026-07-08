import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { scaffoldFiles } from "../scaffold/templates.js";

export async function initMemory(options: { root?: string; force?: boolean; dryRun?: boolean } = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of scaffoldFiles) {
    const target = path.join(root, file.path);
    if (existsSync(target) && !options.force) {
      skipped.push(file.path);
      continue;
    }
    if (!options.dryRun) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
    written.push(file.path);
  }

  const packageJsonPath = path.join(root, "package.json");
  const packageHint = existsSync(packageJsonPath)
    ? "Add or keep a root script like: \"memory\": \"tsx .ai/memory-tool/src/cli.ts\" if you vendor this tool into the repo."
    : "Create package.json or run this kit from its own directory.";

  console.log(`# Memory scaffold ${options.dryRun ? "plan" : "created"}`);
  console.log(`\nRoot: ${root}`);
  if (written.length) {
    console.log("\n## Written");
    for (const item of written) console.log(`- ${item}`);
  }
  if (skipped.length) {
    console.log("\n## Skipped existing files");
    for (const item of skipped) console.log(`- ${item}`);
  }
  console.log(`\n## Next steps`);
  console.log(`- ${packageHint}`);
  console.log(`- Run: npm run memory -- validate`);
  console.log(`- Run: npm run memory -- context "изменить Agent & Tool Registry"`);
}
