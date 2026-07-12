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
  staleProposalDays?: number;
  requireSourceCoverage?: boolean;
  checkDispatch?: boolean;
  checkContract?: boolean;
  maxErrors?: number;
  strictWarnings?: boolean;
  trackFreshness?: boolean;
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
  // F1: optional freshness tracking
  repositoryHead?: string;
  sourceHashes?: Record<string, string>;
  generatedAt?: string;
};
