export function hasEvidenceSection(body: string, sectionName: string): boolean {
  const pattern = new RegExp(`^##\\s+${sectionName}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`, "im");
  const match = body.match(pattern);
  if (!match) return false;
  return /^-\s+/m.test(match[0]);
}
