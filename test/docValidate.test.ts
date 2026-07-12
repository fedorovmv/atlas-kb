import { describe, test, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateDocs } from "../src/core/docValidate.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "docvalidate-test-"));
}

function validDocContent(title = "Test Doc"): string {
  return `---
node_type: service
title: ${title}
service: my-service
status: active
updated: "2025-01-15"
tags:
  - test
links: {}
---
# ${title}

This is a valid documentation body with enough characters to pass the minimum length check.

It references [the service](./other.md) for more details.

## Evidence

Evidence section with details about the service.

See [documentation](https://example.com/docs) for more.
`;
}

function indexDocContent(title = "Index"): string {
  return `---
node_type: index
title: ${title}
service: my-service
status: active
updated: "2025-01-15"
tags:
  - index
links: {}
---
# ${title}

This is an index document with enough character length to pass validation minimums.

See [documentation](https://example.com/index) for more information.
`;
}

describe("validateDocs", () => {
  test("empty docs directory returns ok", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    const result = await validateDocs({ root });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("valid doc passes validation", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    await writeFile(path.join(root, ".ai", "docs", "test.md"), validDocContent(), "utf8");
    // Also create the self-referenced link to avoid broken link error
    await writeFile(path.join(root, ".ai", "docs", "other.md"), validDocContent("Other"), "utf8");
    const result = await validateDocs({ root });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("active service doc without Evidence section is rejected", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    const content = `---
node_type: service
title: No Evidence Doc
service: my-service
status: active
updated: "2025-01-15"
tags:
  - test
links: {}
---
# No Evidence

This doc does not have an evidence section but has enough characters in body text for the length check here.

See [link text](https://example.com) for reference.
`;
    await writeFile(path.join(root, ".ai", "docs", "no-evidence.md"), content, "utf8");
    const result = await validateDocs({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("Evidence"))).toBe(true);
  });

  test("doc with body less than 40 characters is rejected", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    const content = `---
node_type: service
title: Short Doc
service: my-service
status: active
updated: "2025-01-15"
tags:
  - test
links: {}
---
# Short

Short body.
`;
    await writeFile(path.join(root, ".ai", "docs", "short.md"), content, "utf8");
    const result = await validateDocs({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("40 characters"))).toBe(true);
  });

  test("doc with broken local markdown link is rejected", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    const content = `---
node_type: service
title: Broken Link Doc
service: my-service
status: active
updated: "2025-01-15"
tags:
  - test
links: {}
---
# Broken Link Doc

This documentation has enough characters to pass the minimum length check for validation.

It references [missing file](./nonexistent.md) which should be caught by the validator.

## Evidence

Evidence here that proves the service exists and works as described above.
`;
    await writeFile(path.join(root, ".ai", "docs", "broken-link.md"), content, "utf8");
    const result = await validateDocs({ root });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("broken local link"))).toBe(true);
  });

  test("index doc without Evidence section is accepted (exempt)", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    await writeFile(path.join(root, ".ai", "docs", "index.md"), indexDocContent(), "utf8");
    const result = await validateDocs({ root });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("doc without frontmatter is skipped (not an error)", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, ".ai", "docs"), { recursive: true });
    await writeFile(
      path.join(root, ".ai", "docs", "no-frontmatter.md"),
      "# No frontmatter doc\n\nThis doc has no frontmatter at all...\n",
      "utf8",
    );
    const result = await validateDocs({ root });
    // File without frontmatter should be skipped entirely, resulting in no errors
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
