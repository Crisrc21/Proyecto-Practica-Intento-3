import { createCustomerService } from "../application/customer-service.js";
import { createBemmboCustomersRepository } from "../infrastructure/bemmbo-customers-repository.js";
import { createBemmboClient } from "../../../shared/bemmbo/bemmbo-client.js";

function createService(env) {
  const client = createBemmboClient({
    token: env.bemmboTokenPho,
    timeoutMs: env.bemmboTimeoutMs
  });
  return createCustomerService(createBemmboCustomersRepository(client));
}

export const customerRoutes = [
  {
    method: "GET",
    path: "/api/customers",
    handler: ({ env }) => createService(env).listCustomers()
  }
];
