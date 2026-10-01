export const milestoneTypes = ["Contrato", "Anticipo", "EDP", "Recepción", "Retenciones", "Otro", "Etapa"] as const;
export const projectScopes = ["Fabricación", "Despacho", "Fundaciones", "Montaje", "Urbanización Interior", "Urbanización Exterior", "Calles", "Otras obras"] as const;
export const legacyScopes = ["General", "Obra civil", "Viviendas", "Urba interior", "Urba exterior", "TGM"] as const;
export type Currency = "UF" | "CLP";
export type StageKey = "firma" | "anticipo" | "fabricacion" | "despachos" | "fundaciones" | "montaje" | "interior" | "exterior" | "calles" | "otras" | "total";
export type ProgressMetric = "firma" | "m2" | "terminadas" | "despachadas" | "fundaciones" | "fundacionesPct" | "montadas" | "interiorPct" | "exteriorPct" | "callesPct" | "otrasPct" | "totalPct";
export interface ProgressReport {
  id: string; stageKey: StageKey; date: string; evidence: string; period?: string; periodQuantity?: number;
  quantity: number | null; completedUnits: number | null; percent: number | null;
}
export interface EdpCondition {
  documentOnly?: boolean;
  stageKey: StageKey; metric: ProgressMetric; threshold: number;
  status: "Previsto" | "Preparado" | "Presentado" | "Aprobado";
  triggeredDate: string | null; presentedDate: string | null; approvedDate: string | null; approvalEvidence: string;
}
export interface Milestone {
  id: string; name: string; type: typeof milestoneTypes[number]; scope: typeof projectScopes[number] | typeof legacyScopes[number]; edpCount?: number; detailKeys?: StageKey[];
  startDate: string | null; baselineDate: string | null; forecastDate: string | null; actualDate: string | null;
  baselineApproved: boolean; state: "Pendiente" | "En curso" | "Observado";
  evidence: string; source: string; notes: string;
  invoicingComplete?: boolean;
  settlement?: { applyAdvanceRecovery?: boolean; applyRetention?: boolean; gross: number; advanceRecovery: number; retention: number; discounts?: number; penalties?: number; adjustments?: number; taxMode?: "iva19-ceec309" };
  stageKey?: StageKey;
  edp?: EdpCondition;
  cashAmount: number | null; baselineCashAmount: number | null; cashDate: string | null; baselineCashDate: string | null;
}
export interface HouseEvent { id: string; house: number; stage: "despachos" | "montaje"; date: string | null; evidence: string }
export interface SimulationInvoice { id: string; number: string; amountUF: number; issued: string; due: string; payments: { id: string; date: string; amountUF: number; reference: string }[] }
export interface Project {
  incomeDates?: Record<string, string>;
  edpPlan?: { sourceMilestoneId: string; reference: string; milestoneIds: string[]; contractAmount: number; currency: Currency };
  id: string; revision: number; name: string; customer: string; customerRut: string; location: string; owner: string;
  units: number; contractType: string; currency: Currency; contractAmount: number | null;
  lifecycle?: "Potencial" | "Firmado"; nature?: "fabricacion_montaje" | "llave_en_mano" | null; includedWorks?: ("interior" | "exterior" | "calles" | "otras")[]; areaM2?: number | null;
  progressReports?: ProgressReport[];
  houseTracking?: boolean; houseEvents?: HouseEvent[]; houseProgress?: ProgressReport[];
  simulation?: { asOf: string; ufValue: number; assumptions: string[]; invoices: SimulationInvoice[] };
  signedDate: string | null; startDate: string | null; endDate: string | null;
  ufValue: number | null; approvedFolder: string; paymentTerms: string; notes: string;
  scopes: string[]; sources: { name: string; reference: string }[];
  issues: { id: string; text: string; resolved: boolean }[];
  milestones: Milestone[]; invoiceLinks: { invoiceId: string; milestoneId: string; tags?: string[] }[];
  updatedAt: string; history: { id: string; at: string; reason: string; changes: string[] }[];
}
export type DataState = "loading" | "ready" | "error";
export type MilestoneStatus = "Cumplido a tiempo" | "Cumplido con atraso" | "Cumplido" | "Sin evidencia" | "Observado" | "En curso" | "Programado" | "Propuesto" | "Sin fecha";
