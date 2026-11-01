import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(root, "public")));

const systemPrompt = `Tu es NOVA, un assistant IA indépendant, utile, patient et honnête.
Réponds dans la langue de l'utilisateur. Explique clairement, structure les réponses
et signale tes incertitudes. Ne prétends pas avoir effectué une action que tu n'as
pas réellement effectuée.`;

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(process.env.AI_API_URL && process.env.AI_MODEL) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { AI_API_URL, AI_API_KEY, AI_MODEL } = process.env;
    if (!AI_API_URL || !AI_MODEL) {
      return res.status(503).json({
        error: "Le moteur IA n'est pas configuré. Consulte le guide README pour le connecter."
      });
    }

    const maxMessages = Math.min(Math.max(Number(process.env.MAX_MESSAGES || 30), 2), 60);
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages.slice(-maxMessages) : [];
    const messages = incoming
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Message invalide." });
    }

    const headers = { "Content-Type": "application/json" };
    if (AI_API_KEY) headers.Authorization = `Bearer ${AI_API_KEY}`;

    const upstream = await fetch(AI_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        stream: false
      }),
      signal: AbortSignal.timeout(90000)
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI provider error:", upstream.status, data);
      return res.status(502).json({ error: "Le moteur IA est momentanément indisponible. Réessaie plus tard." });
    }

    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "Le moteur IA n'a pas renvoyé de réponse." });
    }
    res.json({ reply: reply.trim() });
  } catch (error) {
    console.error(error);
    const timeout = error?.name === "TimeoutError";
    res.status(timeout ? 504 : 500).json({
      error: timeout ? "La réponse prend trop de temps. Réessaie." : "Une erreur est survenue sur le serveur."
    });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`NOVA AI écoute sur http://localhost:${port}`));