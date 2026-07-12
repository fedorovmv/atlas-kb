import yaml from "js-yaml";
import { readFile } from "node:fs/promises";

/** Dump frontmatter data as YAML with no line wrapping. */
export function frontmatterYaml(data: Record<string, unknown>): string {
  return yaml.dump(data, { lineWidth: -1 }).trimEnd();
}

/** Read a file, return empty string if it doesn't exist. */
export async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

/** Today's date as YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}