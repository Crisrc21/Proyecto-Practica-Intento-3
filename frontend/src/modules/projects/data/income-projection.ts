import type { Project, DataState } from "../types";
import type { FacturaCalculada } from "../../accounts-receivable/types";
export function plusTwoMonths(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const end = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 1, Math.min(d, end))).toISOString().slice(0, 10);
}
export interface IncomeRow {
  key: string; project: Project; milestoneId: string; name: string; invoiceId?: string;
  original: string | null; date: string | null; total: number | null; pending: number | null;
  payments: { date: string; amount: number }[]; status: string; note: string; variance?: number | null; varianceNote?: string;
  invoiceCoverage?: { expected: number; verified: number; missing: string[] };
  unavailableInvoice?: boolean;
}
export function milestoneCollectionDates(rows: IncomeRow[], milestoneId: string) {
  const items = rows.filter(row => row.milestoneId === milestoneId);
  const pending = items.filter(row => row.pending !== 0);
  const dates = [...new Set(pending.map(row => row.date).filter((date): date is string => Boolean(date)))].sort();
  return { items, dates, missingDate: pending.some(row => !row.date), settled: items.length > 0 && pending.length === 0 };
}
export function incomeProjection(projects: Project[], invoices: FacturaCalculada[], state: DataState, cutoff: string): IncomeRow[] {
  return projects.filter(p => p.lifecycle !== "Potencial").flatMap(project => {
    const source = project.simulation ? project.simulation.invoices.map(i => ({ id:i.id, number:i.number, issued:i.issued, due:i.due, total:i.amountUF * project.simulation!.ufValue, payments:i.payments.map(p => ({date:p.date,amount:p.amountUF * project.simulation!.ufValue})), partial:false, cancelled:false })) : invoices.map(i => ({id:i.id,number:i.numero,issued:i.fechaEmision,due:i.fechaVencimiento,total:Math.max(0,i.monto - i.notasCredito.filter(n=>n.fecha<=cutoff).reduce((s,n)=>s+n.monto,0) + i.notasDebito.filter(n=>n.fecha<=cutoff).reduce((s,n)=>s+n.monto,0)),payments:i.pagos.map(p=>({date:p.fechaPago,amount:p.monto})),partial:Boolean("informacionParcial" in i && i.informacionParcial),cancelled:Boolean(i.anulada)}));
    const result: IncomeRow[] = [];
    for (const m of project.milestones.filter(m => ["EDP","Anticipo","Retenciones"].includes(m.type))) {
      const ids = [...new Set(project.invoiceLinks.filter(l=>l.milestoneId===m.id).map(l=>l.invoiceId))];
      const available = Boolean(project.simulation) || state === "ready";
      const linked = available ? source.filter(i=>ids.includes(i.id) && i.issued<=cutoff && !i.cancelled) : [];
      let complete = available && ids.every(id=>source.some(i=>i.id===id && !i.partial));
      const missing = ids.filter(id => !available || !source.some(i => i.id === id && !i.partial));
      const invoiceCoverage = { expected: ids.length, verified: ids.length - missing.length,
        missing: missing.map(id => available ? source.find(i => i.id === id)?.number || id : id) };
      for (const i of linked) {
        const key = `invoice:${i.id}`, payments = i.payments.filter(p=>p.date<=cutoff);
        const pending = i.partial ? null : Math.max(0,i.total - payments.reduce((s,p)=>s+p.amount,0));
        result.push({key,project,milestoneId:m.id,name:`${m.name} · Factura ${i.number}`,invoiceId:i.id,original:i.due || null,date:project.incomeDates?.[key] || i.due || null,total:i.partial?null:i.total,pending,payments:i.partial?[]:payments,status:i.partial?"Por verificar":pending===0?"Cobrado":"Facturado",note:"Fecha original: vencimiento de factura.",invoiceCoverage});
      }
      for (const id of missing.filter(id => !linked.some(i => i.id === id))) {
        result.push({ key: `invoice:${id}`, project, milestoneId: m.id, name: `${m.name} · Factura (identificador ${id})`, invoiceId: id,
          original: null, date: project.incomeDates?.[`invoice:${id}`] || null, total: null, pending: null, payments: [],
          status: "Factura por verificar", note: "Datos no disponibles en CxC. No se infiere el monto ni el vencimiento.", invoiceCoverage, unavailableInvoice: true });
      }
      const factor = project.currency === "UF" ? project.simulation?.ufValue || project.ufValue : 1;
      const planned = m.cashAmount != null && factor ? m.cashAmount * factor : null;
      const presented = Boolean(m.edp?.presentedDate && m.edp.presentedDate<=cutoff || /^https?:\/\//i.test(m.source));
      const key = `edp:${m.id}`;
      const scheduledIncome = m.type === "Anticipo" || m.type === "Retenciones";
      const original = scheduledIncome ? m.cashDate || null : m.edp?.presentedDate && m.edp.presentedDate<=cutoff ? plusTwoMonths(m.edp.presentedDate) : null;
      if (linked.length || missing.length) {
        const invoiceRow = result.find(r => r.milestoneId === m.id && r.invoiceId);
        if (invoiceRow) {
          invoiceRow.variance = complete && planned != null && ids.every(id => source.some(i => i.id === id && i.issued <= cutoff)) ? linked.reduce((sum, i) => sum + i.total, 0) - planned : null;
          invoiceRow.varianceNote = project.currency === "UF" ? "Comparación informativa: facturas − EDP convertido con la UF de proyección del proyecto." : "Comparación informativa: total facturado − monto del EDP.";
        }
        // Linked invoices replace the EDP estimate, regardless of the difference or completion checkbox.
        continue;
      }
      const total = ids.length ? null : planned;
      // Advances and retention releases use their own amount and expected collection date.
      // Linked invoices still replace estimates and never create an additional income.
      const eligible = scheduledIncome ? m.cashAmount != null && Boolean(m.cashDate) : presented;
      if (!eligible && !ids.length) continue;
      result.push({key,project,milestoneId:m.id,name:m.name,original,date:project.incomeDates?.[key] || original,total,pending:total,payments:[],status:ids.length?"Factura por verificar":scheduledIncome?"Previsto sin factura":"Presentado",note:scheduledIncome ? "Fecha esperada de cobro registrada." : !original?"Falta fecha de presentación; puedes definir la proyección.":"Presentación + 2 meses calendario."});
    }
    return result;
  });
}
export function projectionPeriods(rows: IncomeRow[], mode: "weekly" | "monthly", start: string, year: number, cutoff: string, end?: string) {
  const day = (s:string,n:number)=>new Date(Date.parse(`${s}T00:00:00Z`)+n*86400000).toISOString().slice(0,10);
  const monday = day(start,-((new Date(`${start}T00:00:00Z`).getUTCDay()+6)%7));
  const length = end ? mode === "weekly" ? Math.floor((Date.parse(end) - Date.parse(monday)) / 604800000) + 1 : (Number(end.slice(0,4)) - year) * 12 + Number(end.slice(5,7)) : 12;
  return Array.from({length:Math.max(0,length)},(_,i)=>{
    const rawFrom=mode==="weekly"?day(monday,i*7):new Date(Date.UTC(year,i,1)).toISOString().slice(0,10);
    const rawTo=mode==="weekly"?day(rawFrom,6):new Date(Date.UTC(year,i+1,0)).toISOString().slice(0,10);
    const from=end && rawFrom<start?start:rawFrom;
    const to=end && rawTo>end?end:rawTo;
    const inside=(d:string|null)=>Boolean(d && d>=from && d<=to);
    const expected=rows.filter(r=>inside(r.original)), current=rows.filter(r=>inside(r.date));
    return {from,to,expected:expected.reduce((s,r)=>s+(r.total||0),0),pending:current.reduce((s,r)=>s+(r.pending||0),0),paid:rows.flatMap(r=>r.payments).filter(p=>inside(p.date)&&p.date<=cutoff).reduce((s,p)=>s+p.amount,0),unknown:rows.some(r=>r.invoiceCoverage?.missing.length)||expected.some(r=>r.total===null)||current.some(r=>r.pending===null),rows:rows.filter(r=>inside(r.original)||inside(r.date)||r.payments.some(p=>inside(p.date)))};
  });
}

export function matrixProjected(rows: IncomeRow[], from: string, to: string, version: "original" | "current") {
  const inside = (date: string | null) => Boolean(date && date >= from && date <= to);
  return rows.reduce((sum, row) => {
    if (version === "original" || row.date === row.original) return sum + (inside(row.original) ? row.total || 0 : 0);
    return sum + (inside(row.original) ? Math.max(0, (row.total || 0) - (row.pending || 0)) : 0) + (inside(row.date) ? row.pending || 0 : 0);
  }, 0);
}
