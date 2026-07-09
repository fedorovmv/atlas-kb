import { updateMemoryCard } from "../core/updateMemory.js";

export async function updateMemoryCommand(
  id: string,
  options: { root?: string; memoryRoot?: string; body?: string; bodyFile?: string; set?: string[]; json?: boolean } = {},
) {
  // Read body from --body-file if specified
  let body: string | undefined = options.body;
  if (options.bodyFile) {
    const { readFile } = await import("node:fs/promises");
    body = await readFile(options.bodyFile, "utf8");
  }

  // Parse --set field=value pairs
  let fields: Record<string, unknown> | undefined;
  if (options.set && options.set.length > 0) {
    fields = {};
    for (const item of options.set) {
      const eqIdx = item.indexOf("=");
      if (eqIdx === -1) {
        throw new Error(`Invalid --set format, expected field=value: ${item}`);
      }
      const key = item.slice(0, eqIdx).trim();
      const value = item.slice(eqIdx + 1).trim();
      // Try to parse value as JSON (for booleans, numbers, arrays)
      try {
        fields[key] = JSON.parse(value);
      } catch {
        fields[key] = value;
      }
    }
  }

  const result = await updateMemoryCard(id, { root: options.root, memoryRoot: options.memoryRoot, body, fields });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.updated) {
    console.log(`# No changes for ${id}`);
    console.log(`Path: ${result.path}`);
    return;
  }

  console.log(`# Updated memory card: ${id}`);
  console.log(`Path: ${result.path}`);
  console.log(`Changes: ${result.changes.join(", ")}`);
}
