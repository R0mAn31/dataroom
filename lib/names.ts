/** "report.pdf" -> { base: "report", ext: ".pdf" }; folders keep ext = "". */
export function splitName(name: string, isFile: boolean) {
  if (!isFile) return { base: name, ext: "" };
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * Resolves a name conflict the way desktop file managers do:
 * "report.pdf" -> "report (2).pdf" -> "report (3).pdf" ...
 * `taken` must contain lowercased names.
 */
export function nextAvailableName(
  name: string,
  taken: Set<string>,
  isFile: boolean
): string {
  if (!taken.has(name.toLowerCase())) return name;
  const { base, ext } = splitName(name, isFile);
  // If the name already ends with " (n)", bump from there.
  const match = base.match(/^(.*) \((\d+)\)$/);
  const stem = match ? match[1] : base;
  let n = match ? Number(match[2]) + 1 : 2;
  while (taken.has(`${stem} (${n})${ext}`.toLowerCase())) n++;
  return `${stem} (${n})${ext}`;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= 255 && !name.includes("/");
}
