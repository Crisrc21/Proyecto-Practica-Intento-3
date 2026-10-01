import { createAccountsReceivableService } from "../application/accounts-receivable-service.js";
import { createBemmboReceivablesRepository } from "../infrastructure/bemmbo-receivables-repository.js";
import { createBemmboClient } from "../../../shared/bemmbo/bemmbo-client.js";

function createService(env) {
  const client = createBemmboClient({
    token: env.bemmboTokenPho,
    timeoutMs: env.bemmboTimeoutMs
  });
  return createAccountsReceivableService(createBemmboReceivablesRepository(client));
}

export const accountsReceivableRoutes = [
  {
    method: "GET",
    path: "/api/accounts-receivable/dashboard",
    handler: ({ env }) => createService(env).getDashboard()
  },
  {
    method: "GET",
    path: "/api/accounts-receivable/invoices",
    handler: ({ env }) => createService(env).listInvoices()
  },
  {
    method: "GET",
    path: "/api/accounts-receivable/timelines",
    handler: ({ env }) => createService(env).getTimelines()
  }
];
