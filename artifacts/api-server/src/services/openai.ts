import OpenAI from "openai";
import { logger } from "../lib/logger.js";

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
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

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const reply = response.choices[0].message.content || "";
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
  try {
    const client = getClient();
    await client.models.list();
    return "connected";
  } catch {
    return "disconnected";
  }
}
