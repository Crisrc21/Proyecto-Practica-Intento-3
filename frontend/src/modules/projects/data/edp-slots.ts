import type { Milestone, Project } from "../types";

// Stable slots allow existing declarations to appear immediately without creating financial projections.
export function edpSlots(project: Project): Milestone[] {
  const saved = project.milestones.filter(m => ["EDP", "Anticipo", "Retenciones"].includes(m.type));
  const total = saved.find(m => m.type === "EDP" && m.edpCount != null)?.edpCount || 0;
  const result = [...saved];
  let remaining = total - saved.filter(m => m.type === "EDP").length;
  for (let n = 1; remaining > 0 && n <= 450; n++) {
    const id = `${project.id}-edp-slot-${n}`;
    if (saved.some(m => m.id === id || m.type === "EDP" && new RegExp(`^EDP\\s*${n}(?:\\D|$)`, "i").test(m.name))) continue;
    result.push({ id, name: `EDP ${n}`, type: "EDP", scope: "Fabricación", startDate: null, baselineDate: null, forecastDate: null, actualDate: null, baselineApproved: false, state: "Pendiente", evidence: "", notes: "", source: "", cashAmount: null, baselineCashAmount: null, cashDate: null, baselineCashDate: null,
      edp: { stageKey: "fabricacion", metric: "m2", threshold: 1, documentOnly: true, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" } });
    remaining--;
  }
  const order = (m: Milestone) => m.type === "Anticipo" ? 0 : m.type === "Retenciones" ? 2 : 1;
  return result.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, "es", { numeric: true }));
}

export function edpListStatus(m: Milestone) {
  try {
    const link = new URL(m.source.trim());
    return ["http:", "https:"].includes(link.protocol) ? "Presentado" : "En proceso";
  } catch {
    return "En proceso";
  }
}

export function latestRegisteredEdp(project: Project, cutoff: string) {
  const ordinal = (m: Milestone) => Number(m.name.match(/\bEDP\s*(?:N[°ºo.]?\s*)?(\d+)/i)?.[1] || m.id.match(/-edp-slot-(\d+)$/)?.[1] || 0);
  return project.milestones.filter(m => m.type === "EDP" && (!m.edp?.presentedDate || m.edp.presentedDate <= cutoff))
    .map((m, index) => ({ m, index }))
    .sort((a, b) => ordinal(b.m) - ordinal(a.m) || (b.m.edp?.presentedDate || "").localeCompare(a.m.edp?.presentedDate || "") || b.index - a.index)[0]?.m;
}
