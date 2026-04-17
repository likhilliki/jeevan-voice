import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger.js";

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (!baseURL || !apiKey) {
      throw new Error("Missing Anthropic AI integration env vars");
    }
    anthropicClient = new Anthropic({ baseURL, apiKey });
  }
  return anthropicClient;
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const status = (e.status as number | undefined) ?? 0;
  if (status === 429 || status === 500 || status === 503 || status === 504)
    return true;
  const msg = String((e.message as string | undefined) || "");
  return /\b(429|500|503|504|overloaded|rate limit)\b/i.test(msg);
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

// Embeddings are not needed in the Claude-only flow — memory is now stored
// as recent text snippets per user (see qdrant.ts replacement).
// We keep this export for backward compatibility but it just returns an empty
// array to indicate "no embedding available".
export async function createEmbedding(_text: string): Promise<number[]> {
  return [];
}

export async function checkHealth(): Promise<string> {
  try {
    const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (!baseURL || !apiKey) return "disconnected";
    return "connected";
  } catch {
    return "disconnected";
  }
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

// Claude tool definition that forces structured JSON output.
const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond_to_user",
  description:
    "Send the spoken reply to the user along with 1-3 actionable buttons they can tap.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "The spoken reply in the user's language. 2-4 short sentences.",
      },
      actions: {
        type: "array",
        description: "1-3 helpful action buttons the user can tap.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["map", "directions", "call", "link"],
            },
            label: {
              type: "string",
              description: "Short button label in the user's language.",
            },
            query: {
              type: "string",
              description:
                "For type=map: place name to search on Google Maps.",
            },
            destination: {
              type: "string",
              description: "For type=directions: destination address or place.",
            },
            phone: {
              type: "string",
              description: "For type=call: phone number (e.g. '108').",
            },
            url: {
              type: "string",
              description:
                "For type=link: full https:// URL to an official Indian gov website.",
            },
          },
          required: ["type", "label"],
        },
      },
    },
    required: ["reply", "actions"],
  },
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
    client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      tools: [RESPOND_TOOL],
      tool_choice: { type: "tool", name: "respond_to_user" },
      messages: [{ role: "user", content: userMessage }],
    }),
  );

  let parsed: AIResponse = { reply: "", actions: [] };

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "respond_to_user") {
      const input = block.input as Partial<AIResponse>;
      parsed = {
        reply: String(input.reply || ""),
        actions: Array.isArray(input.actions) ? input.actions : [],
      };
      break;
    }
    if (block.type === "text" && !parsed.reply) {
      parsed.reply = block.text;
    }
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
You MUST call the respond_to_user tool with 1-3 useful actions the user can tap. Pick the right type:
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
    message += `[Detected intent: ${intent}]\n${query}`;
  }

  return message;
}
