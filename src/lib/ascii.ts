/**
 * Boîte ASCII (box-drawing) : le cadre épouse la ligne la plus longue
 * après retour à la ligne automatique à ~`maxWidth` caractères.
 * Cadre calculé côté serveur (alignement garanti en monospace).
 * Pur utilitaire isomorphe — aucun import next/*.
 */
export function asciiBox(
  title: string,
  text: string | string[],
  maxWidth = 62,
): string {
  const paragraphs = Array.isArray(text) ? text : [text];
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }

  const contentWidth = Math.max(
    title.length + 1,
    ...lines.map((l) => l.length),
  );
  const top = `┌─ ${title} ${"─".repeat(contentWidth - title.length - 1)}┐`;
  const body = lines.map((l) => `│ ${l.padEnd(contentWidth)} │`);
  const bottom = `└${"─".repeat(contentWidth + 2)}┘`;
  return [top, ...body, bottom].join("\n");
}
