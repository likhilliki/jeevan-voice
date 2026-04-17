import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkHealth as checkQdrantHealth } from "../services/qdrant.js";
import { checkHealth as checkOpenAIHealth } from "../services/openai.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const [qdrant, openai] = await Promise.allSettled([
    checkQdrantHealth(),
    checkOpenAIHealth(),
  ]);

  const data = HealthCheckResponse.parse({
    status: "ok",
    qdrant: qdrant.status === "fulfilled" ? qdrant.value : "error",
    openai: openai.status === "fulfilled" ? openai.value : "error",
  });

  res.json(data);
});

export default router;
