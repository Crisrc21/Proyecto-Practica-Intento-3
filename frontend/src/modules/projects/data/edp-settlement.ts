import type { Milestone } from "../types";

export function fixedEdpDeductions(s: NonNullable<Milestone["settlement"]>) {
  return { ...s, advanceRecovery: s.applyAdvanceRecovery === false ? 0 : Math.round(s.gross * 0.20), retention: s.applyRetention === false ? 0 : Math.round(s.gross * 0.05) };
}

export function settlementTotals(s: NonNullable<Milestone["settlement"]>) {
  const base = s.gross - s.advanceRecovery - s.retention - (s.discounts || 0) - (s.penalties || 0) + (s.adjustments || 0);
  const taxed = s.taxMode === "iva19-ceec309";
  const net = taxed ? Math.round(base) : base;
  const iva = taxed ? Math.round(net * 0.19) : 0;
  const ceec = taxed ? Math.round(net * 0.0309) : 0;
  return { net, iva, ceec, total: taxed ? net + iva - ceec : Math.round(net * 100) / 100 };
}
