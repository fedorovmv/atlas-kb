import { triageSources } from "../core/sourceCoverage.js";

export async function triageCommand(options: {
  root?: string;
  buildDir?: string;
  json?: boolean;
}): Promise<void> {
  const result = await triageSources({ root: options.root, buildDir: options.buildDir });
  if (options.json) {
    console.log(JSON.stringify({
      updated: result.updated,
      stillUnknown: result.stillUnknown,
      contentMapPath: result.contentMapPath,
      coveragePath: ".ai/memory/source-coverage.json",
    }, null, 2));
  } else {
    console.log("# Source triage complete");
    console.log(`\nUpdated: ${result.updated} dispositions`);
    console.log(`Still unknown: ${result.stillUnknown}`);
    console.log(`Coverage: .ai/memory/source-coverage.json`);
    console.log(`Content maps: ${result.contentMapPath}`);
  }
}
