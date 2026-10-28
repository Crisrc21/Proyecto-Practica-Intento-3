import { Fragment, useState, useRef, useEffect } from "react";
import type { Project } from "../types";
import type { IncomeRow } from "../data/income-projection";
import { projectionPeriods, matrixProjected } from "../data/income-projection";
import { shortDate } from "../data/project-calculations";
import "../income-matrix.css";
export function IncomeMatrix({rows,projects,mode,start,end,year,cutoff,onSelect}:{rows:IncomeRow[];projects:Project[];mode:"weekly"|"monthly";start:string;end:string;year:number;cutoff:string;onSelect:(period:string,projectId:string|null)=>void}) {
 const [version,setVersion]=useState<"current"|"original">("current");
 const periods=projectionPeriods(rows,mode,start,year,cutoff,end);
 const scroll=useRef<HTMLDivElement>(null);
 const headers=useRef(new Map<string,HTMLTableCellElement>());
 const [jumped,setJumped]=useState<string|null>(null);
 const [announcement,setAnnouncement]=useState("");
 useEffect(()=>{setJumped(null);setAnnouncement("");scroll.current?.scrollTo({left:0});},[mode,version,start,end]);
 const targets=periods.filter(p=>matrixProjected(rows,p.from,p.to,version)>0);
 function jump() {
   const container=scroll.current;
   if(!container||!targets.length)return;
   const fixed=container.querySelector<HTMLElement>(".income-matrix-project")?.offsetWidth||240;
   const candidate=targets.find(p=>{
     const node=headers.current.get(p.from);
     return node && node.getBoundingClientRect().left-container.getBoundingClientRect().left>fixed+8 && p.from!==jumped;
   })||targets.find(p=>p.from>(jumped||""))||targets[0];
   const node=headers.current.get(candidate.from);
   if(node){container.scrollTo({left:container.scrollLeft+node.getBoundingClientRect().left-container.getBoundingClientRect().left-fixed,behavior:"smooth"});setJumped(candidate.from);setAnnouncement(`Proyección del ${shortDate(candidate.from)} al ${shortDate(candidate.to)}`);}
 }
 const fmt=(value:number)=>value===0?"—":new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(value);
 const matrixRows=[...(projects.length > 1 ? [{id:null as string|null,name:"INGRESOS TOTALES",items:rows}] : []),...projects.map(p=>({id:p.id,name:p.name,items:rows.filter(r=>r.project.id===p.id)}))];
 return <>
  <div className="income-matrix-toolbar"><label className="project-field compact">Proyectado<select value={version} onChange={e=>setVersion(e.target.value as typeof version)}><option value="current">Fechas vigentes</option><option value="original">Fechas originales</option></select></label><span>{shortDate(start)} – {shortDate(end)} · CLP</span><button type="button" className="project-button primary" disabled={!targets.length} onClick={jump}>Siguiente monto proyectado →</button><span role="status">{announcement||(!targets.length?"Sin montos proyectados en este rango":"Selecciona una celda para ver su detalle")}</span></div>
  <div ref={scroll} className="income-matrix-scroll" tabIndex={0} role="region" aria-label="Matriz de ingresos proyectados y reales"><table className="income-matrix"><thead><tr><th rowSpan={3} className="income-matrix-project">Proyecto</th>{periods.map((p,index)=><th key={p.from} ref={node=>{if(node)headers.current.set(p.from,node);else headers.current.delete(p.from);}} className={jumped===p.from?"income-matrix-target":""} colSpan={2} scope="colgroup">{mode==="weekly"?`Semana ${index+1}`:new Intl.DateTimeFormat("es-CL",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${p.from}T00:00:00Z`))}</th>)}</tr><tr>{periods.map(p=><th key={p.from} colSpan={2} className="income-matrix-date">{shortDate(p.from)} – {shortDate(p.to)}</th>)}</tr><tr>{periods.map(p=><Fragment key={p.from}><th scope="col">Proyectado</th><th scope="col" className="income-matrix-real">Real</th></Fragment>)}</tr></thead><tbody>{matrixRows.map(row=><tr key={row.id||"total"} className={row.id===null?"income-matrix-total":""}><th scope="row" className="income-matrix-project">{row.name}{row.items.some(r=>r.invoiceCoverage?.missing.length) && <small className="project-negative">Información incompleta · montos parciales</small>}</th>{periods.map(p=>{
   const inside=(d:string|null)=>Boolean(d&&d>=p.from&&d<=p.to);
   const relevant=row.items.filter(r=>inside(r.original)||version==="current"&&inside(r.date));
   const unknown=row.items.some(r=>r.invoiceCoverage?.missing.length) || relevant.some(r=>r.total===null||version==="current"&&r.date!==r.original&&r.pending===null);
   const projected=matrixProjected(row.items,p.from,p.to,version);
   const real=row.items.flatMap(r=>r.payments).filter(pay=>inside(pay.date)&&pay.date<=cutoff).reduce((sum,pay)=>sum+pay.amount,0);
   return <Fragment key={p.from}><td><button onClick={()=>onSelect(p.from,row.id)} aria-label={`${row.name}, ${shortDate(p.from)}, proyectado`}>{fmt(projected)}{unknown?" *":""}</button></td><td className="income-matrix-real"><button onClick={()=>onSelect(p.from,row.id)} aria-label={`${row.name}, ${shortDate(p.from)}, real`}>{p.from>cutoff?"—":fmt(real)}{p.from<=cutoff && row.items.some(r=>r.invoiceCoverage?.missing.length) ? " *" : ""}</button></td></Fragment>;
  })}</tr>)}</tbody></table></div>
  <p className="project-footnote">Proyectado: ingreso según la versión elegida. Real: pagos recibidos al corte. Al cambiar una fecha se mueve solo el saldo pendiente; la fecha original se conserva. * Importe parcial por datos faltantes.</p>
 </>;
}
