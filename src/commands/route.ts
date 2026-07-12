import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { analyzeChangeSurface } from "../core/changeSurface.js";
import { routeWorkflow } from "../core/routeWorkflow.js";
import { resolveRoot } from "../core/paths.js";

export async function routeCommand(options: {
  root?: string;
  baseRef?: string;
  json?: boolean;
}): Promise<void> {
  const root = resolveRoot(options);

  const surface = await analyzeChangeSurface({
    root,
    baseRef: options.baseRef,
  });

  const result = routeWorkflow(surface);

  // Write route manifest
  const manifestPath = path.join(root, ".ai/memory-build/latest/route-manifest.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ surface, result }, null, 2), "utf8");

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Workflow mode: ${result.mode.toUpperCase()}`);
    console.log(`Type: ${result.type}`);
    console.log(`Components: ${surface.components.length}`);
    console.log(`Changed files: ${surface.changedFiles.length}`);
    console.log(`Risks: ${result.risks.join(", ") || "none"}`);
    console.log(`\nReasons:`);
    for (const reason of result.reasons) {
      console.log(`  - ${reason}`);
    }
  }
}
