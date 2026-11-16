export function canonicalChamp(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_").startsWith("tft18_")
    ? raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_")
    : `tft18_${raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_")}`;
}
