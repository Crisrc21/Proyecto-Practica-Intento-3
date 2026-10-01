# CxC PHO

Aplicacion interna para gestionar cuentas por cobrar: cartera, facturas, clientes, ingreso documental y trazabilidad de pagos, abonos, notas de credito y notas de debito.

## Estructura

- `frontend/`: React + Vite + TypeScript. Consume la API local.
- `backend/`: API interna Node.js organizada por dominios.
- `data/`: datos locales de entrada. `data/private/` queda fuera de Git.
- `docs/`: documentacion humana de arquitectura, flujos y reglas.
- `scripts/`: utilitarios de desarrollo, diagnostico y automatizacion.

## Comandos

Instalar dependencias por aplicacion:

```bash
cd frontend
npm install

cd ../backend
npm install
```

Ejecutar en desarrollo:

```bash
cd backend
npm run dev

cd ../frontend
npm run dev
```

URLs locales:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:4000`

Para exponer la app desde un entorno con reenvío de puertos, publica el puerto
`3000`. El frontend usa `/api` y Vite reenvía internamente al backend local.

## Modulos principales

Backend:

- `backend/src/modules/accounts-receivable/`: facturas, KPIs, saldos y timelines.
- `backend/src/modules/customers/`: clientes B2B/B2C.
- `backend/src/modules/document-intake/`: preparacion de ingreso documental.
- `backend/src/modules/projects/`: contratos potenciales y firmados, naturalezas, avances acumulados, condiciones de EDP, versiones del plan y asociaciones de facturas.

Frontend:

- `frontend/src/modules/accounts-receivable/`: dashboard y consulta de facturas.
- `frontend/src/modules/customers/`: pantalla de clientes.
- `frontend/src/modules/document-intake/`: formulario de ingreso documental.
- `frontend/src/modules/traceability/`: trazabilidad documental.
- `frontend/src/modules/projects/`: potenciales, ficha contractual, seguimiento físico por etapas, estados de pago, líneas de tiempo, cobros e historial.

## Rutas API

- `GET /api/health`
- `GET /api/accounts-receivable/dashboard`
- `GET /api/accounts-receivable/invoices`
- `GET /api/accounts-receivable/timelines`
- `GET /api/customers`
- `POST /api/document-intake/documents`
- `GET /api/projects`
- `POST /api/projects/save`

La gestión contractual se abre en `/proyectos`. Consulta [la guía de proyectos](docs/proyectos-y-contratos.md) y el [manual operativo completo](docs/manual-gestion-proyectos.md) para el flujo de potenciales, avances, EDP, cobros, historial y la conexión pendiente con Microsoft 365.

## Reglas operativas

- El backend protege secretos y centraliza integraciones.
- El frontend no lee archivos privados ni credenciales.
- Datos sensibles y documentos reales viven en `data/private/`.
- Cada dominio tiene su espacio propio; lo compartido vive en `shared`.
- Cambios de reglas van primero a `backend/src/modules/<dominio>/application`.
