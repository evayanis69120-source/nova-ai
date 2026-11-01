import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = id => document.getElementById(id);
const config = await fetch("/api/config").then(r => r.json()).catch(() => ({}));
const authScreen = $("authScreen"), app = $("app"), authForm = $("authForm");
let supabase = null, user = null, chats = [], activeId = null, busy = false, controller = null;
let authMode = "login", selectedFiles = [], recognition = null, recording = false;
const MEDIA_BUCKET = "nova-media";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 4;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4", "video/webm", "video/quicktime"]);

function toast(message) {
  const t = $("toast"); t.textContent = message; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("authTitle").textContent = signup ? "Créer ton espace NOVA" : "Bienvenue sur NOVA";
  $("authSubtitle").textContent = signup ? "Quelques secondes pour créer ton compte personnel." : "Connecte-toi pour retrouver tes discussions sur tes appareils.";
  $("nameLabel").classList.toggle("hidden", !signup);
  $("authSubmit").textContent = signup ? "Créer mon compte" : "Se connecter";
  $("switchText").textContent = signup ? "Tu as déjà un compte ?" : "Pas encore de compte ?";
  $("switchAuth").textContent = signup ? "Se connecter" : "Créer un compte";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("authError").textContent = "";
}
$("switchAuth").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login");

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  $("authError").textContent = "Les comptes ne sont pas encore configurés. Consulte le guide de mise à jour.";
} else {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await supabase.auth.getSession();
  if (data.session) await enterApp(data.session.user);
}

authForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!supabase) return;
  $("authSubmit").disabled = true; $("authError").textContent = "";
  const email = $("email").value.trim(), password = $("password").value;
  try {
    if (authMode === "signup") {
      const displayName = $("displayName").value.trim() || email.split("@")[0];
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
      if (error) throw error;
      if (!data.session) $("authError").textContent = "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.";
      else await enterApp(data.user);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await enterApp(data.user);
    }
  } catch (err) { $("authError").textContent = err.message || "Connexion impossible."; }
  finally { $("authSubmit").disabled = false; }
});

async function enterApp(currentUser) {
  user = currentUser; authScreen.classList.add("hidden"); app.classList.remove("hidden");
  const name = user.user_metadata?.display_name || user.email.split("@")[0];
  $("profileName").textContent = name; $("profileEmail").textContent = user.email;
  $("avatar").textContent = name.charAt(0).toUpperCase(); $("largeAvatar").textContent = name.charAt(0).toUpperCase();
  $("modalName").textContent = name; $("modalEmail").textContent = user.email; $("editName").value = name;
  await loadChats();
}
async function loadChats() {
  const { data, error } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false });
  if (error) { toast("Impossible de charger l'historique : " + error.message); return; }
  chats = data || []; renderHistory();
  if (chats.length) openChat(chats[0].id); else newChat();
}
function renderHistory() {
  $("history").replaceChildren();
  chats.forEach(c => {
    const row = document.createElement("div"); row.className = "history-row";
    const b = document.createElement("button"); b.className = "history-item" + (c.id === activeId ? " selected" : "");
    b.textContent = c.title; b.onclick = () => openChat(c.id);
    const del = document.createElement("button"); del.className = "history-delete"; del.textContent = "×"; del.title = "Supprimer";
    del.onclick = async () => {
      if (!confirm("Supprimer cette discussion ?")) return;
      const mediaPaths = (c.messages || []).flatMap(m => (m.attachments || []).map(a => a.path)).filter(Boolean);
      if (mediaPaths.length) await supabase.storage.from(MEDIA_BUCKET).remove(mediaPaths);
      const { error } = await supabase.from("conversations").delete().eq("id", c.id);
      if (error) return toast(error.message);
      // Les fichiers du bucket restent privés ; ils peuvent être supprimés depuis le stockage Supabase.
      chats = chats.filter(x => x.id !== c.id);
      if (activeId === c.id) newChat(); else renderHistory();
    };
    row.append(b, del); $("history").append(row);
  });
}
function active() { return chats.find(c => c.id === activeId); }
function safeText(value) { return String(value || "").replace(/[<>]/g, ""); }
async function addAttachmentViews(container, attachments = []) {
  if (!attachments.length) return;
  const wrap = document.createElement("div"); wrap.className = "message-attachments";
  for (const file of attachments) {
    const card = document.createElement("div"); card.className = "attached-file";
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(file.path, 3600);
    if (error || !data?.signedUrl) {
      card.textContent = `📎 ${file.name} · aperçu indisponible`;
    } else if (file.type?.startsWith("image/")) {
      const img = document.createElement("img"); img.src = data.signedUrl; img.alt = file.name; img.loading = "lazy"; img.className = "attached-image";
      img.onclick = () => window.open(data.signedUrl, "_blank", "noopener"); card.append(img);
      const label = document.createElement("small"); label.textContent = file.name; card.append(label);
    } else {
      const link = document.createElement("a"); link.href = data.signedUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = `${file.type?.startsWith("video/") ? "🎬" : "📄"} ${file.name}`; card.append(link);
      if (file.type?.startsWith("video/")) {
        const video = document.createElement("video"); video.src = data.signedUrl; video.controls = true; video.preload = "metadata"; card.append(video);
      }
    }
    wrap.append(card);
  }
  container.append(wrap);
}
function addMessage(role, text, withActions = false, attachments = []) {
  const row = document.createElement("div"); row.className = "message " + role;
  if (role === "assistant") { const av = document.createElement("div"); av.className = "avatar"; av.textContent = "✦"; row.append(av); }
  const content = document.createElement("div"); content.className = "message-content";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = text; content.append(bubble);
  if (attachments.length) addAttachmentViews(content, attachments);
  if (withActions) {
    const actions = document.createElement("div"); actions.className = "message-actions";
    const copy = document.createElement("button"); copy.textContent = "Copier"; copy.onclick = async () => { await navigator.clipboard.writeText(text); toast("Réponse copiée"); };
    const speak = document.createElement("button"); speak.textContent = "🔊 Écouter"; speak.onclick = () => speakText(text);
    actions.append(copy, speak); content.append(actions);
  }
  row.append(content); $("messages").append(row); row.scrollIntoView({ behavior: "smooth", block: "end" }); return bubble;
}
function openChat(id) {
  activeId = id; $("messages").replaceChildren(); const c = active();
  $("welcome").hidden = !!c?.messages?.length;
  if (c) (c.messages || []).forEach(m => addMessage(m.role, m.content, m.role === "assistant", m.attachments || []));
  renderHistory(); $("sidebar").classList.remove("open");
}
function newChat() {
  activeId = null; $("messages").replaceChildren(); $("welcome").hidden = false; renderHistory();
  $("prompt").focus(); $("sidebar").classList.remove("open"); clearSelectedFiles();
}
async function persistChat(c) {
  const payload = { user_id: user.id, title: c.title, messages: c.messages, updated_at: new Date().toISOString() };
  let result;
  if (c.id && !String(c.id).startsWith("local-")) result = await supabase.from("conversations").update(payload).eq("id", c.id).select().single();
  else result = await supabase.from("conversations").insert(payload).select().single();
  if (result.error) { toast("Sauvegarde impossible : " + result.error.message); return false; }
  const oldId = c.id; c.id = result.data.id;
  if (oldId !== c.id) activeId = c.id;
  chats = [c, ...chats.filter(x => x.id !== c.id && x.id !== oldId)]; renderHistory(); return true;
}
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`; }
function renderSelectedFiles() {
  const tray = $("fileTray"); tray.replaceChildren();
  selectedFiles.forEach((file, index) => {
    const chip = document.createElement("div"); chip.className = "file-chip";
    const label = document.createElement("span"); label.textContent = `${file.type.startsWith("image/") ? "▧" : file.type.startsWith("video/") ? "▶" : "▤"} ${file.name} · ${formatSize(file.size)}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", "Retirer le fichier"); remove.onclick = () => { selectedFiles.splice(index, 1); renderSelectedFiles(); };
    chip.append(label, remove); tray.append(chip);
  });
  tray.classList.toggle("hidden", selectedFiles.length === 0);
}
function clearSelectedFiles() { selectedFiles = []; $("fileInput").value = ""; renderSelectedFiles(); }
$("fileInput").addEventListener("change", e => {
  const incoming = [...e.target.files];
  for (const file of incoming) {
    if (!allowedTypes.has(file.type)) { toast(`Format non accepté : ${file.name}`); continue; }
    if (file.size > MAX_FILE_SIZE) { toast(`${file.name} dépasse la limite de 20 Mo.`); continue; }
    if (selectedFiles.length >= MAX_FILES) { toast(`Maximum ${MAX_FILES} fichiers par message.`); break; }
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) selectedFiles.push(file);
  }
  renderSelectedFiles(); e.target.value = "";
});
async function uploadSelectedFiles(c) {
  const saved = [];
  for (const file of selectedFiles) {
    const cleanName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
    const path = `${user.id}/${c.id}/${crypto.randomUUID()}-${cleanName}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Impossible d'envoyer ${file.name} : ${error.message}`);
    saved.push({ name: file.name, type: file.type, size: file.size, path });
  }
  return saved;
}

async function resizeImageDataUrl(file, maxSide = 1500) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = source;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
async function extractPdfText(file) {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 35); pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    text += `\n[Page ${pageNo}]\n` + content.items.map(x => x.str || "").join(" ") + "\n";
    if (text.length > 24000) break;
  }
  return text.slice(0, 24000);
}
async function extractVideoFrames(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video"); video.preload = "metadata"; video.muted = true; video.src = url;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    const duration = video.duration || 0;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Vidéo illisible.");
    const times = [...new Set([Math.min(1, duration / 2), duration / 2, Math.max(0, duration - 1)])];
    const frames = [];
    for (const time of times) {
      await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = reject; video.currentTime = time; });
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ time: Math.round(time), data: canvas.toDataURL("image/jpeg", 0.72) });
    }
    return frames;
  } finally { URL.revokeObjectURL(url); }
}
async function prepareMediaForAI(files) {
  const result = { images: [], pdfs: [], videos: [] };
  for (const file of files) {
    if (file.type.startsWith("image/")) result.images.push({ name: file.name, data: await resizeImageDataUrl(file) });
    else if (file.type === "application/pdf") result.pdfs.push({ name: file.name, text: await extractPdfText(file) });
    else if (file.type.startsWith("video/")) result.videos.push({ name: file.name, frames: await extractVideoFrames(file) });
  }
  return result;
}

async function send(text) {
  text = (text || "").trim(); if ((!text && !selectedFiles.length) || busy) return;
  let c = active();
  if (!c) {
    c = { id: "local-" + crypto.randomUUID(), title: (text || selectedFiles[0]?.name || "Fichiers joints").slice(0, 42), messages: [] };
    chats.unshift(c); activeId = c.id;
  }
  $("welcome").hidden = true;
  busy = true; $("sendBtn").classList.add("hidden"); $("stopBtn").classList.remove("hidden");
  let waiting = addMessage("assistant", "Préparation de ton message…");
  try {
    if (c.id.startsWith("local-")) {
      const created = await persistChat(c);
      if (!created) throw new Error("La discussion n'a pas pu être créée.");
    }
    const filesForAnalysis = [...selectedFiles];
    const attachments = selectedFiles.length ? await uploadSelectedFiles(c) : [];
    const mediaForAI = filesForAnalysis.length ? await prepareMediaForAI(filesForAnalysis) : { images: [], pdfs: [], videos: [] };
    const userText = text || (attachments.length ? "Analyse les fichiers que je joins et explique leur contenu." : "");
    c.messages.push({ role: "user", content: userText, attachments });
    waiting.parentElement.parentElement.remove();
    addMessage("user", userText, false, attachments);
    waiting = addMessage("assistant", "NOVA réfléchit…");
    $("prompt").value = ""; $("prompt").style.height = "auto"; clearSelectedFiles();
    await persistChat(c);
    const requestMessages = c.messages.map(m => ({ role: m.role, content: m.content }));
    if (attachments.length) {
      const parts = [{ type: "text", text: userText }];
      for (const pdf of mediaForAI.pdfs) parts.push({ type: "text", text: `\n\nContenu extrait du PDF ${pdf.name} :\n${pdf.text || "[Aucun texte extractible : PDF probablement scanné ou protégé.]"}` });
      for (const image of mediaForAI.images.slice(0, 3)) parts.push({ type: "image_url", image_url: { url: image.data } });
      for (const video of mediaForAI.videos) {
        parts.push({ type: "text", text: `Images extraites de la vidéo ${video.name} (temps en secondes : ${video.frames.map(f => f.time).join(", ")}). Analyse ces images comme des aperçus, pas comme une vidéo complète.` });
        for (const frame of video.frames.slice(0, 3 - parts.filter(p => p.type === "image_url").length)) {
          if (parts.filter(p => p.type === "image_url").length >= 3) break;
          parts.push({ type: "image_url", image_url: { url: frame.data } });
        }
      }
      requestMessages[requestMessages.length - 1] = { role: "user", content: parts };
    }
    controller = new AbortController();
    const { data: sessionData } = await supabase.auth.getSession();
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ messages: requestMessages }), signal: controller.signal
    });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || "Service indisponible.");
    const assistantMessage = { role: "assistant", content: d.reply }; c.messages.push(assistantMessage);
    waiting.textContent = d.reply; await persistChat(c);
    const actionRow = document.createElement("div"); actionRow.className = "message-actions";
    const copy = document.createElement("button"); copy.textContent = "Copier"; copy.onclick = async () => { await navigator.clipboard.writeText(d.reply); toast("Réponse copiée"); };
    const speak = document.createElement("button"); speak.textContent = "🔊 Écouter"; speak.onclick = () => speakText(d.reply);
    actionRow.append(copy, speak); waiting.after(actionRow);
  } catch (err) {
    if (waiting.isConnected) waiting.textContent = err.name === "AbortError" ? "Génération arrêtée." : err.message;
    else toast(err.message);
  } finally {
    busy = false; controller = null; $("sendBtn").classList.remove("hidden"); $("stopBtn").classList.add("hidden"); $("prompt").focus();
  }
}
$("chatForm").addEventListener("submit", e => { e.preventDefault(); send($("prompt").value); });
$("prompt").addEventListener("input", () => { $("prompt").style.height = "auto"; $("prompt").style.height = Math.min($("prompt").scrollHeight, 150) + "px"; });
$("prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("prompt").value); } });
document.querySelectorAll(".suggestion").forEach(b => b.addEventListener("click", () => send(b.dataset.prompt)));
$("attachBtn").onclick = () => $("fileInput").click();
$("newChat").onclick = newChat;
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
$("stopBtn").onclick = () => controller?.abort();
$("profileBtn").onclick = () => $("profileModal").classList.remove("hidden");
$("closeProfile").onclick = () => $("profileModal").classList.add("hidden");
$("saveProfile").onclick = async () => {
  const display_name = $("editName").value.trim().slice(0, 40);
  const { error } = await supabase.auth.updateUser({ data: { display_name } });
  if (error) return toast(error.message);
  user.user_metadata.display_name = display_name;
  $("profileName").textContent = display_name; $("modalName").textContent = display_name;
  $("avatar").textContent = display_name.charAt(0).toUpperCase(); $("largeAvatar").textContent = display_name.charAt(0).toUpperCase();
  toast("Profil mis à jour");
};
$("signOut").onclick = async () => { window.speechSynthesis?.cancel(); await supabase.auth.signOut(); location.reload(); };
$("themeBtn").onclick = () => {
  const light = document.body.classList.toggle("light"); document.body.classList.toggle("dark", !light);
  localStorage.setItem("nova_theme", light ? "light" : "dark"); $("themeBtn").textContent = light ? "☼" : "☾";
};
const savedTheme = localStorage.getItem("nova_theme");
if (savedTheme === "light") { document.body.classList.add("light"); document.body.classList.remove("dark"); }
else { document.body.classList.add("dark"); document.body.classList.remove("light"); }
$("themeBtn").textContent = document.body.classList.contains("light") ? "☼" : "☾";

// Dictée vocale : reconnaissance fournie par le navigateur (Chrome / Edge généralement).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = "fr-FR"; recognition.interimResults = false; recognition.continuous = false;
  recognition.onresult = event => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const prompt = $("prompt"); prompt.value = `${prompt.value}${prompt.value ? " " : ""}${transcript}`;
    prompt.dispatchEvent(new Event("input")); toast("Dictée ajoutée au message");
  };
  recognition.onerror = event => toast(event.error === "not-allowed" ? "Autorise le micro dans ton navigateur." : "La dictée vocale n'a pas fonctionné.");
  recognition.onend = () => { recording = false; $("micBtn").classList.remove("recording"); $("micBtn").setAttribute("aria-label", "Dicter un message"); };
  $("micBtn").onclick = () => {
    if (recording) { recognition.stop(); return; }
    try { recognition.start(); recording = true; $("micBtn").classList.add("recording"); $("micBtn").setAttribute("aria-label", "Arrêter la dictée"); toast("Je t'écoute…"); }
    catch { toast("Le micro est déjà actif. Réessaie dans un instant."); }
  };
} else {
  $("micBtn").onclick = () => toast("La dictée vocale est indisponible dans ce navigateur. Essaie Chrome ou Edge.");
}
function speakText(text) {
  if (!window.speechSynthesis) return toast("La lecture vocale n'est pas disponible dans ce navigateur.");
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "fr-FR"; utterance.rate = 1; utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); newChat(); }
  if (event.key === "Escape") { $("profileModal").classList.add("hidden"); if (recording) recognition?.stop(); }
});
