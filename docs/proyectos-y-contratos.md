# Proyectos y contratos

El módulo se abre en `/proyectos` desde el menú principal. Guarda los proyectos en `data/private/projects.json`, fuera de Git. La ruta se resuelve desde la raíz del repositorio, incluso si el backend se inicia desde su propia carpeta. No requiere que Buk Finanzas esté disponible para consultar o actualizar los hitos.

## Uso

En **Estados de pago → Programar siguientes EDP**, la programación financiera solicita cantidad de EDP y monto bruto por EDP, devolución de retenciones y anticipo, primera aprobación prevista, días entre EDP y días de aprobación a cobro. Cada grupo repite el monto indicado y calcula sus fechas y descuentos; la propuesta muestra aprobación, bruto, neto y cobro antes de guardar. No solicita partidas, mediciones ni avances físicos. Los nuevos EDP quedan previstos y no generan avance de obra. Cuando se hereda el cálculo IVA/CEEC del primer EDP, se mantienen las tasas existentes de retenciones (5%) y anticipo (20%).

0. En **Potenciales**, usar **Agregar potencial** para registrar solo el nombre del contrato posible. Sus montos no entran en la cartera firmada, las líneas de tiempo ni las proyecciones de cobros. **Contrato firmado** lo activa con un clic; utiliza la fecha de firma guardada o, si está vacía, la fecha del día en Chile.
1. En **Vista general → Editar ficha**, completar el tipo de contrato, cliente, viviendas, superficie total en m², moneda, monto, fechas y condiciones de pago. Se puede seleccionar el tipo de contrato antes o después de confirmar la firma.
2. En **Hitos y avances**, programar las fechas y registrar cortes acumulados con fecha y evidencia. Los informes pueden provenir de las carpetas que Operaciones ya utiliza. Las correcciones se agregan como nuevos cortes y no borran el anterior.
3. En **Estados de pago → Planificar EDP**, elegir el hito, la medición y el umbral que lo habilita, junto con el monto de ese EDP, la fecha prevista de aprobación y la fecha esperada de cobro. Se pueden planificar varios EDP parciales por etapa. El monto de cada EDP es individual, no acumulado; debe considerar anticipos, retenciones e impuestos según el contrato, evitando contarlos nuevamente.
4. Al guardar un avance que alcanza el umbral, el EDP cambia de **Previsto** a **Preparado**. Este es un registro interno para revisión; no emite un documento tributario ni un archivo de EDP. CDG registra **Presentado** y luego **Aprobado**, con sus fechas y la referencia a la carpeta de aprobados. La aprobación no constituye un cobro.
5. Confirmar el plan base para comparar los compromisos iniciales. Reprogramar fechas e importes previstos conserva esa base. En **Cobros**, vincular las facturas con cada EDP y revisar la matriz mensual real vs. proyectado. Una factura se asigna completa a un único proyecto/hito; varias facturas pueden pertenecer a un EDP.
6. Consultar **Líneas de tiempo** e **Historial** para revisar cumplimiento y reprogramaciones. El usuario no ingresa un motivo: el sistema genera automáticamente la descripción del cambio. Los conflictos entre versiones se rechazan para evitar sobrescribir cambios de otra sesión.

## Tipos de contrato y avance físico

| Tipo de contrato | Alcance |
| --- | --- |
| Fabricación y montaje | Viviendas, transporte/coordinación y montaje. Fundaciones se controla como dependencia con la contraparte. |
| Construcción completa / llave en mano | Viviendas y los alcances adicionales seleccionados: urbanización interior, exterior, calles y otras obras. |

En la ficha marca únicamente los alcances incluidos en el contrato llave en mano. Se crean sus etapas de avance porcentual y se pueden planificar EDP para cada una. Los registros anteriores se traducen a las nuevas modalidades conservando las urbanizaciones que tenían incluidas, sus avances, EDP y compromisos.

Todas conservan esta secuencia: **Contrato firmado → Anticipo → Fabricación → Despachos → Fundaciones → Montaje → alcances adicionales aplicables → Avance total**. TGM significa Traslado, Grúa y Montaje. La secuencia organiza el seguimiento; no impide que dos etapas se ejecuten en paralelo. Un cambio de tipo de contrato no puede eliminar urbanizaciones con avances, EDP o compromisos confirmados.

- Fabricación: m² acumulados respecto de la superficie contratada y cantidad de casas terminadas. Son mediciones separadas; el porcentaje de fabricación utiliza los m².
- Despachos y montaje: cantidad acumulada de casas respecto de las contratadas.
- Fundaciones: casas con fundación terminada y porcentaje de avance informado.
- Urbanización interior, exterior, calles y otras obras: porcentaje acumulado de la etapa correspondiente.
- Avance total: porcentaje validado según el criterio contractual, ingresado con evidencia. No se promedian porcentajes de etapas ni se suponen ponderaciones.
- Anticipo: dinero cobrado de sus facturas vinculadas en CxC. Solo aparece completamente pagado cuando CDG confirma que las facturas cubren todos los EDP de anticipo y sus pagos cubren el monto facturado. Una fuente no disponible o una asociación faltante se muestra como dato desconocido.

Los umbrales pueden expresarse en m², casas terminadas, despachadas, montadas, fundaciones o porcentajes, según la etapa. Para la firma y el anticipo, la firma habilita la preparación del EDP. Los montos y plazos se definen desde el contrato; no se asigna una tarifa automática a los avances.

El corte histórico utiliza la última medición con fecha igual o anterior al corte. Repetir un 100% en un corte posterior conserva la primera fecha de cumplimiento sostenido. Si se corrige el avance por debajo del umbral, un EDP aún no presentado vuelve a Previsto; un EDP presentado o aprobado conserva su estado documental y la vista advierte la diferencia frente al avance. Los estados documentales muestran la última versión guardada, con trazabilidad en el historial.

## Compatibilidad con proyectos existentes

Los registros anteriores se conservan como contratos firmados. Al seleccionar su tipo de contrato se incorporan las etapas sin duplicar el hito de firma ni convertir los hitos físicos en importes de cobro. Los EDP existentes conservan su plan base y pueden seguir gestionándose como antes. Se pueden asociar sus propuestas pendientes a una condición de avance desde Estados de pago, sin crear otro cobro. El generador anterior de cortes mensuales sigue disponible como planificación sin condición física.

## Criterios de las vistas

- Cumplimiento a tiempo: hitos confirmados con fecha base exigible al corte y evidencia de cumplimiento dentro de esa fecha, dividido por hitos confirmados exigibles. No mide avance físico. Una fecha prevista posterior no borra la desviación frente a la base.
- Sin evidencia: fecha base exigible y sin fecha efectiva acreditada al corte. No implica que la obra no se haya realizado.
- El corte filtra hechos por fecha. La proyección vigente representa el último estado guardado; no reconstruye automáticamente versiones pasadas del plan.
- La vista anual muestra los hitos de ese año y los pendientes sin fecha. Se puede elegir otro año.
- Real: suma de pagos/abonos de las facturas vinculadas por fecha de pago. Un EDP aprobado, una factura, una nota de crédito o una fecha de compromiso no generan efectivo.
- La proyección en pesos usa el supuesto UF guardado por CDG. Los cobros reales conservan sus pesos originales. La UF supuesta debe actualizarse explícitamente y queda en el historial.
- Plan base: fechas e importes originales confirmados. Proyección vigente: últimos supuestos. Para fechas futuras, si la facturación es parcial se conserva el mayor entre el total previsto del hito y el facturado, menos lo cobrado. Así se mantiene el remanente no facturado sin sumar dos veces el EDP y las facturas. CDG confirma «Las facturas vinculadas cubren todo este hito» cuando corresponda; desde entonces se utiliza el saldo conjunto de esas facturas.
- Una factura se asigna completa a un proyecto e hito; no se distribuye entre proyectos en esta versión. Las facturas completas en pesos permiten proyectar su saldo sin una UF supuesta.
- La variación se muestra solo para meses cerrados y planes completos. Los datos faltantes, una fuente de cobros no disponible, vínculos sin resolver y meses futuros se distinguen de un cero confirmado.

## Documentos iniciales

El caso privado inicial de Los Escritores 1 se construyó desde los archivos aportados por el usuario. Solo la firma está acreditada como cumplida. El término se calculó con 730 días desde la firma. Cortes mensuales, recepción y liberación de retenciones se registraron como propuestas. No se supusieron cobros, aprobación del EDP, año del EDP de enero, UF futura ni montos mensuales.

El contrato y la planilla presentan diferencias de monto, anticipo y bases de cálculo. Se registraron como pendientes para CDG; no se corrigieron los originales. Al copiar la aplicación a otro equipo, transferir `data/private/projects.json` por el canal interno correspondiente si se desea conservar esos datos. Una instalación sin ese archivo comienza vacía.

## Microsoft 365

La ficha permite guardar y abrir el enlace HTTPS a la carpeta de EDP aprobados. La detección de cambios de archivos y el aviso por correo están pendientes de integrar; guardar el enlace no activa una conexión. Operaciones y Contabilidad mantienen su flujo actual. La incorporación de Microsoft 365 necesitará identificar las carpetas, otorgar acceso a la aplicación y configurar destinatarios. No se envía ningún correo en esta versión.

## Persistencia y validación

`GET /api/projects` devuelve los registros. `POST /api/projects/save` recibe `{ project, expectedRevision, reason? }`; `reason` es opcional y, si no se envía, el backend genera una descripción automática. Las escrituras de una misma instancia de servidor se serializan y reemplazan el archivo de forma atómica. Las fechas base confirmadas son inmutables; las reprogramaciones guardan sus diferencias en el historial. Para varios servidores concurrentes, migrar esta persistencia a una base de datos transaccional.

La aplicación conserva su esquema de acceso existente; este módulo no incorpora autenticación ni identidad de autor. El historial incluye fecha, descripción automática y cambios, pero no atribuye cambios a usuarios autenticados. No publicar el servicio sin resolver el acceso corporativo de la aplicación.

Pruebas: `npm run test --prefix backend` y `node --test frontend/test/*.test.mjs`. Compilación: `npm run build`. Si el entorno restringido de Windows impide a esbuild leer los directorios superiores al cargar la configuración, ejecutar `npm run typecheck` y, desde `frontend`, `node node_modules/vite/bin/vite.js build --configLoader native`.


## Coordinar facturas y estados de pago

En **Estados de pago**, selecciona un EDP y utiliza **Facturas y estados de pago**. El mismo panel está disponible en **Cobros** dentro del proyecto.

1. Busca una factura por número, cliente o descripción. Se muestran facturas activas sin asignar, filtradas por el RUT del cliente si está informado.
2. Selecciona el estado de pago y, opcionalmente, agrega etiquetas separadas por comas (ej.: lote norte, fabricación).
3. Pulsa **Vincular factura**. Sus pagos registrados en CxC alimentan el cobro del EDP y la comparación mensual.
4. Usa **Editar relación** para corregir el EDP asociado o las etiquetas, o **Desvincular** para quitar la asociación. Esto conserva la factura y sus pagos en CxC.
5. Busca relaciones por factura, nombre del EDP o etiqueta. La búsqueda de EDP también considera las etiquetas de sus relaciones.
6. Abre la factura en **Trazabilidad**. La tarjeta **Proyecto y estado de pago** permite volver directamente al EDP.

Un EDP admite varias facturas. Una factura se asigna completa a un único EDP/proyecto, evitando duplicar cobros. Las etiquetas organizan las relaciones; no las crean automáticamente ni cambian importes. Los cambios de relación quedan en el historial y respetan el control de versiones.
