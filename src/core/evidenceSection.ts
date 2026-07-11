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
  for (const bullet of bullets) {
    if (!/at\s+\S+\.\w+:\d+/.test(bullet)) return false;
  }
  return true;
}
