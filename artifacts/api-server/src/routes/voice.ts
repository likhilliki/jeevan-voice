import { Router } from "express";
import { processQuery } from "../services/agent.js";
import {
  getUserMemories,
  clearUserMemory,
} from "../services/qdrant.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * POST /api/vapi-webhook
 * Main Vapi voice webhook handler.
 * Vapi sends events here during a call lifecycle.
 */
router.post("/vapi-webhook", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.type) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const messageType = message.type;

    // Vapi sends different event types — we only care about transcript events
    if (messageType === "transcript" || messageType === "speech-update") {
      const transcript: string = message.transcript || "";
      const callId: string = message.call?.id || "unknown";
      const customerPhone: string = message.customer?.number || "anonymous";

      if (!transcript.trim()) {
        res.json({ response: "", intent: "general", isEmergency: false, language: "en" });
        return;
      }

      req.log.info({ callId, customerPhone, transcript }, "Vapi webhook received");

      const result = await processQuery(transcript, callId, "auto");

      res.json({
        response: result.response,
        intent: result.intent,
        isEmergency: result.isEmergency,
        language: result.language,
      });

    } else if (messageType === "function-call") {
      // Handle function calls from Vapi (e.g., custom tool calls)
      res.json({ result: "Function call received" });

    } else {
      // For other event types (call-start, call-end, etc.), acknowledge
      res.json({ status: "acknowledged", type: messageType });
    }

  } catch (err) {
    logger.error({ err }, "Vapi webhook error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/query
 * Text query endpoint for testing the AI agent without voice.
 */
router.post("/query", async (req, res) => {
  try {
    const { text, userId, language } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }

    const resolvedUserId = userId || `anon_${Date.now()}`;

    req.log.info({ userId: resolvedUserId, textLength: text.length }, "Text query received");

    const result = await processQuery(text, resolvedUserId, language || "auto");

    res.json({
      response: result.response,
      intent: result.intent,
      isEmergency: result.isEmergency,
      language: result.language,
      userId: result.userId,
      memoryUsed: result.memoryUsed,
    });

  } catch (err) {
    logger.error({ err }, "Query error");
    res.status(500).json({ error: "Failed to process query" });
  }
});

/**
 * GET /api/memory/:userId
 * Retrieve stored conversation memory for a user.
 */
router.get("/memory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const memories = await getUserMemories(userId);

    res.json({
      userId,
      memories,
      count: memories.length,
    });

  } catch (err) {
    logger.error({ err }, "Memory retrieval error");
    res.status(500).json({ error: "Failed to retrieve memory" });
  }
});

/**
 * DELETE /api/memory/:userId
 * Clear all stored memory for a user.
 */
router.delete("/memory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    await clearUserMemory(userId);

    res.json({
      success: true,
      message: `Memory cleared for user ${userId}`,
    });

  } catch (err) {
    logger.error({ err }, "Memory clear error");
    res.status(500).json({ error: "Failed to clear memory" });
  }
});

export default router;
