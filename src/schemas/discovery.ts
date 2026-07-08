import { z } from "zod";

export const FileKindSchema = z.enum([
  "code",
  "test",
  "doc",
  "spec",
  "config",
  "contract",
  "demo",
  "example",
  "legacy",
  "unknown",
]);

export const FileRecordSchema = z.object({
  path: z.string(),
  kind: FileKindSchema,
  language: z.string().optional(),
  basename: z.string(),
  dirname: z.string(),
  sizeBytes: z.number(),
  mtime: z.string().optional(),
  signals: z.array(z.string()),
  topics: z.array(z.string()),
});

export const CandidateModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  topics: z.array(z.string()),
  codeFiles: z.array(z.string()),
  testFiles: z.array(z.string()),
  docFiles: z.array(z.string()),
  specFiles: z.array(z.string()),
  demoFiles: z.array(z.string()),
  signals: z.array(z.string()),
});

export const DiscoveryReportSchema = z.object({
  root: z.string(),
  files: z.array(FileRecordSchema),
  candidateModules: z.array(CandidateModuleSchema),
});

export type FileRecord = z.infer<typeof FileRecordSchema>;
export type FileKind = z.infer<typeof FileKindSchema>;
export type CandidateModule = z.infer<typeof CandidateModuleSchema>;
export type DiscoveryReport = z.infer<typeof DiscoveryReportSchema>;
