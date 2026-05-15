import type { FastifyInstance } from "fastify";
import { ReferenceDataRepository } from "../infrastructure/referenceDataRepository.js";

const repo = new ReferenceDataRepository();

export async function registerReferenceDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/kupci", async () => repo.listKupci());
  app.get("/djelatnici", async () => repo.listDjelatnici());
  app.get("/bicikli", async () => repo.listBicikli());
}
