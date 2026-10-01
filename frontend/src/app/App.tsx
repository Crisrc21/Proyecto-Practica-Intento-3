import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { navigateTo } from "@/app/navigation";
import { PageHeader } from "@/shared/components/page-header";
import {
  calcularKpisDashboard,
  enriquecerFactura,
  generarTimelineFactura
} from "@/modules/accounts-receivable/data/cxc-calculations";
import {
  AccountsReceivableApiData,
  loadAccountsReceivableData
} from "@/modules/accounts-receivable/data/accounts-receivable-api";
import { DashboardView } from "@/modules/accounts-receivable/components/dashboard-view";
import { DocumentMixSummary } from "@/modules/accounts-receivable/components/document-mix-summary";
import { FacturasTable } from "@/modules/accounts-receivable/components/invoices-table";
import { ClientsView } from "@/modules/customers/components/clients-view";
import { InvoiceForm } from "@/modules/document-intake/components/invoice-form";
import { TraceabilityView } from "@/modules/traceability/components/traceability-view";
import { ProjectsView } from "@/modules/projects/components/projects-view";
import "@/modules/projects/projects.css";
import "@/modules/accounts-receivable/accounts-receivable.css";
import "@/modules/customers/customers.css";
import "@/modules/document-intake/document-intake.css";
import "@/modules/traceability/traceability.css";
import "./App.css";

function useBrowserLocation() {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search
  }));

  useEffect(() => {
    function handleLocationChange() {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search
      });
    }

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return location;
}

export function App() {
  const location = useBrowserLocation();
  const [apiData, setApiData] = useState<AccountsReceivableApiData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const clientes = useMemo(() => apiData?.clientes ?? [], [apiData]);
  const facturas = useMemo(
    () => apiData?.facturas.map((factura) => enriquecerFactura(factura, clientes)) ?? [],
    [apiData, clientes]
  );
  const kpis = useMemo(
    () => calcularKpisDashboard(apiData?.facturas ?? [], clientes),
    [apiData, clientes]
  );
  const timelines = useMemo(
    () => Object.fromEntries(facturas.map((factura) => [factura.id, generarTimelineFactura(factura)])),
    [facturas]
  );
  const traceabilityReturnHref = useMemo(() => {
    const returnTo = params.get("returnTo");
    return returnTo?.startsWith("/facturas") ? returnTo : null;
  }, [params]);

  useEffect(() => {
    let active = true;

    loadAccountsReceivableData()
      .then((data) => {
        if (active) setApiData(data);
      })
      .catch(() => {
        if (active) setApiError("Información no disponible");
      });

    return () => {
      active = false;
    };
  }, []);

  let content = (
    <DashboardView kpis={kpis} facturas={facturas} />
  );

  async function refreshAccounts() {
    setRefreshingAccounts(true);
    setApiError(null);
    try { setApiData(await loadAccountsReceivableData(true)); }
    catch { setApiError("Información de cobros no disponible"); }
    finally { setRefreshingAccounts(false); }
  }

  if (!apiData) {
    content = (
      <>
        <PageHeader
          title="CxC PHO"
          description={apiError ?? "Cargando información desde Buk Finanzas."}
        />
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400">
          {apiError ?? "Consultando documentos y clientes de PHO..."}
        </div>
      </>
    );
  } else if (location.pathname === "/facturas") {
    content = (
      <>
        <PageHeader
          title="Facturas"
          description="Consulta de documentos, saldos, estados de pago, vencimiento y trazabilidad documental."
        />
        <DocumentMixSummary facturas={facturas} search={location.search} />
        <FacturasTable
          facturas={facturas}
          initialFiltro={params.get("filtro") ?? undefined}
          initialQuery={params.get("busqueda") ?? ""}
          search={location.search}
        />
      </>
    );
  }

  if (location.pathname === "/ingreso") {
    content = (
      <>
        <PageHeader
          title="Ingreso documental"
          description="Registro local de facturas afectas, exentas, notas de credito y notas de debito."
        />
        <InvoiceForm clientes={clientes} facturas={facturas} />
      </>
    );
  }

  if (location.pathname === "/clientes") {
    content = (
      <>
        <PageHeader
          title="Clientes"
          description="Mantencion local de clientes con nombre, RUT y tipo, sin correo, telefono ni direccion."
        />
        <ClientsView initialClientes={clientes} />
      </>
    );
  }

  if (location.pathname === "/trazabilidad") {
    content = (
      <>
        <PageHeader
          title="Trazabilidad"
          description="Detalle cronologico de emision, pagos, abonos, notas de credito, notas de debito y cierres."
          titleAction={
            traceabilityReturnHref ? (
              <button
                type="button"
                onClick={() => navigateTo(traceabilityReturnHref, { scroll: false })}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 dark:border-stone-700 dark:bg-[#151515] dark:text-stone-300 dark:hover:bg-black/35 dark:hover:text-white"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Volver al filtro
              </button>
            ) : null
          }
        />
        <TraceabilityView
          facturas={facturas}
          timelines={timelines}
          initialFacturaId={params.get("factura") ?? undefined}
        />
      </>
    );
  }

  if (location.pathname === "/proyectos") {
    content = <ProjectsView search={location.search} invoices={facturas} dataState={refreshingAccounts ? "loading" : apiError ? "error" : apiData ? "ready" : "loading"} onRefreshAccounts={refreshAccounts} />;
  }

  return (
    <div className="min-h-screen">
      <AppSidebar pathname={location.pathname} />
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1500px]">{content}</div>
      </main>
    </div>
  );
}
