import {
  Cliente,
  Factura
} from "@/modules/accounts-receivable/types";

type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

type ApiErrorEnvelope = {
  requestId?: string;
  error?: string | {
    code?: string;
    message?: string;
  };
};

export type AccountsReceivableApiData = {
  clientes: Cliente[];
  facturas: Factura[];
};

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = (configuredBaseUrl || "/api").replace(/\/$/, "");
let dataPromise: Promise<AccountsReceivableApiData> | null = null;

function errorMessage(payload: ApiErrorEnvelope | null) {
  if (typeof payload?.error === "string") return payload.error;
  if (payload?.error && typeof payload.error === "object") {
    return payload.error.message || "Información no disponible";
  }
  return "Información no disponible";
}

async function fetchEnvelope<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json"
    }
  });

  let payload: ApiEnvelope<T> | ApiErrorEnvelope | null = null;

  try {
    payload = await response.json() as ApiEnvelope<T> | ApiErrorEnvelope;
  } catch {
    throw new Error("Información no disponible");
  }

  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload as ApiErrorEnvelope | null));
  }

  return payload.data;
}

export function loadAccountsReceivableData(force = false) {
  if (force) dataPromise = null;
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetchEnvelope<Factura[]>("/accounts-receivable/invoices"),
      fetchEnvelope<Cliente[]>("/customers")
    ])
      .then(([facturas, clientes]) => {
        if (!Array.isArray(facturas) || !Array.isArray(clientes)) {
          throw new Error("Información no disponible");
        }

        return { facturas, clientes };
      })
      .catch((error) => {
        dataPromise = null;
        throw error;
      });
  }

  return dataPromise;
}
