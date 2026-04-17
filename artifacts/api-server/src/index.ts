import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initCollection } from "./services/qdrant.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Initialize Qdrant collection on startup
initCollection()
  .then(() => {
    logger.info("Qdrant collection initialized");
  })
  .catch((err) => {
    logger.warn({ err }, "Qdrant init failed — running without memory persistence");
  });

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Jeevan Voice server listening");
});
