import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, FileText, Link2, Users, WalletCards } from "lucide-react";

const steps = [
  { title: "Contrato", text: "Registra el proyecto, su mandante y las condiciones contratadas." },
  { title: "EDP", text: "Completa las partidas, el desglose financiero y el enlace del documento." },
  { title: "Factura", text: "Vincula la factura que respalda el monto y el vencimiento del ingreso." },
  { title: "Cobro", text: "Consulta los pagos registrados en CxC y el saldo pendiente." },
  { title: "Proyección", text: "Compara fechas originales y vigentes con los ingresos reales." }
];
const views = [
  ["Proyectos", "Tarjetas con proyecto, mandante y estado Firmado o Sin firmar. Usa Ver datos del proyecto o Abrir seguimiento. Eliminar proyecto retira su gestión local; no elimina las facturas ni los pagos originales de CxC."],
  ["Vista general", "Total del contrato, viviendas, último EDP registrado por número y superficie contratada. Incluye firma, anticipo, retenciones, recaudación y próximos compromisos."],
  ["Estados de pago", "Datos del contrato, cantidad total de EDP, distribución desplegable, listado de EDP y gestión de sus facturas. Los filtros son Todos los EDP, En proceso y Presentados."],
  ["Planificación financiera", "Matriz con proyectos en filas y semanas o meses en columnas, cada uno con Proyectado y Real. En la vista de un proyecto no se repite la fila Ingresos totales."],
  ["Historial", "Consulta los cambios guardados, incluidas las modificaciones de las fechas de proyección."]
];
const instructions = [
  ["Crear y firmar el proyecto", "Un proyecto potencial requiere nombre y mandante. Al marcar el contrato como firmado se habilitan viviendas, monto UF, m² por casa y totales, ubicación, tipo y fecha de firma. Los tipos son Fabricación y Montaje o Completa."],
  ["Registrar el primer EDP", "En Gestionar estado de pago indica obligatoriamente la cantidad total de EDP, incluyendo el primero y el de retenciones; el anticipo no se cuenta como EDP. Los pendientes aparecen numerados en la lista y pueden completarse individualmente."],
  ["Seleccionar partidas", "Elige Urbanización o Vivienda. En Vivienda puedes marcar una o varias opciones: Vivienda, Vivienda - Urbanización Interior y Vivienda - TGM. Las partidas seleccionadas aparecen automáticamente bajo las facturas vinculadas. Puedes corregir estos detalles en un EDP presentado conservando su condición original."],
  ["Completar montos", "Ingresa el Total neto del avance. Activa o desactiva por separado Devolución anticipo (20%) y Devolución retenciones (5%). El total neto a facturar descuenta solo las devoluciones activas; se suma IVA 19% y se resta CEEC 3,09%. Los cálculos se redondean sin decimales. Los registros antiguos conservan su cálculo hasta aplicar el nuevo esquema."],
  ["Agregar el documento", "Guarda el enlace del EDP. Sin enlace aparece En proceso; con enlace válido aparece Presentado. El enlace respalda la referencia documental, no acredita un cobro."],
  ["Vincular facturas", "En Facturas y estados de pago pulsa Vincular factura, selecciona factura y EDP y guarda. Un EDP admite varias facturas; cada factura se asigna a un único EDP. Las etiquetas manuales son opcionales y complementan las partidas. Puedes editar o desvincular la relación."],
  ["Revisar el cobro", "La lista muestra Presentado, Facturado y Cobrado o No cobrado según corresponda. Cobrado requiere que todas las facturas vinculadas estén completamente pagadas; un abono parcial no completa el cobro. El vencimiento y el estado de pagos se consultan desde la factura."],
  ["Gestionar hitos financieros", "Controla la firma, el anticipo y la liberación y cobro de retenciones. Descontar retenciones en un EDP es distinto de registrar el ingreso por su devolución final."]
];
const planning = [
  ["Elegir perspectiva", "Selecciona Semanal o Mensual. La matriz cubre desde el 1 de enero del año actual hasta el 31 de diciembre de 2027. Siguiente monto proyectado salta a los períodos con ingresos y, después del último, vuelve al primero."],
  ["Leer la matriz", "Proyectado muestra el ingreso según Fechas originales o Fechas vigentes. Real muestra pagos recibidos hasta la fecha de revisión. Los montos están en CLP. Un asterisco indica datos incompletos; los ingresos sin fecha se revisan en el registro inferior."],
  ["Consultar el detalle", "Pulsa una celda para abrir el pop-up del período y proyecto. Verás sus EDP y facturas, estado, monto, saldo y fechas. El registro de todos los ingresos permanece debajo de la matriz."],
  ["Cambiar una fecha", "Usa Cambiar fecha de proyección en el pop-up o Cambiar fecha en el registro. Guarda la nueva fecha o restablece la original. Se mueve solo el saldo pendiente, se conserva la comparación original y queda constancia en el historial. La factura y sus pagos no se modifican."],
  ["Revisar semanalmente", "Comprueba atrasos, documentos pendientes, montos sin definir y nuevas fechas de cobro. En la vista mensual compara lo proyectado con lo cobrado; la fecha de revisión determina los pagos incluidos."]
];
const rules = [
  "Sin factura: el EDP presentado se proyecta por su monto y con fecha de presentación + 2 meses calendario. Si falta la fecha, se señala para revisión y puedes asignar una fecha de proyección.",
  "Con factura: su monto sustituye la estimación del EDP y su vencimiento define la fecha original. Si hay varias facturas, cada una se proyecta por separado. No se agrega un remanente automático del EDP.",
  "La diferencia total facturado − EDP es informativa, puede ser positiva o negativa y no genera otro ingreso. Si falta la conversión, aparece por verificar. Para esta comparación, un EDP en UF utiliza la UF de proyección del proyecto.",
  "El saldo por cobrar es el monto facturado menos los pagos recibidos. Una reprogramación no acredita pago ni modifica el vencimiento original. Los importes de facturas consideran sus notas de crédito y débito al corte.",
  "Los EDP en proceso sin información financiera no generan ingresos supuestos. Los EDP sin factura expresados en UF necesitan el supuesto UF del proyecto para planificarse en CLP.",
  "El módulo controla ingresos por contrato y su efecto esperado en caja. La producción, los despachos y la ejecución operativa se gestionan fuera de estas vistas. La planificación no representa un saldo bancario ni incluye egresos."
];

export function ProjectManual() {
  return <div className="project-manual">
    <section className="project-panel project-manual-hero"><div className="project-manual-title"><span className="project-eyebrow">GUÍA DEL SISTEMA</span><h2>Gestión de proyectos y planificación financiera</h2><p>Controla el ingreso desde el contrato hasta el cobro, con respaldo en EDP y facturas y una proyección que puedes actualizar.</p></div><div className="project-manual-hero-icon"><BookOpen size={30} /></div></section>
    <section className="project-panel project-manual-flow"><div className="project-panel-heading"><div><h2>Contrato → EDP → Factura → Cobro</h2><p>La planificación reúne los ingresos esperados y los pagos efectivamente recibidos.</p></div><Link2 size={20} /></div><ol className="project-manual-steps">{steps.map((step,index)=><li key={step.title} className="project-manual-step"><span>{index+1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div>{index<steps.length-1&&<ArrowRight className="project-manual-arrow" size={17} aria-hidden="true" />}</li>)}</ol></section>
    <div className="project-manual-grid">
      <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Cómo gestionar un proyecto y sus EDP</h2><p>Registro y seguimiento financiero.</p></div><ClipboardCheck size={20} /></div><ol className="project-manual-list">{instructions.map(([title,text])=><li key={title}><strong>{title}:</strong> {text}</li>)}</ol></section>
      <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Qué muestra cada vista</h2><p>Accesos y contenido disponible.</p></div><FileText size={20} /></div><div className="project-manual-view-list">{views.map(([title,text])=><div key={title}><strong>{title}</strong><p>{text}</p></div>)}</div></section>
    </div>
    <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Planificación semanal y mensual</h2><p>Comparación visual, detalle por documento y fechas editables.</p></div><WalletCards size={20} /></div><ol className="project-manual-list">{planning.map(([title,text])=><li key={title}><strong>{title}:</strong> {text}</li>)}</ol></section>
    <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Recaudación en UF y CLP</h2><p>EDP presentado, facturado y cobrado.</p></div><WalletCards size={20} /></div><div className="project-contract-terms"><p>Facturado y Cobrado se convierten individualmente con la UF histórica de emisión de cada factura y luego se suman. Para convertir el monto de cada EDP presentado se usa la fecha de emisión de su primera factura vinculada. Si falta factura o UF, la conversión queda pendiente; no se inventa un valor ni se muestra una suma incompleta.</p><p>Esta conversión histórica es distinta del supuesto UF usado para planificar EDP aún no facturados. Las simulaciones mantienen su UF ficticia y deben revisarse por separado de los proyectos reales.</p></div></section>
    <div className="project-manual-grid">
      <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Reglas de proyección</h2><p>Cómo se evita duplicar los ingresos.</p></div><CheckCircle2 size={20} /></div><ul className="project-manual-bullets">{rules.map(rule=><li key={rule}><CheckCircle2 size={15} /><span>{rule}</span></li>)}</ul></section>
      <section className="project-panel project-manual-section"><div className="project-panel-heading"><div><h2>Quién interviene</h2><p>Responsabilidades en el proceso.</p></div><Users size={20} /></div><div className="project-manual-role"><strong>Comercial y Marketing</strong><span>Gestionan el contrato y aportan sus condiciones y antecedentes.</span></div><div className="project-manual-role"><strong>Fábrica y Operaciones</strong><span>Aportan antecedentes técnicos y respaldo del avance reconocido en los documentos, desde sus propios procesos.</span></div><div className="project-manual-role"><strong>Contabilidad</strong><span>Emite las facturas según los EDP y mantiene la información contable de documentos y pagos.</span></div><div className="project-manual-role"><strong>Control de Gestión</strong><span>Valida información, vincula documentos, revisa CxC, compara lo esperado con lo cobrado y actualiza las fechas de proyección.</span></div><div className="project-manual-note">El módulo consulta los pagos de CxC. Agregar un enlace, vincular una factura o cambiar una fecha no registra dinero recibido.</div></section>
    </div>
  </div>;
}
