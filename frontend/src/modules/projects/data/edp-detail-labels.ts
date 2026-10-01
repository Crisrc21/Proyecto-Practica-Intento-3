import type { Milestone, StageKey } from "../types";
const labels: Partial<Record<StageKey, string>> = {
  fabricacion: "Vivienda", interior: "Vivienda - Urbanización Interior", montaje: "Vivienda - TGM",
  exterior: "Urbanización Exterior", despachos: "Despachos", fundaciones: "Fundaciones",
  calles: "Calles", otras: "Otras obras", total: "Avance total", anticipo: "Anticipo", firma: "Firma"
};
export function edpDetailLabels(m?: Milestone): string[] {
  if (!m) return [];
  const keys = m.detailKeys?.length ? m.detailKeys : m.edp?.stageKey ? [m.edp.stageKey] : [];
  const selected = keys.map(key => labels[key]).filter((label): label is string => Boolean(label));
  return [...new Set(selected.length ? selected : m.scope ? [m.scope] : [])];
}
