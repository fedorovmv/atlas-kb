import { readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { resolveRoot } from "./paths.js";
import { ModelRouting, ModelRoutingSchema } from "../schemas/modelRouting.js";

export async function loadModelRouting(root: string): Promise<ModelRouting | null> {
  const configPath = path.join(root, ".ai/memory-tool/config/model-routing.yaml");
  if (!existsSync(configPath)) {
    return null;
  }
  const content = await readFile(configPath, "utf8");
  const parsed = yaml.load(content);
  return ModelRoutingSchema.parse(parsed);
}

export async function switchProfile(options: {
  root?: string;
  profile: "quality" | "balanced" | "economy";
}): Promise<void> {
  const root = resolveRoot(options);
  const configPath = path.join(root, ".ai/memory-tool/config/model-routing.yaml");

  if (!existsSync(configPath)) {
    throw new Error("model-routing.yaml not found. Run: repo-memory init");
  }

  const content = await readFile(configPath, "utf8");
  let routing = ModelRoutingSchema.parse(yaml.load(content));
  routing.activeProfile = options.profile;
  routing = ModelRoutingSchema.parse(routing);

  const updated = yaml.dump(routing, { lineWidth: -1 });
  const temp = configPath + ".tmp";
  await writeFile(temp, updated, "utf8");
  await rename(temp, configPath);
}

export async function getActiveProfile(root: string): Promise<string> {
  const routing = await loadModelRouting(root);
  return routing?.activeProfile ?? "balanced";
}
