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

export interface ActionItem {
  type: "map" | "directions" | "call" | "link";
  label: string;
  query?: string;
  destination?: string;
  phone?: string;
  url?: string;
}

export interface AIResponse {
  reply: string;
  actions: ActionItem[];
}

const ALLOWED_LINK_HOSTS = [
  "pmjay.gov.in",
  "pmkisan.gov.in",
  "pmjdy.gov.in",
  "india.gov.in",
  "mygov.in",
  "janaushadhi.gov.in",
  "umang.gov.in",
  "nhp.gov.in",
  "mohfw.gov.in",
  "digitalindia.gov.in",
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return ALLOWED_LINK_HOSTS.some(
    (allowed) => h === allowed || h.endsWith("." + allowed),
  );
}

export function sanitizeActions(actions: ActionItem[]): ActionItem[] {
  if (!Array.isArray(actions)) return [];
  const cleaned: ActionItem[] = [];
  for (const a of actions) {
    if (!a || typeof a !== "object" || !a.label || !a.type) continue;
    const label = String(a.label).slice(0, 80).trim();
    if (!label) continue;

    switch (a.type) {
      case "call": {
        const phone = String(a.phone || "").replace(/[^0-9+\-]/g, "");
        if (!phone || phone.length < 3 || phone.length > 20) continue;
        cleaned.push({ type: "call", label, phone });
        break;
      }
      case "map": {
        const query = String(a.query || "").slice(0, 200).trim();
        if (!query) continue;
        cleaned.push({ type: "map", label, query });
        break;
      }
      case "directions": {
        const destination = String(a.destination || "").slice(0, 200).trim();
        if (!destination) continue;
        cleaned.push({ type: "directions", label, destination });
        break;
      }
      case "link": {
        const rawUrl = String(a.url || "").trim();
        if (!rawUrl) continue;
        try {
          const u = new URL(rawUrl);
          if (u.protocol !== "https:") continue;
          if (!isAllowedHost(u.hostname)) continue;
          cleaned.push({ type: "link", label, url: u.toString() });
        } catch {
          continue;
        }
        break;
      }
      default:
        continue;
    }
    if (cleaned.length >= 4) break;
  }
  return cleaned;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "The spoken reply to the user, simple and warm, in the requested language. 2-4 short sentences.",
    },
    actions: {
      type: "array",
      description:
        "1-3 helpful action buttons the user can tap to take real next steps.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["map", "directions", "call", "link"],
          },
          label: {
            type: "string",
            description:
              "Short button label in the user's language (max 5 words).",
          },
          query: {
            type: "string",
            description:
              "For type=map: place name to search on Google Maps (e.g. 'government hospital near me', 'PMJAY empanelled hospital Bangalore').",
          },
          destination: {
            type: "string",
            description: "For type=directions: destination address or place.",
          },
          phone: {
            type: "string",
            description:
              "For type=call: phone number (e.g. '108', '1800-180-1551').",
          },
          url: {
            type: "string",
            description:
              "For type=link: full URL to an official Indian government website.",
          },
        },
        required: ["type", "label"],
      },
    },
  },
  required: ["reply", "actions"],
};

export async function generateResponse(
  userQuery: string,
  memoryContext: string,
  intent: string,
  language: string,
  isEmergency: boolean,
): Promise<AIResponse> {
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
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
      },
    }),
  );

  const raw = response.text || "{}";
  let parsed: AIResponse;
  try {
    parsed = JSON.parse(raw) as AIResponse;
    if (!parsed.reply) parsed.reply = "";
    if (!Array.isArray(parsed.actions)) parsed.actions = [];
  } catch {
    parsed = { reply: raw, actions: [] };
  }

  parsed.actions = sanitizeActions(parsed.actions);

  logger.info(
    { intent, language, isEmergency, actionCount: parsed.actions.length },
    "Response generated",
  );
  return parsed;
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

  const actionGuide = `
You MUST also return 1-3 useful "actions" the user can tap. Pick the right type:
- type="call" with a phone number (e.g. 108 ambulance, 1800-180-1551 PM Kisan helpline, 14555 Ayushman Bharat helpline, 1916 child helpline, 100 police, 101 fire)
- type="map" with query="..." for finding nearby places (e.g. "government hospital near me", "PMJAY empanelled hospital", "nearest CSC center", "Jan Aushadhi store near me")
- type="directions" with destination="..." when the user asks to go somewhere specific
- type="link" with url="..." pointing ONLY to real official .gov.in / nic.in websites you are sure exist:
   - https://pmjay.gov.in (Ayushman Bharat)
   - https://pmkisan.gov.in (PM Kisan)
   - https://pmjdy.gov.in (Jan Dhan)
   - https://www.india.gov.in (general schemes)
   - https://www.mygov.in
   - https://janaushadhi.gov.in (cheap medicines)
   - https://www.umang.gov.in (citizen services)
Action labels MUST be in the user's language. Do NOT invent URLs that may not exist. If unsure, prefer a map or call action.`;

  if (isEmergency) {
    return `You are Jeevan, an emergency voice assistant helping people in India. This is an EMERGENCY situation.
${langInstruction}
IMPORTANT: This is urgent. Give immediate, clear instructions. Tell them to call 108 (ambulance) immediately. Be calm but very direct. Keep response under 3 sentences.
${actionGuide}
For emergencies, ALWAYS include a call action for 108 and a map action to find the nearest hospital.`;
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
- Do not use bullet points or lists — speak naturally
${actionGuide}`;
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
