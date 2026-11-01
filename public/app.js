import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = id => document.getElementById(id);
const config = await fetch("/api/config").then(r => r.json()).catch(() => ({}));
const authScreen = $("authScreen"), app = $("app"), authForm = $("authForm");
let supabase = null, user = null, chats = [], activeId = null, busy = false, controller = null;
let authMode = "login";

function toast(message) {
  const t = $("toast"); t.textContent = message; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
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
      if (!data.session) {
        $("authError").textContent = "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.";
      } else await enterApp(data.user);
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
  $("avatar").textContent = name.charAt(0).toUpperCase();
  $("largeAvatar").textContent = name.charAt(0).toUpperCase();
  $("modalName").textContent = name; $("modalEmail").textContent = user.email;
  $("editName").value = name;
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
      const { error } = await supabase.from("conversations").delete().eq("id", c.id);
      if (error) return toast(error.message);
      chats = chats.filter(x => x.id !== c.id);
      if (activeId === c.id) newChat(); else renderHistory();
    };
    row.append(b, del); $("history").append(row);
  });
}
function active() { return chats.find(c => c.id === activeId); }
function addMessage(role, text, withActions = false) {
  const row = document.createElement("div"); row.className = "message " + role;
  if (role === "assistant") { const av = document.createElement("div"); av.className = "avatar"; av.textContent = "✦"; row.append(av); }
  const content = document.createElement("div"); content.className = "message-content";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = text; content.append(bubble);
  if (withActions) {
    const actions = document.createElement("div"); actions.className = "message-actions";
    const copy = document.createElement("button"); copy.textContent = "Copier"; copy.onclick = async () => { await navigator.clipboard.writeText(text); toast("Réponse copiée"); };
    actions.append(copy); content.append(actions);
  }
  row.append(content); $("messages").append(row); row.scrollIntoView({ behavior: "smooth", block: "end" }); return bubble;
}
function openChat(id) {
  activeId = id; $("messages").replaceChildren(); const c = active();
  $("welcome").hidden = !!c?.messages?.length;
  if (c) (c.messages || []).forEach(m => addMessage(m.role, m.content, m.role === "assistant"));
  renderHistory(); $("sidebar").classList.remove("open");
}
function newChat() {
  activeId = null; $("messages").replaceChildren(); $("welcome").hidden = false; renderHistory();
  $("prompt").focus(); $("sidebar").classList.remove("open");
}
async function persistChat(c) {
  const payload = { user_id: user.id, title: c.title, messages: c.messages, updated_at: new Date().toISOString() };
  let result;
  if (c.id && !String(c.id).startsWith("local-")) result = await supabase.from("conversations").update(payload).eq("id", c.id).select().single();
  else result = await supabase.from("conversations").insert(payload).select().single();
  if (result.error) { toast("Sauvegarde impossible : " + result.error.message); return false; }
  const oldId = c.id; c.id = result.data.id;
  if (oldId !== c.id) activeId = c.id;
  chats = [c, ...chats.filter(x => x.id !== c.id && x.id !== oldId)];
  renderHistory(); return true;
}
async function send(text) {
  text = (text || "").trim(); if (!text || busy) return;
  let c = active();
  if (!c) {
    c = { id: "local-" + crypto.randomUUID(), title: text.slice(0, 42), messages: [] };
    chats.unshift(c); activeId = c.id;
  }
  $("welcome").hidden = true; c.messages.push({ role: "user", content: text }); addMessage("user", text);
  $("prompt").value = ""; $("prompt").style.height = "auto"; renderHistory();
  await persistChat(c);
  busy = true; $("sendBtn").classList.add("hidden"); $("stopBtn").classList.remove("hidden");
  const waiting = addMessage("assistant", "NOVA réfléchit…");
  controller = new AbortController();
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ messages: c.messages }), signal: controller.signal
    });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || "Service indisponible.");
    waiting.textContent = d.reply; c.messages.push({ role: "assistant", content: d.reply });
    await persistChat(c);
    const actionRow = document.createElement("div"); actionRow.className = "message-actions";
    const copy = document.createElement("button"); copy.textContent = "Copier"; copy.onclick = async () => { await navigator.clipboard.writeText(d.reply); toast("Réponse copiée"); };
    actionRow.append(copy); waiting.after(actionRow);
  } catch (err) {
    waiting.textContent = err.name === "AbortError" ? "Génération arrêtée." : err.message;
  } finally {
    busy = false; controller = null; $("sendBtn").classList.remove("hidden"); $("stopBtn").classList.add("hidden"); $("prompt").focus();
  }
}
$("chatForm").addEventListener("submit", e => { e.preventDefault(); send($("prompt").value); });
$("prompt").addEventListener("input", () => { $("prompt").style.height = "auto"; $("prompt").style.height = Math.min($("prompt").scrollHeight, 150) + "px"; });
$("prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("prompt").value); } });
document.querySelectorAll(".suggestion").forEach(b => b.addEventListener("click", () => send(b.dataset.prompt)));
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
$("signOut").onclick = async () => { await supabase.auth.signOut(); location.reload(); };
$("themeBtn").onclick = () => {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("nova_theme", dark ? "dark" : "light");
  $("themeBtn").textContent = dark ? "☾" : "☼";
};
if (localStorage.getItem("nova_theme") === "dark") { document.body.classList.add("dark"); $("themeBtn").textContent = "☾"; }
