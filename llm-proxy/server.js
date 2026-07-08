import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { Agent } from "@cursor/sdk";

const app = express();
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT ?? 8081);
const apiKey = process.env.CURSOR_API_KEY;
const defaultModel = process.env.DEFAULT_MODEL ?? "composer-2.5";
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.error("CURSOR_API_KEY is required. Copy llm-proxy/.env.example to llm-proxy/.env");
  process.exit(1);
}

// Minimal cwd avoids the agent exploring the repo on every planning request.
const agentCwd = process.env.AGENT_CWD ?? path.join(os.tmpdir(), "itinerate-llm-cwd");
fs.mkdirSync(agentCwd, { recursive: true });

const DEBUG_LOG_URL =
  "http://127.0.0.1:7661/ingest/5273d649-8946-4d8f-9e26-0228c43936fb";
const DEBUG_SESSION = "4fb88c";

function debugLog(hypothesisId, location, message, data) {
  fetch(DEBUG_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": DEBUG_SESSION },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

/** Pool of pre-warmed agents — one agent per request keeps chat completions stateless. */
const warmAgents = new Map(); // modelId -> Agent[]
const AGENT_POOL_SIZE = 2;
// Model inference is highly variable (typically 7–45s under load). This timeout is
// only a safety net for pathological hangs (e.g. a run stuck far past 60s): it must
// sit above the normal "slow but completes" band, otherwise it kills legitimate
// slow runs and a retry makes total latency worse.
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 60000);
const AGENT_MAX_ATTEMPTS = Number(process.env.AGENT_MAX_ATTEMPTS ?? 2);
let chatQueue = Promise.resolve();
let poolReady = refillAgentPool(defaultModel, AGENT_POOL_SIZE);

async function createChatAgent(modelId) {
  return Agent.create({
    apiKey,
    model: { id: modelId },
    local: { cwd: agentCwd },
  });
}

async function refillAgentPool(modelId, count = AGENT_POOL_SIZE) {
  const pool = warmAgents.get(modelId) ?? [];
  warmAgents.set(modelId, pool);
  while (pool.length < count) {
    try {
      pool.push(await createChatAgent(modelId));
    } catch {
      break;
    }
  }
}

async function borrowChatAgent(modelId) {
  await poolReady;
  const pool = warmAgents.get(modelId) ?? [];
  if (pool.length > 0) {
    const agent = pool.pop();
    refillAgentPool(modelId).catch(() => {});
    return { agent, borrowedFromPool: true };
  }
  const t0 = Date.now();
  const agent = await createChatAgent(modelId);
  return { agent, borrowedFromPool: false, createMs: Date.now() - t0 };
}

async function returnChatAgent(modelId, agent) {
  if (agent?.[Symbol.asyncDispose]) {
    try {
      await agent[Symbol.asyncDispose]();
    } catch {
      // best-effort cleanup
    }
  }
  refillAgentPool(modelId).catch(() => {});
}

const TIMEOUT = Symbol("timeout");

async function sendOnce(modelId, prompt, attempt) {
  const { agent, borrowedFromPool, createMs } = await borrowChatAgent(modelId);
  const sendStart = Date.now();
  let timer;
  try {
    const run = await agent.send(prompt);
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(TIMEOUT), AGENT_TIMEOUT_MS);
    });
    const result = await Promise.race([run.wait(), timeout]);
    clearTimeout(timer);

    if (result === TIMEOUT) {
      // #region agent log
      debugLog("F", "llm-proxy/sendOnce", "Agent run timed out", {
        modelId,
        attempt,
        timeoutMs: AGENT_TIMEOUT_MS,
        borrowedFromPool,
      });
      // #endregion
      if (typeof run.supports !== "function" || run.supports("cancel")) {
        run.cancel().catch(() => {});
      }
      // Stalled agent is discarded (not returned to pool) and pool is refilled.
      returnChatAgent(modelId, agent).catch(() => {});
      return { timedOut: true };
    }

    // #region agent log
    debugLog("A", "llm-proxy/sendOnce", "Agent send complete", {
      modelId,
      attempt,
      inferenceMs: Date.now() - sendStart,
      createMs: createMs ?? 0,
      borrowedFromPool,
      status: result.status,
      contentLength: (result.result ?? "").length,
    });
    // #endregion
    returnChatAgent(modelId, agent).catch(() => {});
    return { result };
  } catch (err) {
    clearTimeout(timer);
    returnChatAgent(modelId, agent).catch(() => {});
    throw err;
  }
}

function runChatPrompt(modelId, prompt) {
  const task = async () => {
    const t0 = Date.now();
    let lastErr;
    for (let attempt = 1; attempt <= AGENT_MAX_ATTEMPTS; attempt++) {
      const pool = warmAgents.get(modelId) ?? [];
      // #region agent log
      debugLog("A", "llm-proxy/runChatPrompt", "Agent send start", {
        modelId,
        attempt,
        maxAttempts: AGENT_MAX_ATTEMPTS,
        promptLength: prompt.length,
        warmPoolSize: pool.length,
      });
      // #endregion
      try {
        const { result, timedOut } = await sendOnce(modelId, prompt, attempt);
        if (timedOut) {
          lastErr = new Error(`agent run timed out after ${AGENT_TIMEOUT_MS}ms`);
          continue;
        }
        // #region agent log
        debugLog("A", "llm-proxy/runChatPrompt", "Attempt succeeded", {
          modelId,
          attempt,
          totalElapsedMs: Date.now() - t0,
        });
        // #endregion
        return result;
      } catch (err) {
        lastErr = err;
        // #region agent log
        debugLog("D", "llm-proxy/runChatPrompt", "Attempt failed", {
          modelId,
          attempt,
          elapsedMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        });
        // #endregion
      }
    }
    throw lastErr ?? new Error("agent run failed");
  };
  const next = chatQueue.then(task, task);
  chatQueue = next.catch(() => {});
  return next;
}

function buildPrompt(messages) {
  return messages
    .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
    .join("\n\n");
}

function extractJson(text) {
  let trimmed = (text ?? "").trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    trimmed = trimmed.slice(start, end + 1);
  }
  return trimmed.trim();
}

app.get("/health", async (_req, res) => {
  const pool = warmAgents.get(defaultModel) ?? [];
  let poolOk = false;
  try {
    await poolReady;
    poolOk = pool.length > 0;
  } catch {
    poolOk = false;
  }
  const body = {
    status: poolOk ? "ok" : "starting",
    agentPoolSize: pool.length,
    agentPoolTarget: AGENT_POOL_SIZE,
    model: defaultModel,
  };
  res.status(poolOk ? 200 : 503).json(body);
});

// Resolve a free-text location to a real place using the Google Maps MCP.
// The Cursor agent drives the MCP tools (geocode / place search) and returns
// a structured place object.
app.post("/v1/maps/resolve", async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== "string" || !query.trim()) {
    res.status(400).json({ error: "query string is required" });
    return;
  }
  if (!googleMapsApiKey) {
    res.status(503).json({ error: "GOOGLE_MAPS_API_KEY is not configured on the llm-proxy" });
    return;
  }

  const prompt = [
    `Use the Google Maps tools to find the single best real-world place for this query: "${query.trim()}".`,
    "Geocode or search for the place, then respond with ONLY a JSON object of this exact shape:",
    '{"name":"","address":"","latitude":0,"longitude":0,"placeId":"","mapsUrl":""}',
    "Use the place's formatted address, latitude/longitude coordinates, and place_id.",
    'Set "mapsUrl" to a https://www.google.com/maps/search/?api=1&query=<lat>,<lng> link (or a place_id link).',
    'If no place can be found, respond with {"name":null}.',
  ].join("\n");

  try {
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: req.body.model ?? defaultModel },
      local: { cwd: process.cwd() },
      mcpServers: {
        googleMaps: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-google-maps"],
          env: { GOOGLE_MAPS_API_KEY: googleMapsApiKey },
        },
      },
    });

    if (result.status === "error") {
      res.status(502).json({ error: "Maps agent run failed", runId: result.id });
      return;
    }

    try {
      res.json(JSON.parse(extractJson(result.result ?? "")));
    } catch {
      res.status(502).json({ error: "Maps agent returned unparseable output" });
    }
  } catch (err) {
    console.error("Maps resolve error:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Maps resolve failed",
    });
  }
});

app.post("/v1/chat/completions", async (req, res) => {
  const requestStart = Date.now();
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const model = req.body.model ?? defaultModel;
  const prompt = buildPrompt(messages);

  try {
    await poolReady;
    const result = await runChatPrompt(model, prompt);

    if (result.status === "error") {
      res.status(502).json({ error: "Cursor agent run failed", runId: result.id });
      return;
    }

    const content = result.result ?? "";
    // #region agent log
    debugLog("A", "llm-proxy/server.js:response", "Chat completion done", {
      totalElapsedMs: Date.now() - requestStart,
      model,
      messageCount: messages.length,
      promptLength: prompt.length,
      contentLength: content.length,
    });
    // #endregion
    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    });
  } catch (err) {
    console.error("Cursor proxy error:", err);
    // #region agent log
    debugLog("D", "llm-proxy/server.js:catch", "Chat completion error", {
      totalElapsedMs: Date.now() - requestStart,
      error: err instanceof Error ? err.message : String(err),
    });
    // #endregion
    res.status(502).json({
      error: err instanceof Error ? err.message : "Cursor proxy failed",
    });
  }
});

app.listen(port, async () => {
  console.log(`Cursor LLM proxy listening on http://localhost:${port}/v1/chat/completions`);
  try {
    await poolReady;
    const pool = warmAgents.get(defaultModel) ?? [];
    console.log(`Agent pool ready (${pool.length}/${AGENT_POOL_SIZE} warm agents for ${defaultModel})`);
  } catch (err) {
    console.warn("Agent pool prewarm failed; requests will create agents on demand:", err);
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception — proxy will exit:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
