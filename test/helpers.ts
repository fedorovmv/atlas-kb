import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initMemory } from "../src/commands/init.js";

export async function createTempProject() {
  const root = await mkdtemp(path.join(tmpdir(), "repo-memory-test-"));
  await initMemory({ root });

  await mkdir(path.join(root, "internal/registry"), { recursive: true });
  await mkdir(path.join(root, "pkg/agentcard"), { recursive: true });
  await mkdir(path.join(root, "internal/mcp"), { recursive: true });
  await mkdir(path.join(root, "tests/agent-registry"), { recursive: true });

  await writeFile(
    path.join(root, "internal/registry/access_filter.go"),
    `package registry\n\nfunc FilterCardsForCaller(caller string) []string { return []string{caller} }\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "tests/agent-registry/access_filter_test.go"),
    `package registry_test\n\nfunc TestFilterCardsForCaller() {}\n`,
    "utf8",
  );

  return root;
}
