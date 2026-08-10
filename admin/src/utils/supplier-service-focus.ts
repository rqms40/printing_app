/** Keep keys in sync with server SUPPLIER_SERVICE_FOCUS_KEYS. */
export const SUPPLIER_SERVICE_FOCUS_LABELS: Record<string, string> = {
  signages: "Signages",
  tarpaulins: "Tarpaulins",
  document_printing: "Document Printing",
  apparel: "Apparel / Shirt Printing",
  stickers_labels: "Stickers & Labels",
  large_format: "Large Format",
  "3d_printing": "3D Printing",
  invitations_cards: "Invitations & Cards",
};

export type RankedServiceFocus = {
  rank: number;
  key: string;
  label: string;
};

export function rankLabel(rank: number): string {
  if (rank === 1) return "Top 1";
  if (rank === 2) return "Top 2";
  if (rank === 3) return "Top 3";
  return `Top ${rank}`;
}

export function labelForServiceFocusKey(key: string): string {
  return SUPPLIER_SERVICE_FOCUS_LABELS[key] ?? key.replace(/_/g, " ");
}

export function toRankedServices(
  ranks: string[] | null | undefined,
): RankedServiceFocus[] {
  if (!Array.isArray(ranks)) return [];
  const seen = new Set<string>();
  const out: RankedServiceFocus[] = [];
  for (const raw of ranks) {
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      rank: out.length + 1,
      key,
      label: labelForServiceFocusKey(key),
    });
  }
  return out;
}
