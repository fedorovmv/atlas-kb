import type { MemoryFrontmatter } from "../schemas/frontmatter.js";

export type MemoryCard = {
  path: string;
  relativePath: string;
  meta: MemoryFrontmatter;
  body: string;
  raw: string;
};

export type RepoMemoryOptions = {
  root?: string;
  memoryRoot?: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type ContextPack = {
  query: string;
  selected: MemoryCard[];
  related: MemoryCard[];
  codeRefs: string[];
  testRefs: string[];
  markdown: string;
};
