import type { Milestone, Project } from "../types";

export function advanceReturns(project: Project, advance: Milestone, cutoff: string) {
  const advances = project.milestones.filter(m => m.type === "Anticipo" && m.id !== advance.id).concat(advance);
  const agreed = advances.every(m => m.cashAmount !== null) ? advances.reduce((sum, m) => sum + m.cashAmount!, 0) : null;
  const applied = Math.round(project.milestones.filter(m => m.type === "EDP" && m.edp?.presentedDate && m.edp.presentedDate <= cutoff && m.settlement?.applyAdvanceRecovery !== false)
    .reduce((sum, m) => sum + (m.settlement?.advanceRecovery ?? 0), 0) * 100) / 100;
  const balance = agreed === null ? null : Math.round((agreed - applied) * 100) / 100;
  return { applied, agreed, balance, multiple: advances.length > 1 };
}
