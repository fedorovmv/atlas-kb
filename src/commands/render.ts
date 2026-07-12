import { renderOverview } from "../core/overview.js";

export async function renderCommand(options: {
  root?: string;
  json?: boolean;
}): Promise<void> {
  const result = await renderOverview({ root: options.root });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`# Overview generated: ${result.overviewPath}`);
    console.log(`Sources: ${result.sourcesPath}`);
    console.log(`\nSections: ${result.sections.length}`);
  }
}