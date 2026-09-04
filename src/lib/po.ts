/**
 * Purchase-order vocabulary shared by the Procurement page and the PO builder
 * dialog — the status choices an operator may set later, and the sequential
 * `PUR-<year>-<n>` suggestion used when drafting a new order. Kept off the
 * page components so a PO's conventions live in one place.
 */

export const PO_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent to Supplier" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In Progress" },
  { value: "received", label: "Received" },
];

/** Suggest the next `PUR-<year>-<n>` number above the highest seen in `rows`. */
export function nextPoNumber(rows: Array<{ po_number?: string | null }>): string {
  let max = 0;
  for (const r of rows ?? []) {
    const m = /PUR-\d{4}-(\d+)/.exec(String(r.po_number ?? ""));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const year = new Date().getFullYear();
  return `PUR-${year}-${String(max + 1).padStart(4, "0")}`;
}
