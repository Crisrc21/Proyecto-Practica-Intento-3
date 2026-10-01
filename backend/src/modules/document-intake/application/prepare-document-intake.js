import { HttpError } from "../../../shared/errors/http-error.js";
import { acceptedDocumentTypes } from "../domain/document-intake-model.js";

export function createDocumentIntakeService(storage) {
  return {
    prepareDocument(payload) {
      if (!acceptedDocumentTypes.includes(payload.tipoDocumento)) {
        throw new HttpError(400, "Unsupported document type", { acceptedDocumentTypes });
      }

      if (!payload.numero || !payload.clienteId || !payload.monto) {
        throw new HttpError(400, "Missing required document fields", {
          required: ["numero", "clienteId", "tipoDocumento", "monto"]
        });
      }

      return {
        status: "prepared",
        privatePath: storage.getPrivatePath(),
        document: {
          numero: payload.numero,
          clienteId: payload.clienteId,
          tipoDocumento: payload.tipoDocumento,
          monto: Number(payload.monto)
        }
      };
    }
  };
}
