import { readJson } from "../../../shared/http/read-json.js";
import { createDocumentIntakeService } from "../application/prepare-document-intake.js";
import { createLocalDocumentStorage } from "../infrastructure/local-document-storage.js";

export const documentIntakeRoutes = [
  {
    method: "POST",
    path: "/api/document-intake/documents",
    handler: async ({ request, env }) => {
      const payload = await readJson(request);
      const service = createDocumentIntakeService(createLocalDocumentStorage(env));
      return service.prepareDocument(payload);
    }
  }
];
