export function hasEvidenceSection(body: string, sectionName: string): boolean {
  const pattern = new RegExp(`^##\\s+${sectionName}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`, "im");
  const match = body.match(pattern);
  if (!match) return false;
  return /^-\s+/m.test(match[0]);
}

export function hasQualityEvidenceSection(body: string, sectionName: string): boolean {
  const pattern = new RegExp(`^##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "im");
  const match = body.match(pattern);
  if (!match) return false;
  const sectionContent = match[1];
  const bullets = sectionContent.match(/^\s*-\s+.+$/gm) ?? [];
  if (bullets.length === 0) return false;
  // Accept evidence bullets that contain a file path with line number.
  // Supported formats (agent output varies):
  //   - <description> at <path>:<line> (symbol)        ← canonical
  //   - <description> — verified: <path>:<line> (sym)   ← alt
  //   - `<path>:<line>-<line>` — <description>           ← alt (line range)
  //   - <path>:<line> ...                                ← minimal
  const evidencePattern = /(\bat\s+)?[\w./-]+\.\w+:\d+/;
  for (const bullet of bullets) {
    if (!evidencePattern.test(bullet)) return false;
  }
  return true;
}
