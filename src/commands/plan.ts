import { generatePlan } from "../core/plan.js";

export async function planCommand(options: {
  root?: string;
  buildDir?: string;
  scaffoldModules?: boolean;
  json?: boolean;
}): Promise<void> {
  const result = await generatePlan({
    root: options.root,
    buildDir: options.buildDir,
    scaffoldModules: options.scaffoldModules,
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`# Card plan generated: ${result.planPath}`);
    console.log(`\nRequired top-level cards: ${result.requiredCards.length}`);
    for (const card of result.requiredCards) console.log(`  - ${card}`);
    console.log(`\nCandidate module cards: ${result.candidateModuleCards.length}`);
    for (const mod of result.candidateModuleCards) console.log(`  - ${mod.id} (${mod.runtimeTier})`);
    console.log(`\nCandidate architecture cards: ${result.candidateArchitectureCards.length}`);
    for (const arch of result.candidateArchitectureCards) console.log(`  - ${arch.id}`);
  }
}
