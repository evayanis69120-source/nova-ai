import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "24mb" }));
app.use(express.static(path.join(root, "public")));

const {
  AI_API_URL,
  AI_API_KEY,
  AI_MODEL,
  AI_VISION_MODEL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} = process.env;

const systemPrompt = `Tu es NOVA, un assistant IA indépendant, utile, patient et honnête.
Réponds dans la langue de l'utilisateur. Explique clairement, structure les réponses
et signale tes incertitudes. Tu peux analyser les images transmises, ainsi que le texte
extrait des PDF. Pour les vidéos, tu reçois quelques images extraites : décris uniquement
ce que ces images permettent d'observer et précise que tu ne disposes pas de toute la vidéo
ni de sa piste audio. Ne prétends jamais avoir lu ou vu un contenu qui ne t'a pas été transmis.`;

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || "",
    supabaseAnonKey: SUPABASE_ANON_KEY || "",
    aiConfigured: Boolean(AI_API_URL && AI_MODEL)
  });
});

async function requireUser(req, res, next) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: "La connexion aux comptes n'est pas encore configurée." });
    }
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Connecte-toi pour utiliser NOVA AI." });

    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return res.status(401).json({ error: "Ta session a expiré. Reconnecte-toi." });
    req.user = await response.json();
    next();
  } catch (error) {
    console.error("Auth verification error:", error.message);
    res.status(503).json({ error: "Impossible de vérifier la connexion pour le moment." });
  }
}

app.get("/api/status", (_req, res) => {
  res.json({
    aiConfigured: Boolean(AI_API_URL && AI_MODEL),
    accountsConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
  });
});

app.post("/api/chat", requireUser, async (req, res) => {
  try {
    if (!AI_API_URL || !AI_MODEL) {
      return res.status(503).json({ error: "Le moteur IA n'est pas configuré." });
    }
    const maxMessages = Math.min(Math.max(Number(process.env.MAX_MESSAGES || 30), 2), 60);
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages.slice(-maxMessages) : [];
    const messages = incoming
      .filter(m => m && ["user", "assistant"].includes(m.role) &&
        (typeof m.content === "string" || (Array.isArray(m.content) && m.role === "user")))
      .map(m => {
        if (typeof m.content === "string") return { role: m.role, content: m.content.slice(0, 12000) };
        const parts = m.content.slice(0, 8).filter(p =>
          p && ((p.type === "text" && typeof p.text === "string") ||
          (p.type === "image_url" && typeof p.image_url?.url === "string" &&
           p.image_url.url.startsWith("data:image/") && p.image_url.url.length < 7_000_000))
        );
        return { role: m.role, content: parts };
      });

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Message invalide." });
    }

    const headers = { "Content-Type": "application/json" };
    if (AI_API_KEY) headers.Authorization = `Bearer ${AI_API_KEY}`;

    const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === "image_url"));
    const selectedModel = hasImages ? (AI_VISION_MODEL || AI_MODEL) : AI_MODEL;
    const upstream = await fetch(AI_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: selectedModel,
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
    console.error("Chat error:", error.message);
    const timeout = error?.name === "TimeoutError";
    res.status(timeout ? 504 : 500).json({
      error: timeout ? "La réponse prend trop de temps. Réessaie." : "Une erreur est survenue sur le serveur."
    });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`NOVA AI écoute sur le port ${port}`));
