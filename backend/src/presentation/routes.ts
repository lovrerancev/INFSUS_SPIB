import type { FastifyInstance } from "fastify";
import { registerAdminRoutes } from "./adminRoutes.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { registerBiciklRoutes } from "./biciklRoutes.js";
import { registerIzvjestajiRoutes } from "./izvjestajiRoutes.js";
import { registerKategorijeRoutes } from "./kategorijeRoutes.js";
import { registerNajamRoutes } from "./najamRoutes.js";
import { registerNarudzbeRoutes } from "./narudzbeRoutes.js";
import { registerReferenceDataRoutes } from "./referenceDataRoutes.js";

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok", service: "spib-backend" }));

  await app.register(registerAuthRoutes);
  await app.register(registerAdminRoutes);
  await app.register(registerBiciklRoutes);
  await app.register(registerNajamRoutes);
  await app.register(registerIzvjestajiRoutes);
  await app.register(registerReferenceDataRoutes);
  await app.register(registerKategorijeRoutes);
  await app.register(registerNarudzbeRoutes);
}
