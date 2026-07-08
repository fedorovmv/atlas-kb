import { discoverProject } from "../core/discoverProject.js";
import type { RepoMemoryOptions } from "../core/types.js";

export async function discoverMemoryCommand(options: RepoMemoryOptions & { json?: boolean } = {}) {
  const report = await discoverProject(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const kindCounts = report.files.reduce((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log("# Project discovery");
  console.log(`\nRoot: ${report.root}`);
  console.log(`\n## Files by kind`);
  for (const [kind, count] of Object.entries(kindCounts).sort()) console.log(`- ${kind}: ${count}`);
  console.log(`\n## Candidate modules`);
  for (const mod of report.candidateModules) console.log(`- ${mod.id} (${mod.confidence}): ${mod.codeFiles.length} code, ${mod.testFiles.length} test, ${mod.docFiles.length} doc`);
}
