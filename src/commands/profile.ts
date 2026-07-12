import { switchProfile, getActiveProfile } from "../core/modelRouting.js";
import { resolveRoot } from "../core/paths.js";

export async function profileCommand(options: {
  root?: string;
  profile?: string;
  json?: boolean;
}): Promise<void> {
  const root = resolveRoot(options);

  if (!options.profile) {
    const current = await getActiveProfile(root);
    if (options.json) {
      console.log(JSON.stringify({ activeProfile: current }, null, 2));
    } else {
      console.log(`Active profile: ${current}`);
    }
    return;
  }

  if (!["quality", "balanced", "economy"].includes(options.profile)) {
    throw new Error(`Invalid profile: ${options.profile}. Valid: quality, balanced, economy`);
  }

  await switchProfile({
    root,
    profile: options.profile as "quality" | "balanced" | "economy",
  });

  if (options.json) {
    console.log(JSON.stringify({ activeProfile: options.profile }, null, 2));
  } else {
    console.log(`Profile switched to: ${options.profile}`);
  }
}
