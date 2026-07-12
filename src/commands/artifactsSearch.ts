import { buildArtifactIndex, artifactSearch } from "../core/artifactIndex.js";

export async function artifactsSearchCommand(options: {
  root?: string;
  query: string;
  limit?: number;
  json?: boolean;
}): Promise<void> {
  const index = await buildArtifactIndex({ root: options.root });
  const hits = artifactSearch(options.query, index, options.limit ?? 8);
  if (options.json) {
    console.log(JSON.stringify({ query: options.query, results: hits }, null, 2));
  } else {
    console.log(`# Artifact search: "${options.query}"`);
    console.log(`\n${hits.length} results:`);
    for (const hit of hits) {
      console.log(`  - [${hit.score}] ${hit.entry.title} (${hit.entry.path})`);
    }
  }
}
