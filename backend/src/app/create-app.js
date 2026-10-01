import { createServer } from "node:http";
import { accountsReceivableRoutes } from "../modules/accounts-receivable/index.js";
import { customerRoutes } from "../modules/customers/index.js";
import { documentIntakeRoutes } from "../modules/document-intake/index.js";
import { projectsRoutes } from "../modules/projects/index.js";
import { HttpError } from "../shared/errors/http-error.js";
import { sendJson } from "../shared/http/send-json.js";
import { createRequestId } from "../shared/request-id/create-request-id.js";

export function createApp(env) {
  const routes = [
    {
      method: "GET",
      path: "/api/health",
      handler: async () => ({ ok: true, service: "cxc-pho-backend" })
    },
    ...accountsReceivableRoutes,
    ...customerRoutes,
    ...documentIntakeRoutes,
    ...projectsRoutes
  ];

  return createServer(async (request, response) => {
    const requestId = createRequestId();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const route = routes.find((item) => item.method === request.method && item.path === url.pathname);
    const corsHeaders = {
      "access-control-allow-origin": env.allowedOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-request-id",
      "x-request-id": requestId
    };

    if (request.method === "OPTIONS") {
      sendJson(response, 204, {}, corsHeaders);
      return;
    }

    if (!route) {
      sendJson(response, 404, { error: "Route not found", requestId }, corsHeaders);
      return;
    }

    try {
      const payload = await route.handler({ request, url, requestId, env });
      sendJson(response, 200, { data: payload, requestId }, corsHeaders);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      sendJson(
        response,
        statusCode,
        {
          error: error instanceof Error ? error.message : "Unexpected error",
          details: error instanceof HttpError ? error.details : undefined,
          requestId
        },
        corsHeaders
      );
    }
  });
}
