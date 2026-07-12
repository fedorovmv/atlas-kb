import { buildMemoryContext } from "../core/context.js";
import { checkContextFreshness } from "../core/hashing.js";

export async function contextCheckCommand(options: {
  root?: string;
  query?: string;
  json?: boolean;
}): Promise<void> {
  // Build context pack with freshness tracking
  const pack = await buildMemoryContext(options.query ?? "", {
    root: options.root,
    trackFreshness: true,
    limit: 8,
  });
  const freshness = await checkContextFreshness(pack, options.root ?? process.cwd());

  if (options.json) {
    console.log(JSON.stringify({ fresh: freshness.fresh, staleFiles: freshness.staleFiles, reason: freshness.reason }, null, 2));
  } else {
    if (freshness.fresh) {
      console.log("Context is fresh.");
    } else {
      console.log("Context is stale.");
      if (freshness.reason) console.log(`Reason: ${freshness.reason}`);
      if (freshness.staleFiles.length > 0) {
        console.log("\nStale files:");
        for (const f of freshness.staleFiles) console.log(`  - ${f}`);
      }
    }
  }
}
