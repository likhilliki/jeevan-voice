import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";

let geminiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!geminiClient) {
    // The user provided their Google AI Studio (Gemini) key as OPENAI_API_KEY.
    // We accept either GEMINI_API_KEY or OPENAI_API_KEY for flexibility.
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY/OPENAI_API_KEY env var");
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // Try multiple shapes: top-level status, nested response/error, code
  const candidates: Array<unknown> = [
    e.status,
    (e.response as Record<string, unknown> | undefined)?.status,
    ((e.error as Record<string, unknown> | undefined)?.code) as unknown,
    e.code,
  ];
  for (const c of candidates) {
    const n = typeof c === "string" ? parseInt(c, 10) : (c as number);
    if (n === 429 || n === 500 || n === 503 || n === 504) return true;
  }
  // Last resort: check message
  const msg = String((e.message as string | undefined) || "");
  return /\b(429|500|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|rate limit)\b/i.test(
    msg,
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await withRetry(() =>
    client.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    }),
  );

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Failed to generate embedding");
  }
  return values;
}

export async function generateResponse(
  userQuery: string,
  memoryContext: string,
  intent: string,
  language: string,
  isEmergency: boolean,
): Promise<string> {
  const client = getClient();

  const systemPrompt = buildSystemPrompt(language, isEmergency);
  const userMessage = buildUserMessage(
    userQuery,
    memoryContext,
    intent,
    isEmergency,
  );

  const response = await withRetry(() =>
    client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    }),
  );

  const reply = response.text || "";
  logger.info({ intent, language, isEmergency }, "Response generated");
  return reply;
}

function buildSystemPrompt(language: string, isEmergency: boolean): string {
  const langInstructions: Record<string, string> = {
    hi: "Respond in Hindi. Use simple, everyday Hindi words that uneducated people understand. Avoid complex Sanskrit words.",
    kn: "Respond in Kannada. Use simple, everyday Kannada that rural people understand.",
    en: "Respond in simple English. Use short sentences. Avoid technical jargon.",
    auto: "Respond in the same language as the user's question. Use simple words.",
  };

  const langInstruction =
    langInstructions[language] || langInstructions["auto"];

  if (isEmergency) {
    return `You are Jeevan, an emergency voice assistant helping people in India. This is an EMERGENCY situation.
${langInstruction}
IMPORTANT: This is urgent. Give immediate, clear instructions. Tell them to call 108 (ambulance) immediately. Be calm but very direct. Keep response under 3 sentences.`;
  }

  return `You are Jeevan, a helpful voice assistant for people in India who may have low literacy.
${langInstruction}
You help with: healthcare guidance, government schemes (PM Jan Dhan, Ayushman Bharat, PM Kisan), financial assistance, daily navigation.
Rules:
- Use VERY simple language as if talking to someone who cannot read well
- Be warm, patient, and encouraging
- Give step-by-step instructions when needed
- Keep responses short (2-4 sentences max) — this will be spoken aloud
- If unsure, give a helpful general direction and suggest who to contact
- Do not use bullet points or lists — speak naturally`;
}

function buildUserMessage(
  query: string,
  memoryContext: string,
  intent: string,
  isEmergency: boolean,
): string {
  let message = "";

  if (memoryContext) {
    message += `[Previous conversations with this user: ${memoryContext}]\n\n`;
  }

  if (isEmergency) {
    message += `EMERGENCY: ${query}`;
  } else {
    message += `User question (intent: ${intent}): ${query}`;
  }

  return message;
}

export async function checkHealth(): Promise<string> {
  // Just verify the API key is configured — actual reachability is verified
  // on real query traffic with retries built in. A live ping for every health
  // probe would consume quota and false-flag transient overloads.
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  return apiKey ? "configured" : "disconnected";
}
