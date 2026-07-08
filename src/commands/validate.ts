import { validateMemory as validate } from "../core/validate.js";

export async function validateMemoryCommand(options: { root?: string; json?: boolean; strictWarnings?: boolean } = {}) {
  const result = await validate({ root: options.root });
  const ok = result.ok && (!options.strictWarnings || result.warnings.length === 0);

  if (options.json) {
    console.log(JSON.stringify({ ...result, ok }, null, 2));
  } else {
    if (ok) {
      console.log("Memory validation OK");
    }
    if (result.errors.length) {
      console.log("\n# Errors");
      for (const error of result.errors) console.log(`- ${error}`);
    }
    if (result.warnings.length) {
      console.log("\n# Warnings");
      for (const warning of result.warnings) console.log(`- ${warning}`);
    }
  }

  if (!ok) process.exitCode = 1;
}
