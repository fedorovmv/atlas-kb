import { buildCompaction } from "../core/compaction.js";

export async function compactCommand(options: {
  root?: string;
  maxChars?: number;
  noTruncate?: boolean;
  json?: boolean;
}): Promise<void> {
  const result = await buildCompaction({
    root: options.root,
    maxChars: options.maxChars,
    noTruncate: options.noTruncate,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.content);
  }
}