import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../lib/logger.js";

const COLLECTION_NAME = "user_memory";
const VECTOR_SIZE = 1536; // text-embedding-3-small dimension

let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    const apiKey = process.env.QDRANT_API_KEY;

    client = new QdrantClient({
      url,
      ...(apiKey ? { apiKey } : {}),
    });
  }
  return client;
}

export async function initCollection(): Promise<void> {
  const qdrant = getClient();
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME,
    );

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      logger.info({ collection: COLLECTION_NAME }, "Qdrant collection created");
    } else {
      logger.info(
        { collection: COLLECTION_NAME },
        "Qdrant collection already exists",
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to initialize Qdrant collection");
    throw err;
  }
}

export async function upsertMemory(
  userId: string,
  text: string,
  embedding: number[],
  metadata: {
    language: string;
    intent: string;
    timestamp: string;
  },
): Promise<void> {
  const qdrant = getClient();
  const id = Date.now(); // use timestamp as numeric ID

  await qdrant.upsert(COLLECTION_NAME, {
    points: [
      {
        id,
        vector: embedding,
        payload: {
          userId,
          text,
          language: metadata.language,
          intent: metadata.intent,
          timestamp: metadata.timestamp,
        },
      },
    ],
  });

  logger.info({ userId, intent: metadata.intent }, "Memory stored");
}

export async function searchMemory(
  userId: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<
  Array<{
    id: string;
    text: string;
    timestamp: string;
    language: string;
    intent: string;
    score: number;
  }>
> {
  const qdrant = getClient();

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    limit,
    filter: {
      must: [
        {
          key: "userId",
          match: { value: userId },
        },
      ],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    id: String(r.id),
    text: (r.payload?.text as string) || "",
    timestamp: (r.payload?.timestamp as string) || "",
    language: (r.payload?.language as string) || "en",
    intent: (r.payload?.intent as string) || "general",
    score: r.score,
  }));
}

export async function getUserMemories(userId: string): Promise<
  Array<{
    id: string;
    text: string;
    timestamp: string;
    language: string;
    intent: string;
  }>
> {
  const qdrant = getClient();

  const results = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "userId",
          match: { value: userId },
        },
      ],
    },
    with_payload: true,
    limit: 50,
  });

  return (results.points || []).map((r) => ({
    id: String(r.id),
    text: (r.payload?.text as string) || "",
    timestamp: (r.payload?.timestamp as string) || "",
    language: (r.payload?.language as string) || "en",
    intent: (r.payload?.intent as string) || "general",
  }));
}

export async function clearUserMemory(userId: string): Promise<void> {
  const qdrant = getClient();

  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "userId",
          match: { value: userId },
        },
      ],
    },
  });

  logger.info({ userId }, "User memory cleared");
}

export async function checkHealth(): Promise<string> {
  try {
    const qdrant = getClient();
    await qdrant.getCollections();
    return "connected";
  } catch {
    return "disconnected";
  }
}
