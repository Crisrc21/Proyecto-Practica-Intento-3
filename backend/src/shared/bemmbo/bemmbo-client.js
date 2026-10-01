import { HttpError } from "../errors/http-error.js";

const BASE_URL = "https://api.bemmbo.com/v1";
const PAGE_SIZE = 1000;
const MAX_PAGES = 1000;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createBemmboClient({ token, timeoutMs = 15000, fetchImpl = fetch }) {
  if (!token) {
    throw new HttpError(503, "Información no disponible", {
      code: "BEMMBO_TOKEN_PHO_MISSING"
    });
  }

  async function request(path, query = {}) {
    const url = new URL(`${BASE_URL}${path}`);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: token
        },
        signal: controller.signal
      });

      if (response.status === 204) return null;

      const body = await response.text();

      if (!response.ok) {
        throw new HttpError(502, "Información no disponible", {
          code: "BEMMBO_HTTP_ERROR",
          upstreamStatus: response.status
        });
      }

      if (!body.trim()) return null;

      try {
        return JSON.parse(body);
      } catch {
        throw new HttpError(502, "Información no disponible", {
          code: "BEMMBO_INVALID_JSON"
        });
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new HttpError(504, "Información no disponible", {
          code: "BEMMBO_TIMEOUT"
        });
      }

      throw new HttpError(502, "Información no disponible", {
        code: "BEMMBO_NETWORK_ERROR"
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function listIssuedInvoices() {
    const items = [];
    let partialErrorCount = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const payload = asObject(
        await request("/invoices/issued", {
          includeMovements: true,
          options_page: page,
          options_pageSize: PAGE_SIZE,
          options_sortBy: "DATE",
          options_sortOrder: "ASC"
        })
      );
      const pageResults = asArray(payload.pageResults);
      const total = Number(payload.total);

      items.push(...pageResults);
      partialErrorCount += asArray(payload.errors).length;

      const reachedKnownTotal = Number.isFinite(total) && items.length >= total;
      const reachedUnknownEnd = !Number.isFinite(total) && pageResults.length < PAGE_SIZE;

      if (pageResults.length === 0 || reachedKnownTotal || reachedUnknownEnd) {
        return { items, partialErrorCount };
      }
    }

    throw new HttpError(502, "Información no disponible", {
      code: "BEMMBO_PAGINATION_LIMIT"
    });
  }

  async function listCustomers() {
    const items = [];
    const seenTokens = new Set();
    let nextToken;
    let partialErrorCount = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const payload = asObject(
        await request("/customers", {
          options_nextToken: nextToken,
          options_pageSize: PAGE_SIZE,
          options_sortOrder: "ASC"
        })
      );

      items.push(...asArray(payload.data));
      partialErrorCount += asArray(payload.errors).length;
      nextToken = typeof payload.nextToken === "string" ? payload.nextToken.trim() : "";

      if (!nextToken) {
        return { items, partialErrorCount };
      }

      if (seenTokens.has(nextToken)) {
        throw new HttpError(502, "Información no disponible", {
          code: "BEMMBO_REPEATED_TOKEN"
        });
      }

      seenTokens.add(nextToken);
    }

    throw new HttpError(502, "Información no disponible", {
      code: "BEMMBO_PAGINATION_LIMIT"
    });
  }

  return { listIssuedInvoices, listCustomers };
}
