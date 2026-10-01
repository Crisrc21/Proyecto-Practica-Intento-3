import test from "node:test";
import assert from "node:assert/strict";
import { createBemmboClient } from "../src/shared/bemmbo/bemmbo-client.js";
import {
  adaptIssuedDocuments,
  createBemmboReceivablesRepository
} from "../src/modules/accounts-receivable/infrastructure/bemmbo-receivables-repository.js";
import { createBemmboCustomersRepository } from "../src/modules/customers/infrastructure/bemmbo-customers-repository.js";

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("cliente Bemmbo pagina facturas desde cero y conserva errores parciales como conteo", async () => {
  const pages = [];
  const client = createBemmboClient({
    token: "test-token",
    fetchImpl: async (url) => {
      const page = Number(url.searchParams.get("options_page"));
      pages.push(page);
      return jsonResponse(
        page === 0
          ? { total: 2, pageResults: [{ id: "one" }], errors: ["partial"] }
          : { total: 2, pageResults: [{ id: "two" }], errors: [] }
      );
    }
  });

  const result = await client.listIssuedInvoices();
  assert.deepEqual(pages, [0, 1]);
  assert.equal(result.items.length, 2);
  assert.equal(result.partialErrorCount, 1);
});

test("adaptador une NC por referencia, empresa implícita PHO y RUT normalizado", () => {
  const documents = [
    {
      id: "invoice",
      number: "000123",
      documentType: "INVOICE",
      customerFiscalId: "76.123.456-K",
      emissionDate: "2026-06-01",
      dueByDate: "2026-07-01",
      totalAmount: 10000,
      availableAmount: 7000,
      currency: "CLP",
      movements: []
    },
    {
      id: "credit-note",
      number: "45",
      documentType: "CREDIT_NOTE",
      customerFiscalId: "76123456K",
      emissionDate: "2026-06-02",
      totalAmount: 3000,
      references: [{ FolioRef: "123", RazonRef: "Ajuste comercial" }]
    }
  ];

  const result = adaptIssuedDocuments(documents);
  assert.equal(result.length, 1);
  assert.equal(result[0].notasCredito.length, 1);
  assert.equal(result[0].notasCredito[0].monto, 3000);
  assert.equal(result[0].clienteId, "76123456K");
});

test("no relaciona notas por folio cuando el RUT es distinto", () => {
  const result = adaptIssuedDocuments([
    {
      id: "invoice",
      number: "123",
      documentType: "INVOICE",
      customerFiscalId: "76123456K",
      emissionDate: "2026-06-01",
      totalAmount: 10000
    },
    {
      id: "credit-note",
      number: "45",
      documentType: "CREDIT_NOTE",
      customerFiscalId: "111111111",
      emissionDate: "2026-06-02",
      totalAmount: 3000,
      references: [{ FolioRef: "123" }]
    }
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].notasCredito.length, 0);
});

test("adaptador separa anulaciones de NC reales y conserva ND standalone", () => {
  const result = adaptIssuedDocuments([
    {
      id: "nullified-invoice",
      number: "100",
      documentType: "INVOICE",
      customerFiscalId: "76123456K",
      emissionDate: "2026-06-01",
      totalAmount: 10000,
      status: "NULLIFIED"
    },
    {
      id: "standalone-credit-note",
      number: "101",
      documentType: "CREDIT_NOTE",
      customerFiscalId: "76123456K",
      emissionDate: "2026-06-02",
      totalAmount: 3000
    },
    {
      id: "standalone-debit-note",
      number: "102",
      documentType: "DEBIT_NOTE",
      customerFiscalId: "76123456K",
      emissionDate: "2026-06-03",
      availableAmount: 2000
    }
  ]);

  assert.equal(result.length, 3);
  assert.equal(result[0].anulada, true);
  assert.equal(result[0].notasCredito.length, 0);
  assert.equal(result.reduce((total, item) => total + item.notasCredito.length, 0), 1);
  assert.equal(result.reduce((total, item) => total + item.notasDebito.length, 0), 1);
});

test("repositorios entregan el contrato existente sin secretos Bemmbo", async () => {
  const client = {
    async listCustomers() {
      return {
        items: [
          {
            id: "customer",
            name: "Cliente PHO",
            fiscalId: "76.123.456-K",
            verificationCode: "sensitive"
          }
        ],
        partialErrorCount: 1
      };
    },
    async listIssuedInvoices() {
      return {
        items: [
          {
            id: "invoice",
            number: "123",
            documentType: "INVOICE",
            customerFiscalId: "76.123.456-K",
            emissionDate: "2026-06-01",
            dueByDate: "2026-07-01",
            totalAmount: 10000,
            availableAmount: 5000,
            movements: [
              {
                date: "2026-06-15",
                amountAssigned: 5000,
                recipientAccount: { number: "sensitive" }
              }
            ]
          }
        ],
        partialErrorCount: 1
      };
    }
  };
  const customers = await createBemmboCustomersRepository(client).list();
  const receivables = createBemmboReceivablesRepository(client);
  const invoices = await receivables.listInvoices();
  const serialized = JSON.stringify({ customers, invoices });

  assert.equal(customers[0].nombre, "Cliente PHO");
  assert.equal(customers[0].informacionParcial, true);
  assert.equal(invoices[0].pagos[0].monto, 5000);
  assert.equal(invoices[0].informacionParcial, true);
  assert.equal(serialized.includes("verificationCode"), false);
  assert.equal(serialized.includes("recipientAccount"), false);
  assert.equal(serialized.includes("sensitive"), false);
});
