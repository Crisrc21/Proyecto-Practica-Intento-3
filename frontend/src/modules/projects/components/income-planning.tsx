import { IncomeMatrix } from "./income-matrix";
import "../financial-planning.css";
import { useState } from "react";
import type { Project, DataState } from "../types";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import { incomeProjection, projectionPeriods, type IncomeRow } from "../data/income-projection";
import { amount, shortDate, todayISO } from "../data/project-calculations";
import { AppLink } from "../../../shared/components/app-link";
import { Editor, SaveFooter } from "./project-forms";
export function IncomePlanning({projects,invoices,dataState,cutoff,year,onSave}:{projects:Project[];invoices:FacturaCalculada[];dataState:DataState;cutoff:string;year:number;onSave:(p:Project,reason:string)=>Promise<void>}) {
 const [mode,setMode]=useState<"weekly"|"monthly">("weekly");
 const start=`${todayISO().slice(0,4)}-01-01`, end="2027-12-31";
 const [period,setPeriod]=useState<string|null>(null);
 const [editing,setEditing]=useState<IncomeRow|null>(null),[date,setDate]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const rows=incomeProjection(projects,invoices,dataState,cutoff);
 const periods=projectionPeriods(rows,mode,start,Number(start.slice(0,4)),cutoff,end);
 const selected=periods.find(p=>p.from===period);
 const [detailProject,setDetailProject]=useState<string|null>(null);
 const popupRows=(selected?selected.rows:[]).filter(r=>!detailProject||r.project.id===detailProject);
 const visible=rows;
 const [savedMessage,setSavedMessage]=useState("");
 async function save(reset=false) {
  if(!editing)return;
  setBusy(true);setError("");
  try {
   const project=projects.find(p=>p.id===editing.project.id)!;
   const incomeDates={...project.incomeDates};
   if(reset)delete incomeDates[editing.key];else incomeDates[editing.key]=date;
   await onSave({...project,incomeDates},`Proyección de ingreso · ${editing.name}`);
   setEditing(null);setSavedMessage("Fecha guardada. La matriz y el registro se actualizaron.");
  } catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");} finally{setBusy(false);}
 }
 return <section className="project-panel">
  <div className="project-panel-heading"><div><h2>Proyección de ingresos</h2><p>Compara los ingresos proyectados y reales por proyecto, semana o mes.</p></div><div className="project-actions"><button className={`project-button ${mode==="weekly"?"primary":""}`} aria-pressed={mode==="weekly"} onClick={()=>{setMode("weekly");setPeriod(null);}}>Semanal</button><button className={`project-button ${mode==="monthly"?"primary":""}`} aria-pressed={mode==="monthly"} onClick={()=>{setMode("monthly");setPeriod(null);}}>Mensual</button></div></div>
  {dataState!=="ready"&&projects.some(p=>!p.simulation)&&<p className="project-note">CxC no está disponible. Los montos y cobros pueden estar incompletos.</p>}
  <IncomeMatrix rows={rows} projects={projects} mode={mode} start={start} end={end} year={Number(start.slice(0,4))} cutoff={cutoff} onSelect={(date,id)=>{setPeriod(date);setDetailProject(id);setSavedMessage("");}} />
  <div className="project-panel-heading"><div><h3>Registro de todos los ingresos</h3><p>Revisa el origen y cambia la fecha esperada de cobro.</p></div></div>
  <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>Origen</th><th>Estado</th><th>Fecha original</th><th>Fecha vigente</th><th>Monto original / saldo CLP</th><th>Acción</th></tr></thead><tbody>{visible.map(r=><tr key={`${r.project.id}/${r.key}`}><td><strong>{r.project.name}</strong><AppLink href={`/proyectos?proyecto=${encodeURIComponent(r.project.id)}&vista=edps&edp=${encodeURIComponent(r.milestoneId)}`}>{r.name}</AppLink>{r.invoiceId&&!r.project.simulation&&<AppLink href={`/trazabilidad?factura=${encodeURIComponent(r.invoiceId)}`}>Ver factura</AppLink>}</td><td><span className="project-badge neutral">{r.status}</span></td><td>{shortDate(r.original)}<small>{r.note}</small></td><td>{shortDate(r.date)}{r.date&&r.date<cutoff&&(r.pending===null||r.pending>0)&&<small className="project-negative">Vencido · por revisar</small>}</td><td>{amount(r.total)}<small>Saldo: {amount(r.pending)}</small><ProjectionDifference row={r} />{r.total===null&&<small>Revisar monto, CxC o UF de proyección.</small>}</td><td><button className="project-button" disabled={r.pending===0} onClick={()=>{setEditing(r);setDate(r.date||cutoff);setError("");}}>Cambiar fecha</button></td></tr>)}</tbody></table></div>
  {!visible.length&&<p className="project-footnote">No hay ingresos registrados para esta selección.</p>}
  <p className="project-footnote">EDP sin factura: presentación + 2 meses calendario. Anticipos y devolución de retenciones sin factura: monto y fecha esperada de cobro registrados, con estado Previsto sin factura. Sus montos en UF usan el supuesto de conversión del proyecto; las facturas mantienen sus montos CLP. Los EDP en proceso sin información financiera no se suman. El registro inferior incluye los ingresos sin fecha.</p>
  {selected&&!editing&&<Editor title={`Ingresos · ${shortDate(selected.from)} – ${shortDate(selected.to)}`} onClose={()=>{setPeriod(null);setDetailProject(null);}}>
    <div className="project-form">
      <p className="project-note project-full">{detailProject?projects.find(p=>p.id===detailProject)?.name:"Todos los proyectos"} · EDP y facturas asociados al período. Puedes ajustar la fecha de cada saldo pendiente.</p>
      {savedMessage&&<p className="project-feedback project-full" role="status">{savedMessage}</p>}
      {popupRows.map(r=><article className="project-panel project-full" key={`${r.project.id}/${r.key}`} style={{padding:16}}>
        <div className="project-actions" style={{justifyContent:"space-between",marginBottom:12}}><strong>{r.name}</strong><span className="project-badge neutral">{r.status}</span></div>
        <p className="project-footnote" style={{padding:0,marginBottom:12}}>{r.project.name}</p>
        <div className="project-definition-grid"><div><span>Fecha original</span><p>{shortDate(r.original)}</p></div><div><span>Fecha proyectada</span><p>{shortDate(r.date)}</p></div><div><span>Monto original</span><p>{amount(r.total)}</p></div><div><span>Saldo pendiente</span><p>{amount(r.pending)}</p></div></div>
        <ProjectionDifference row={r} />
        <div className="project-actions" style={{marginTop:16}}><AppLink className="project-button" href={`/proyectos?proyecto=${encodeURIComponent(r.project.id)}&vista=edps&edp=${encodeURIComponent(r.milestoneId)}`}>Ver EDP</AppLink><button className="project-button primary" disabled={r.pending===0} onClick={()=>{setEditing(r);setDate(r.date||cutoff);setError("");}}>Cambiar fecha de proyección</button></div>
      </article>)}
      {!popupRows.length&&<p className="project-full">No hay ingresos en este período para el proyecto seleccionado.</p>}
      <div className="project-form-actions project-full"><button className="project-button" onClick={()=>{setPeriod(null);setDetailProject(null);}}>Cerrar</button></div>
    </div>
  </Editor>}
  {editing&&<Editor title="Cambiar fecha de proyección" onClose={()=>{if(!busy)setEditing(null);}}><form className="project-form" onSubmit={e=>{e.preventDefault();void save();}}><p className="project-full">{editing.project.name} · {editing.name}</p><p className="project-note project-full">Fecha original: {shortDate(editing.original)}. El cambio no modifica el vencimiento de la factura ni sus pagos.</p><label className="project-field project-full">Nueva fecha de proyección<input type="date" required value={date} onChange={e=>setDate(e.target.value)} /></label><button type="button" className="project-text-link" disabled={busy} onClick={()=>void save(true)}>Restablecer fecha original</button><SaveFooter busy={busy} error={error} onClose={()=>setEditing(null)} /></form></Editor>}
 </section>;
}

function ProjectionDifference({row}:{row:IncomeRow}) {
 if(row.variance===undefined)return null;
 return <small title={row.varianceNote} style={{display:"block",marginTop:8}}>Diferencia facturas − EDP: {row.variance===null?"por verificar":`${row.variance>0?"+":""}${amount(row.variance)}`}<br />{row.varianceNote} No modifica la proyección.</small>;
}
