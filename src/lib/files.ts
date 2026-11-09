/**
 * File naming rules (CLAUDE.md): lowercase, hyphens instead of spaces,
 * descriptive, no special characters. "Venue Options!" → "venue-options".
 */
export function slugify(title: string, fallback = "document"): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // café → cafe
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function documentFilename(title: string, kind: "doc" | "checklist" | "sheet"): string {
  return `${slugify(title)}.${kind === "sheet" ? "csv" : "md"}`;
}
