import type { Milestone, Project } from "../types";

export function newEdpSettlement(project: Project): NonNullable<Milestone["settlement"]> {
  return { gross: 0, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309",
    ceecPercent: project.edpConditions?.ceecPercent ?? 3.09,
    recoveryPercent: project.edpConditions?.recoveryPercent ?? 20,
    retentionPercent: project.edpConditions?.retentionPercent ?? 5 };
}

export function fixedEdpDeductions(s: NonNullable<Milestone["settlement"]>) {
  return { ...s, advanceRecovery: s.applyAdvanceRecovery === false ? 0 : Math.round(s.gross * (s.recoveryPercent ?? 20) / 100), retention: s.applyRetention === false ? 0 : Math.round(s.gross * (s.retentionPercent ?? 5) / 100) };
}

export function settlementTotals(s: NonNullable<Milestone["settlement"]>) {
  const base = s.gross - s.advanceRecovery - s.retention - (s.discounts || 0) - (s.penalties || 0) + (s.adjustments || 0);
  const taxed = s.taxMode === "iva19-ceec309";
  const net = taxed ? Math.round(base) : base;
  const iva = taxed && !s.ivaExempt ? Math.round(net * 0.19) : 0;
  const ceec = taxed ? Math.round(net * (s.ceecPercent ?? 3.09) / 100) : 0;
  return { net, iva, ceec, total: taxed ? net + iva - ceec : Math.round(net * 100) / 100 };
}
