import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { normalizeClassification } from "../domain/contract-classification.js";

const rootPath = fileURLToPath(new URL("../../../../../", import.meta.url));
const queues = new Map();

export function createProjectsRepository(env) {
  const file = resolve(rootPath, env.dataPrivatePath || "data/private", "projects.json");
  async function read() {
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      if (data.schemaVersion !== 1 || !Array.isArray(data.projects)) throw new Error("Formato de proyectos inválido.");
      return { ...data, projects: data.projects.map(normalizeClassification) };
    } catch (error) {
      if (error.code === "ENOENT") return { schemaVersion: 1, projects: [] };
      throw error;
    }
  }
  async function transaction(update) {
    const prior = queues.get(file) || Promise.resolve();
    const operation = prior.catch(() => {}).then(async () => {
      const data = await read();
      const result = await update(data);
      await mkdir(dirname(file), { recursive: true });
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
        await rename(temp, file);
      } finally {
        await rm(temp, { force: true });
      }
      return result;
    });
    queues.set(file, operation);
    try { return await operation; }
    finally { if (queues.get(file) === operation) queues.delete(file); }
  }
  return { read, transaction };
}
