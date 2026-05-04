// ============================================
// NEXUS AI — script.js  (ULTRA v3)
// Features: Streaming | Mem0 Memory | Multilang Voice | PDF.js
//           Export Chat | Prompt Modes | Light Theme | Keyboard Shortcuts
//           Canvas/Preview | Pinned Messages | Token Counter | Model Sync Fix
// ============================================

const KEYS = {
  groq:       "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",
  gemini:     "AIzaSyBWavDLChC1c09BU32J6-R5AzPbOfTh0-o",
  together:   "tgp_v1_xiq3WWXQ0YwNLDrNIMfMenQ33_pYYN5E2cx_BxImAKM",
  exa:        "3b7305a9-e0a3-4a64-bda9-8a2ca3451624",
  tavily:     "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",
  elevenlabs: "sk_4ce97b6eb335fd280f141ad6e1af3ffa95d08eb4596bdf1f",
  stability:  "sk-cnyvpqlgO9mMS7XPO0vrpfttimj92MZ6E6ODnphlnOvOI7o8",
  mem0:       "m0-gplBwEGVXOaRrM0QKI8hpOOL23B4wq6sAUyOIPos"
};

// ===== STATE =====
let userName = "";
let userId = "";
let currentChatId = null;
let chats = {};
let pendingFiles = [];
let voiceOutputEnabled = false;
let webSearchEnabled = false;
let imageModeEnabled = false;
let isGenerating = false;
let currentAudio = null;
let recognition = null;
let isRecording = false;
let currentVoiceLang = "en-US";
let currentMode = "default"; // default | code | creative | research
let pinnedMessages = [];
let totalTokensUsed = 0;
let canvasPreviewEnabled = false;

// ===== PROMPT MODES =====
const MODES = {
  default: {
    label: "General",
    icon: "🤖",
    system: `You are NEXUS AI, an advanced intelligent assistant. Be helpful, accurate, and detailed.
FORMATTING RULES:
- Use proper markdown in ALL responses
- For code: use fenced blocks with language tag
- Use **bold** for emphasis, ## for headings
- Never output \\n as literal text — use real line breaks
- Write complete, working code when asked`
  },
  code: {
    label: "Code Expert",
    icon: "💻",
    system: `You are NEXUS AI in Code Expert mode — a senior software engineer.
- Always write complete, production-ready, well-commented code
- Explain your approach before code
- Point out edge cases and potential bugs
- Format: use proper markdown code blocks with language tags
- When fixing bugs, explain what was wrong`
  },
  creative: {
    label: "Creative Writer",
    icon: "✍️",
    system: `You are NEXUS AI in Creative Writer mode — an imaginative storyteller and poet.
- Write with vivid, engaging prose
- Use metaphors, sensory details, and rich language
- For stories: strong opening, character depth, satisfying arc
- For poems: rhythm, imagery, emotional resonance
- Be original, surprising, and memorable`
  },
  research: {
    label: "Research",
    icon: "🔬",
    system: `You are NEXUS AI in Research mode — a meticulous academic researcher.
- Structure answers with clear sections and headings
- Cite reasoning and mention uncertainty where it exists
- Provide multiple perspectives on complex topics
- Use numbered lists, tables, and structured data
- Be thorough, precise, and intellectually honest`
  }
};

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  setupMarked();
  setupKeyboardShortcuts();
  loadPdfJs();

  setTimeout(() => {
    const loader = document.getElementById("loader");
    loader.classList.add("fade-out");
    setTimeout(() => {
      loader.style.display = "none";
      if (userName) showMainApp();
      else document.getElementById("nameScreen").classList.remove("hidden");
    }, 500);
  }, 3200);
});

function loadPdfJs() {
  // Load PDF.js for proper PDF reading
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  script.onload = () => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  };
  document.head.appendChild(script);
}

function setupMarked() {
  if (!window.marked) return;
  const renderer = new marked.Renderer();

  renderer.code = function(code, language) {
    // Handle object arg from newer marked versions
    if (typeof code === "object" && code !== null) {
      language = code.lang || "";
      code = code.text || "";
    }
    const lang = (language || "text").trim();
    const validLang = window.hljs && hljs.getLanguage(lang) ? lang : "plaintext";
    let highlighted = escapeHtml(code);
    try {
      if (window.hljs) highlighted = hljs.highlight(code, { language: validLang, ignoreIllegals: true }).value;
    } catch (e) { highlighted = escapeHtml(code); }

    const extMap = { javascript:"js", python:"py", html:"html", css:"css", java:"java", cpp:"cpp", c:"c", typescript:"ts", json:"json", markdown:"md", bash:"sh", shell:"sh", sql:"sql", php:"php", ruby:"rb", go:"go", rust:"rs" };
    const ext = extMap[lang.toLowerCase()] || "txt";
    let encoded = "";
    try { encoded = btoa(unescape(encodeURIComponent(code))); } catch(e) { encoded = btoa(code); }

    // Canvas preview button for HTML/JS
    const isPreviewable = ["html","javascript","js","css","jsx","tsx","vue"].includes(lang.toLowerCase());
    const previewBtn = isPreviewable
      ? `<button class="code-btn preview-btn" onclick="openCanvasPreview('${encoded}','${escapeHtml(lang)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          Preview
        </button>` : "";

    return `<div class="code-block-wrap">
<div class="code-header">
  <span class="code-lang">${escapeHtml(lang)}</span>
  <div class="code-actions">
    ${previewBtn}
    <button class="code-btn" onclick="copyCodeB64('${encoded}',this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Copy
    </button>
    <button class="code-btn" onclick="downloadCodeB64('${encoded}','${escapeHtml(ext)}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download
    </button>
  </div>
</div>
<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>
</div>`;
  };

  marked.use({ renderer, breaks: true, gfm: true });
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const ns = document.getElementById("nameScreen");
    if (ns && !ns.classList.contains("hidden") && e.key === "Enter") { startChat(); return; }

    // Only when main app is visible
    const app = document.getElementById("mainApp");
    if (!app || app.classList.contains("hidden")) return;

    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case "k": e.preventDefault(); newChat(); showToast("💬 New chat started", "success"); break;
        case "/": e.preventDefault(); openSettings(); break;
        case "e": e.preventDefault(); exportChat(); break;
        case "m": e.preventDefault(); cycleMode(); break;
        case "l": e.preventDefault(); toggleVoiceLang(); break;
      }
    }
    if (e.key === "Escape") {
      closeSettings();
      closeImageModal();
      closeCanvasPreview();
      closePinnedPanel();
    }
  });
}

// ===== STORAGE =====
function loadFromStorage() {
  try {
    userName = localStorage.getItem("nexus_userName") || "";
    userId = localStorage.getItem("nexus_userId") || ("user_" + Date.now());
    localStorage.setItem("nexus_userId", userId);
    chats = JSON.parse(localStorage.getItem("nexus_chats") || "{}");
    pinnedMessages = JSON.parse(localStorage.getItem("nexus_pins") || "[]");
    totalTokensUsed = parseInt(localStorage.getItem("nexus_tokens") || "0");

    const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
    if (s.voiceOutput) voiceOutputEnabled = true;
    if (s.webSearch) webSearchEnabled = true;
    if (s.voiceLang) currentVoiceLang = s.voiceLang;
    if (s.mode) currentMode = s.mode;
    if (s.theme) {
      if (s.theme === "dark") document.body.className = "";
      else document.body.className = "theme-" + s.theme;
    }
    if (s.model) {
      // Defer model select sync until DOM is ready
      setTimeout(() => {
        const sel = getModelSelect();
        if (sel && s.model) sel.value = s.model;
      }, 200);
    }
  } catch (e) { console.warn("Storage load error:", e); }
}
function saveChats() {
  try { localStorage.setItem("nexus_chats", JSON.stringify(chats)); } catch(e) {}
}
function savePins() {
  try { localStorage.setItem("nexus_pins", JSON.stringify(pinnedMessages)); } catch(e) {}
}
function saveTokens() {
  try { localStorage.setItem("nexus_tokens", String(totalTokensUsed)); } catch(e) {}
}

// Safe model select getter
function getModelSelect() {
  return document.getElementById("modelSelect");
}
function getSelectedModel() {
  const sel = getModelSelect();
  if (!sel) return "groq-llama";
  return sel.value || "groq-llama";
}

// ===== NAME SCREEN =====
function startChat() {
  const input = document.getElementById("nameInput");
  const name = (input?.value || "").trim();
  if (!name) {
    if (input) { input.focus(); input.style.borderColor = "var(--danger)"; }
    return;
  }
  if (input) input.style.borderColor = "";
  userName = name;
  localStorage.setItem("nexus_userName", userName);
  document.getElementById("nameScreen").classList.add("hidden");
  showMainApp();
}

function showMainApp() {
  document.getElementById("mainApp").classList.remove("hidden");
  updateUserUI();
  renderHistory();
  updateModeUI();
  updateTokenCounter();
  const ids = Object.keys(chats).sort((a,b) => (chats[b]?.createdAt||0) - (chats[a]?.createdAt||0));
  if (ids.length === 0) newChat();
  else loadChat(ids[0]);
}
function updateUserUI() {
  const initial = userName ? userName[0].toUpperCase() : "U";
  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("userAvatar", initial);
  safeSet("sidebarUserName", userName || "User");
  safeSet("topbarUser", userName || "User");
  safeSet("welcomeName", userName || "there");
}

// ===== SIDEBAR =====
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (!sidebar) return;
  const open = sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("visible", open);
}

// ===== CHAT MANAGEMENT =====
function newChat() {
  const id = "chat_" + Date.now();
  chats[id] = { title: "New Chat", messages: [], createdAt: Date.now() };
  currentChatId = id;
  saveChats();
  renderHistory();
  document.getElementById("messagesContainer").innerHTML = "";
  document.getElementById("welcomeScreen").style.display = "";
  pendingFiles = [];
  updateFilePreview();
  const inp = document.getElementById("messageInput");
  if (inp) { inp.value = ""; inp.style.height = "auto"; inp.focus(); }
  if (imageModeEnabled) toggleImageMode();
}

function loadChat(id) {
  if (!chats[id]) return;
  currentChatId = id;
  renderHistory();
  const msgs = chats[id].messages || [];
  document.getElementById("messagesContainer").innerHTML = "";
  if (msgs.length === 0) {
    document.getElementById("welcomeScreen").style.display = "";
  } else {
    document.getElementById("welcomeScreen").style.display = "none";
    msgs.forEach(m => renderMessage(m.role, m.content, m.imageUrl, false));
  }
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) toggleSidebar();
  }
}

function deleteChat(id, e) {
  e.stopPropagation();
  if (!confirm("Delete this chat?")) return;
  delete chats[id];
  saveChats();
  if (currentChatId === id) {
    const rem = Object.keys(chats).sort((a,b) => (chats[b]?.createdAt||0) - (chats[a]?.createdAt||0));
    if (rem.length === 0) newChat();
    else loadChat(rem[0]);
  }
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const ids = Object.keys(chats).sort((a,b) => (chats[b]?.createdAt||0) - (chats[a]?.createdAt||0));
  if (ids.length === 0) {
    list.innerHTML = '<p class="history-empty">No conversations yet</p>';
    return;
  }
  list.innerHTML = ids.map(id => {
    const chat = chats[id];
    const active = id === currentChatId ? "active" : "";
    const t = (chat.title || "").toLowerCase();
    const icon = t.includes("image") || t.includes("generat") ? "🎨"
               : t.includes("code") || t.includes("html") || t.includes("python") || t.includes("script") ? "💻"
               : t.includes("search") || t.includes("web") ? "🔍"
               : t.includes("write") || t.includes("essay") || t.includes("story") ? "✍️" : "💬";
    const msgCount = (chat.messages || []).length;
    return `<div class="history-item ${active}" onclick="loadChat('${id}')">
      <span class="history-item-icon">${icon}</span>
      <div class="history-item-info">
        <span class="history-item-text">${escapeHtml(chat.title || "New Chat")}</span>
        <span class="history-item-meta">${msgCount} msg${msgCount !== 1 ? "s" : ""}</span>
      </div>
      <button class="history-item-del" onclick="deleteChat('${id}',event)" title="Delete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`;
  }).join("");
}

// ===== TOOL TOGGLES =====
function toggleWebSearch() {
  webSearchEnabled = !webSearchEnabled;
  const btn = document.getElementById("webSearchBtn");
  if (btn) btn.dataset.active = webSearchEnabled;
  showToast(webSearchEnabled ? "🔍 Web Search ON" : "Web Search OFF", webSearchEnabled ? "success" : "");
}
function toggleImageMode() {
  imageModeEnabled = !imageModeEnabled;
  const btn = document.getElementById("imageGenBtn");
  if (btn) btn.dataset.active = imageModeEnabled;
  const inp = document.getElementById("messageInput");
  if (inp) inp.placeholder = imageModeEnabled ? "Describe the image you want to generate..." : "Ask anything… (Shift+Enter for new line)";
  showToast(imageModeEnabled ? "🎨 Image Mode ON" : "Image Mode OFF", imageModeEnabled ? "success" : "");
}
function toggleVoice() {
  voiceOutputEnabled = !voiceOutputEnabled;
  const btn = document.getElementById("voiceToggleBtn");
  if (btn) btn.classList.toggle("active", voiceOutputEnabled);
  showToast(voiceOutputEnabled ? "🔊 Voice Output ON" : "Voice Output OFF", voiceOutputEnabled ? "success" : "");
}
function toggleVoiceLang() {
  currentVoiceLang = currentVoiceLang === "en-US" ? "hi-IN" : currentVoiceLang === "hi-IN" ? "auto" : "en-US";
  const label = currentVoiceLang === "en-US" ? "🇺🇸 English" : currentVoiceLang === "hi-IN" ? "🇮🇳 Hindi" : "🌐 Auto-detect";
  const btn = document.getElementById("voiceLangBtn");
  if (btn) btn.title = `Voice: ${label}`;
  showToast(`Mic: ${label}`, "success");
  // Save
  try {
    const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
    s.voiceLang = currentVoiceLang;
    localStorage.setItem("nexus_settings", JSON.stringify(s));
  } catch(e) {}
}

// ===== PROMPT MODE =====
function cycleMode() {
  const modeKeys = Object.keys(MODES);
  const idx = modeKeys.indexOf(currentMode);
  currentMode = modeKeys[(idx + 1) % modeKeys.length];
  updateModeUI();
  showToast(`${MODES[currentMode].icon} Mode: ${MODES[currentMode].label}`, "success");
  try {
    const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
    s.mode = currentMode;
    localStorage.setItem("nexus_settings", JSON.stringify(s));
  } catch(e) {}
}
function setMode(mode) {
  if (!MODES[mode]) return;
  currentMode = mode;
  updateModeUI();
  closeSettings();
  showToast(`${MODES[currentMode].icon} Mode: ${MODES[currentMode].label}`, "success");
}
function updateModeUI() {
  const btn = document.getElementById("modeBtn");
  if (btn) {
    btn.textContent = MODES[currentMode]?.icon || "🤖";
    btn.title = `Mode: ${MODES[currentMode]?.label || "General"} (Ctrl+M)`;
  }
  // Update settings modal select
  const sel = document.getElementById("settingsMode");
  if (sel) sel.value = currentMode;
}

// ===== TOKEN COUNTER =====
function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}
function addTokens(text) {
  totalTokensUsed += estimateTokens(text);
  saveTokens();
  updateTokenCounter();
}
function updateTokenCounter() {
  const el = document.getElementById("tokenCounter");
  if (!el) return;
  const formatted = totalTokensUsed >= 1000 ? (totalTokensUsed / 1000).toFixed(1) + "k" : totalTokensUsed;
  el.textContent = `~${formatted} tokens`;
  el.title = `Total estimated tokens used this session: ${totalTokensUsed}`;
}

// ===== FILE UPLOAD =====
function handleFileUpload(e) {
  Array.from(e.target.files).forEach(file => {
    if (pendingFiles.length >= 5) { showToast("Max 5 files at a time", "error"); return; }
    pendingFiles.push(file);
  });
  e.target.value = "";
  updateFilePreview();
}
function updateFilePreview() {
  const wrap = document.getElementById("filePreview");
  if (!wrap) return;
  if (pendingFiles.length === 0) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  wrap.innerHTML = pendingFiles.map((f, i) => {
    const isImg = f.type.startsWith("image/");
    const preview = isImg
      ? `<img src="${URL.createObjectURL(f)}" alt="" style="width:22px;height:22px;border-radius:3px;object-fit:cover;">`
      : `<span>${f.type === "application/pdf" ? "📄" : "📎"}</span>`;
    const name = f.name.length > 22 ? f.name.slice(0,20)+"…" : f.name;
    return `<div class="preview-chip">${preview}<span>${escapeHtml(name)}</span><button class="preview-chip-del" onclick="removeFile(${i})">×</button></div>`;
  }).join("");
}
function removeFile(i) { pendingFiles.splice(i, 1); updateFilePreview(); }

// ===== PDF READING with PDF.js =====
async function readPdfFile(file) {
  try {
    if (window.pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = `[PDF: ${file.name} | ${pdf.numPages} pages]\n\n`;
      const maxPages = Math.min(pdf.numPages, 20); // limit to 20 pages
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ");
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      if (pdf.numPages > maxPages) fullText += `[... ${pdf.numPages - maxPages} more pages not shown]`;
      return fullText.slice(0, 12000);
    }
  } catch (e) { console.warn("PDF.js error:", e); }
  // Fallback: try plain text
  try { return await file.text(); } catch(e) {}
  return "[PDF could not be read]";
}

// ===== INPUT =====
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}
function handleInputKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function useSuggestion(text) {
  const inp = document.getElementById("messageInput");
  if (!inp) return;
  inp.value = text;
  autoResize(inp);
  sendMessage();
}

// ===== VOICE INPUT =====
function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast("Voice input not supported in this browser", "error"); return; }
  if (isRecording) { if (recognition) recognition.stop(); return; }
  recognition = new SR();
  // Multi-language support
  if (currentVoiceLang === "auto") {
    recognition.lang = ""; // let browser auto-detect
  } else {
    recognition.lang = currentVoiceLang;
  }
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onstart = () => {
    isRecording = true;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) btn.style.color = "var(--danger)";
    showVoiceIndicator(true);
  };
  recognition.onresult = (e) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const inp = document.getElementById("messageInput");
    if (inp) { inp.value = final || interim; autoResize(inp); }
  };
  recognition.onend = () => {
    isRecording = false;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) btn.style.color = "";
    showVoiceIndicator(false);
  };
  recognition.onerror = (e) => {
    isRecording = false;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) btn.style.color = "";
    showVoiceIndicator(false);
    if (e.error !== "aborted") showToast("Voice error: " + e.error, "error");
  };
  recognition.start();
}
function showVoiceIndicator(show) {
  let el = document.getElementById("voiceIndicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "voiceIndicator";
    el.className = "voice-indicator hidden";
    const langLabel = currentVoiceLang === "hi-IN" ? "Hindi" : currentVoiceLang === "auto" ? "Auto-detect" : "English";
    el.innerHTML = `<div class="voice-wave"><span></span><span></span><span></span><span></span><span></span></div>
      <span>Listening… (${langLabel})</span>
      <button onclick="if(window.recognition)recognition.stop()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:0 4px">Stop</button>`;
    document.body.appendChild(el);
  }
  el.classList.toggle("hidden", !show);
}

// ===== MEM0 MEMORY =====
async function mem0Store(content) {
  try {
    await fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: { "Authorization": `Token ${KEYS.mem0}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content }], user_id: userId, metadata: { app: "nexus_ai" } })
    });
  } catch(e) { console.warn("Mem0 store error:", e); }
}
async function mem0Recall(query) {
  try {
    const res = await fetch(`https://api.mem0.ai/v1/memories/search/?query=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}&limit=5`, {
      headers: { "Authorization": `Token ${KEYS.mem0}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.results?.length) return null;
    return data.results.map(m => m.memory).join("\n");
  } catch(e) { console.warn("Mem0 recall error:", e); return null; }
}
async function mem0StoreConversation(userMsg, aiMsg) {
  // Store important user info and AI response summary
  try {
    const messages = [
      { role: "user", content: userMsg },
      { role: "assistant", content: aiMsg.slice(0, 500) }
    ];
    await fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: { "Authorization": `Token ${KEYS.mem0}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages, user_id: userId })
    });
  } catch(e) {}
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  if (isGenerating) return;
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!text && pendingFiles.length === 0) return;

  if (input) { input.value = ""; input.style.height = "auto"; }
  document.getElementById("welcomeScreen").style.display = "none";
  isGenerating = true;
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;

  const filesSnapshot = [...pendingFiles];
  pendingFiles = [];
  updateFilePreview();

  let fileAttachHtml = "";
  let imageBase64 = null;
  let imageMediaType = null;
  const fileTexts = [];

  for (const file of filesSnapshot) {
    if (file.type.startsWith("image/")) {
      const b64full = await fileToBase64(file);
      imageBase64 = b64full.split(",")[1];
      imageMediaType = file.type;
      fileAttachHtml += `<div class="msg-image-wrap" style="margin-top:8px;"><img src="${b64full}" alt="Uploaded" style="max-height:180px;border-radius:8px;border:1px solid var(--border);display:block;"/></div>`;
    } else if (file.type === "application/pdf") {
      const txt = await readPdfFile(file);
      fileTexts.push({ name: file.name, content: txt });
      fileAttachHtml += `<div class="msg-file-attach"><span class="msg-file-icon">📄</span><span>${escapeHtml(file.name)}</span><span style="font-size:11px;color:var(--text-muted);margin-left:4px;">PDF</span></div>`;
    } else {
      try {
        const txt = await file.text();
        fileTexts.push({ name: file.name, content: txt.slice(0, 8000) });
        fileAttachHtml += `<div class="msg-file-attach"><span class="msg-file-icon">📎</span><span>${escapeHtml(file.name)}</span></div>`;
      } catch {}
    }
  }

  renderMessage("user", text, null, false, fileAttachHtml);
  addTokens(text);

  if (!currentChatId) newChat();
  if (!chats[currentChatId]) chats[currentChatId] = { title: "New Chat", messages: [], createdAt: Date.now() };
  chats[currentChatId].messages.push({ role: "user", content: text });
  if (chats[currentChatId].messages.filter(m => m.role === "user").length === 1 && text) {
    chats[currentChatId].title = text.slice(0, 55) + (text.length > 55 ? "…" : "");
    renderHistory();
  }
  saveChats();

  // Recall memories for context
  let memoryContext = "";
  if (text.length > 5) {
    const recalled = await mem0Recall(text);
    if (recalled) memoryContext = recalled;
  }

  const typingId = showTyping();

  try {
    let aiResponse = "";
    let generatedImageUrl = null;

    // --- IMAGE GENERATION ---
    if (imageModeEnabled) {
      removeTyping(typingId);
      const animCardId = "imgcard_" + Date.now();
      renderImageGeneratingCard(animCardId, text);
      generatedImageUrl = await generateImage(text);
      if (generatedImageUrl) {
        replaceImageCard(animCardId, text, generatedImageUrl);
        aiResponse = `Here's your generated image!\n\nPrompt: *"${text}"*`;
      } else {
        removeImageCard(animCardId);
        const fallbackId = showTyping();
        const desc = await callGroq(
          `Describe in vivid detail what a photorealistic image of "${text}" would look like. Cover colors, composition, lighting. 3-4 sentences.`,
          [], "You are a creative visual description expert.", "groq-llama"
        );
        removeTyping(fallbackId);
        aiResponse = `Image generation failed.\n\nHere's a vivid description instead:\n\n${desc}`;
        renderMessage("assistant", aiResponse, null, true);
      }
    }

    // --- WEB SEARCH ---
    else if (webSearchEnabled) {
      removeTyping(typingId);
      const searchId = showStatusTag("searching", "🔍 Searching the web…");
      const searchResults = await searchWeb(text);
      removeStatusTag(searchId);
      const thinkId = showTyping();
      const promptWithCtx = searchResults
        ? `You have access to these fresh web search results:\n\n${searchResults}\n\nNow answer this thoroughly: ${text}`
        : text;
      aiResponse = await callLLMStream(promptWithCtx, imageBase64, imageMediaType, fileTexts, memoryContext, thinkId);
    }

    // --- FILE ANALYSIS ---
    else if (filesSnapshot.length > 0 && (imageBase64 || fileTexts.length > 0)) {
      removeTyping(typingId);
      const analyzeId = showStatusTag("analyzing", "🔬 Analyzing your file…");
      aiResponse = await callLLMStream(text || "Analyze and describe this.", imageBase64, imageMediaType, fileTexts, memoryContext, null);
      removeStatusTag(analyzeId);
    }

    // --- NORMAL CHAT (with streaming) ---
    else {
      aiResponse = await callLLMStream(text, null, null, [], memoryContext, typingId);
    }

    addTokens(aiResponse);

    chats[currentChatId].messages.push({
      role: "assistant",
      content: aiResponse,
      imageUrl: generatedImageUrl || undefined
    });
    saveChats();

    // Store in Mem0
    if (text && aiResponse) {
      mem0StoreConversation(text, aiResponse);
    }

    if (voiceOutputEnabled && aiResponse) {
      const plain = aiResponse.replace(/[#*`>_~\[\]()\-=+|]/g, "").replace(/\n+/g, " ").trim().slice(0, 600);
      speakText(plain);
    }

  } catch (err) {
    removeTyping(typingId);
    console.error("AI Error:", err);
    renderMessage("assistant", `⚠️ **Error:** ${escapeHtml(err.message || "Something went wrong.")}`, null, true);
  }

  isGenerating = false;
  if (sendBtn) sendBtn.disabled = false;
  scrollToBottom();
}

// ===== STREAMING LLM ROUTER =====
async function callLLMStream(prompt, imageBase64, imageMediaType, fileTexts, memoryContext, typingId) {
  const model = getSelectedModel();
  const history = getCurrentHistory();

  let systemPrompt = MODES[currentMode]?.system || MODES.default.system;
  systemPrompt += `\n\nUser name: ${userName}`;

  if (memoryContext) {
    systemPrompt += `\n\n[MEMORY - Things remembered about this user]:\n${memoryContext}`;
  }
  if (fileTexts.length > 0) {
    systemPrompt += "\n\nAnalyze these uploaded files:\n" +
      fileTexts.map(f => `\n=== ${f.name} ===\n${f.content}`).join("\n");
  }

  // Vision → Gemini (no streaming for vision)
  if (imageBase64) {
    if (typingId) {} // keep typing
    const res = await callGemini(prompt, imageBase64, imageMediaType, history, systemPrompt);
    if (typingId) removeTyping(typingId);
    renderMessage("assistant", res, null, true);
    return res;
  }

  // Gemini models → Gemini (no streaming from browser easily)
  if (model === "gemini-flash" || model === "gemini-pro" || model === "gemini-flash15") {
    const res = await callGemini(prompt, null, null, history, systemPrompt);
    if (typingId) removeTyping(typingId);
    renderMessage("assistant", res, null, true);
    return res;
  }

  // Groq → STREAMING
  return await callGroqStream(prompt, history, systemPrompt, model, typingId);
}

// ===== GROQ STREAMING =====
async function callGroqStream(prompt, history, systemPrompt, modelKey, typingId) {
  const modelMap = {
    "groq-llama":   "llama-3.3-70b-versatile",
    "groq-mixtral": "mixtral-8x7b-32768",
    "groq-llama32": "llama-3.2-90b-vision-preview"
  };
  const modelId = modelMap[modelKey] || "llama-3.3-70b-versatile";

  const messages = [
    { role: "system", content: systemPrompt || "You are NEXUS AI." },
    ...history.slice(-12),
    { role: "user", content: prompt }
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEYS.groq}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096, temperature: 0.7, stream: true })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Groq API: " + (err.error?.message || `HTTP ${res.status}`));
  }

  // Remove typing indicator and create streaming bubble
  if (typingId) removeTyping(typingId);
  const { rowEl, bubbleEl } = createStreamingBubble();

  let fullText = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content || "";
        if (delta) {
          fullText += delta;
          bubbleEl.innerHTML = renderMarkdown(fullText);
          // Re-highlight code
          if (window.hljs) bubbleEl.querySelectorAll("pre code").forEach(el => hljs.highlightElement(el));
          scrollToBottom();
        }
      } catch {}
    }
  }

  // Finalize — add action buttons
  finalizeStreamingBubble(rowEl, bubbleEl, fullText);
  return fullText;
}

function createStreamingBubble() {
  const container = document.getElementById("messagesContainer");
  const aiIcon = `<svg width="14" height="14" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="6" fill="var(--accent)"/><path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const rowEl = document.createElement("div");
  rowEl.className = "message-row streaming-row";
  rowEl.style.animation = "fadeIn 0.3s ease";

  const bubbleEl = document.createElement("div");
  bubbleEl.className = "msg-bubble ai";

  rowEl.innerHTML = `<div class="msg-avatar ai">${aiIcon}</div>`;
  const contentDiv = document.createElement("div");
  contentDiv.className = "msg-content";
  contentDiv.appendChild(bubbleEl);

  const timeEl = document.createElement("span");
  timeEl.className = "msg-time";
  timeEl.textContent = timeStr;
  contentDiv.appendChild(timeEl);

  rowEl.appendChild(contentDiv);
  container.appendChild(rowEl);
  scrollToBottom();
  return { rowEl, bubbleEl };
}

function finalizeStreamingBubble(rowEl, bubbleEl, fullText) {
  // Add streaming cursor removal
  bubbleEl.innerHTML = renderMarkdown(fullText);
  if (window.hljs) bubbleEl.querySelectorAll("pre code").forEach(el => hljs.highlightElement(el));

  // Add action buttons
  const actionsHtml = `<div class="msg-actions">
    <button class="msg-action-btn" onclick="copyMsgContent(this)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Copy
    </button>
    <button class="msg-action-btn" onclick="speakMsgContent(this)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      Speak
    </button>
    <button class="msg-action-btn" onclick="pinMessage(this)">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
      Pin
    </button>
    <button class="msg-action-btn" onclick="regenerateLast()">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
      Retry
    </button>
  </div>`;

  const contentDiv = rowEl.querySelector(".msg-content");
  if (contentDiv) {
    const actionsEl = document.createElement("div");
    actionsEl.innerHTML = actionsHtml;
    contentDiv.insertBefore(actionsEl.firstElementChild, contentDiv.querySelector(".msg-time"));
  }
  rowEl.classList.remove("streaming-row");
  scrollToBottom();
}

// ===== REGULAR GROQ (non-streaming, for internal calls) =====
async function callGroq(prompt, history, systemPrompt, modelKey) {
  const modelMap = { "groq-llama": "llama-3.3-70b-versatile", "groq-mixtral": "mixtral-8x7b-32768" };
  const modelId = modelMap[modelKey] || "llama-3.3-70b-versatile";
  const messages = [
    { role: "system", content: systemPrompt || "You are NEXUS AI." },
    ...history.slice(-12),
    { role: "user", content: prompt }
  ];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEYS.groq}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096, temperature: 0.7 })
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error("Groq: " + (err.error?.message || res.status)); }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ===== GEMINI =====
async function callGemini(prompt, imageBase64, imageMediaType, history, systemPrompt) {
  const sel = getSelectedModel();
  const modelMap = { "gemini-pro": "gemini-1.5-pro", "gemini-flash": "gemini-2.0-flash", "gemini-flash15": "gemini-1.5-flash" };
  const modelName = modelMap[sel] || "gemini-2.0-flash";

  const userParts = [];
  if (imageBase64) userParts.push({ inline_data: { mime_type: imageMediaType || "image/jpeg", data: imageBase64 } });
  userParts.push({ text: prompt });

  const contents = [];
  history.slice(-10).forEach(m => {
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content || "" }] });
  });
  contents.push({ role: "user", parts: userParts });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt || "You are NEXUS AI." }] },
    contents,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${KEYS.gemini}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error("Gemini: " + (err.error?.message || res.status)); }
  const data = await res.json();
  if (!data.candidates?.[0]) {
    const reason = data.promptFeedback?.blockReason || "unknown";
    throw new Error(`Gemini blocked: ${reason}. Try rephrasing.`);
  }
  return data.candidates[0].content.parts[0].text;
}

// ===== WEB SEARCH (Tavily) =====
async function searchWeb(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: KEYS.tavily, query, search_depth: "advanced", max_results: 6, include_answer: true })
    });
    if (!res.ok) return null;
    const data = await res.json();
    let out = "";
    if (data.answer) out += `ANSWER: ${data.answer}\n\n`;
    if (data.results) {
      data.results.slice(0, 5).forEach((r, i) => {
        out += `[${i+1}] ${r.title}\nURL: ${r.url}\n${(r.content || "").slice(0, 400)}\n\n`;
      });
    }
    return out.trim() || null;
  } catch (e) { console.warn("Search error:", e); return null; }
}

// ===== IMAGE GENERATION ANIMATION CARD =====
function renderImageGeneratingCard(cardId, prompt) {
  const container = document.getElementById("messagesContainer");
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const aiIcon = `<svg width="14" height="14" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="6" fill="var(--accent)"/><path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
  const row = document.createElement("div");
  row.id = cardId; row.className = "message-row"; row.style.animation = "fadeIn 0.3s ease";
  row.innerHTML = `
    <div class="msg-avatar ai">${aiIcon}</div>
    <div class="msg-content">
      <div class="msg-bubble ai" style="overflow:hidden;padding:0;">
        <div class="img-gen-card">
          <div class="img-gen-canvas">
            <div class="img-gen-particles" id="particles_${cardId}"></div>
            <div class="img-gen-grid-overlay"></div>
            <div class="img-gen-rings">
              <div class="img-gen-ring r1"></div>
              <div class="img-gen-ring r2"></div>
              <div class="img-gen-ring r3"></div>
            </div>
            <div class="img-gen-center">
              <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="6" fill="var(--accent)"/>
                <path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <div class="img-gen-info">
            <div class="img-gen-title"><span class="img-gen-dot"></span>Creating your image…</div>
            <div class="img-gen-prompt">"${escapeHtml(prompt)}"</div>
            <div class="img-gen-steps">
              <div class="img-gen-step active" id="step1_${cardId}">✦ Interpreting prompt</div>
              <div class="img-gen-step" id="step2_${cardId}">✦ Generating pixels</div>
              <div class="img-gen-step" id="step3_${cardId}">✦ Rendering final image</div>
            </div>
            <div class="img-gen-bar-wrap"><div class="img-gen-bar" id="bar_${cardId}"></div></div>
          </div>
        </div>
      </div>
      <span class="msg-time">${timeStr}</span>
    </div>`;
  container.appendChild(row);
  scrollToBottom();

  const bar = document.getElementById("bar_" + cardId);
  const step2 = document.getElementById("step2_" + cardId);
  const step3 = document.getElementById("step3_" + cardId);
  if (bar) bar.style.width = "15%";
  setTimeout(() => { if (bar) bar.style.width = "45%"; if (step2) step2.classList.add("active"); }, 1800);
  setTimeout(() => { if (bar) bar.style.width = "80%"; if (step3) step3.classList.add("active"); }, 3800);

  const pc = document.getElementById("particles_" + cardId);
  if (pc) {
    for (let i = 0; i < 24; i++) {
      const p = document.createElement("div");
      p.className = "img-gen-particle";
      const colors = ["var(--accent)", "#a78bfa", "#f472b6", "#34d399"];
      p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*4}s;animation-duration:${2+Math.random()*3}s;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;opacity:${0.3+Math.random()*0.7};background:${colors[Math.floor(Math.random()*colors.length)]}`;
      pc.appendChild(p);
    }
  }
}

function replaceImageCard(cardId, prompt, imageUrl) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const aiIcon = `<svg width="14" height="14" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="6" fill="var(--accent)"/><path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
  const imgId = "genimg_" + Date.now();
  const isDataUrl = imageUrl.startsWith("data:");
  card.style.animation = "fadeIn 0.4s ease";
  card.innerHTML = `
    <div class="msg-avatar ai">${aiIcon}</div>
    <div class="msg-content">
      <div class="msg-bubble ai">
        <p style="margin:0 0 8px;font-weight:600;">✨ Here's your generated image!</p>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Prompt: <em style="color:var(--accent)">"${escapeHtml(prompt)}"</em></p>
        <div class="msg-image-wrap">
          ${!isDataUrl ? `<div id="loadtxt_${imgId}" style="color:var(--text-muted);font-size:13px;padding:6px 0;">⏳ Loading image…</div>` : ""}
          <img id="${imgId}" src="${imageUrl}" alt="Generated image"
            style="max-width:100%;max-height:460px;border-radius:12px;border:1px solid var(--border);cursor:pointer;display:${isDataUrl?"block":"none"};transition:opacity 0.5s ease;opacity:0;"
            onclick="openImageModal(this.src)"
            onload="this.style.display='block';this.style.opacity='1';const l=document.getElementById('loadtxt_${imgId}');if(l)l.remove();"
            onerror="this.style.display='none';const l=document.getElementById('loadtxt_${imgId}');if(l)l.innerHTML='<span style=color:var(--danger)>❌ Failed. <a href=\\'${imageUrl}\\' target=\\'_blank\\' style=color:var(--accent)>Open directly ↗</a></span>';" />
          <div class="image-actions" style="margin-top:10px;">
            <button class="image-action-btn" onclick="downloadImageFromSrc(document.getElementById('${imgId}').src,'nexus-image.png')">⬇ Download</button>
            <button class="image-action-btn" onclick="openImageModal(document.getElementById('${imgId}').src)">⛶ Full View</button>
            <button class="image-action-btn" onclick="window.open('${imageUrl}','_blank')">↗ Open</button>
          </div>
        </div>
      </div>
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="regenerateLast()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
          Regenerate
        </button>
      </div>
      <span class="msg-time">${timeStr}</span>
    </div>`;
  scrollToBottom();
}
function removeImageCard(cardId) { const el = document.getElementById(cardId); if (el) el.remove(); }

// ===== SMART IMAGE PROMPT BUILDER =====
function buildImagePrompt(userPrompt) {
  const colorWords = ["red","orange","yellow","green","blue","purple","pink","brown","black","white","gray","golden","silver","cyan","neon","glowing"];
  const tokens = userPrompt.toLowerCase().split(/\s+/);
  const pairs = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (colorWords.includes(tokens[i])) {
      const sub = tokens[i+1].replace(/[^a-z]/g,"");
      if (sub.length > 1) pairs.push({ color: tokens[i], subject: sub });
    }
  }
  let bindings = pairs.length ? ` IMPORTANT: ${pairs.map(p=>`the ${p.subject} MUST be ${p.color}`).join(", ")}.` : "";
  return `${userPrompt}.${bindings} Highly detailed, photorealistic, 4k, masterpiece, professional photography, sharp focus, vibrant colors, perfect lighting.`;
}

// ===== IMAGE GENERATION (5 fallbacks) =====
async function generateImage(prompt) {
  const enhancedPrompt = buildImagePrompt(prompt);

  // METHOD 1: Stability AI
  try {
    const res = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEYS.stability}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ text_prompts: [{ text: enhancedPrompt, weight: 1 }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1 })
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data?.artifacts?.[0]?.base64;
      if (b64) return "data:image/png;base64," + b64;
    }
  } catch(e) { console.warn("Stability error:", e); }

  // METHOD 2: Together AI (FLUX)
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEYS.together}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell-Free", prompt: enhancedPrompt, width: 1024, height: 1024, steps: 4, n: 1, response_format: "b64_json" })
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return "data:image/png;base64," + b64;
      const url = data?.data?.[0]?.url;
      if (url) return url;
    }
  } catch(e) { console.warn("Together AI error:", e); }

  // METHOD 3: Gemini image generation
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${KEYS.gemini}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `Generate a high quality image of: ${enhancedPrompt}` }] }], generationConfig: { responseModalities: ["IMAGE","TEXT"] } }) }
    );
    if (res.ok) {
      const data = await res.json();
      for (const part of (data.candidates?.[0]?.content?.parts || [])) {
        if (part.inlineData?.data) return `data:${part.inlineData.mimeType||"image/png"};base64,` + part.inlineData.data;
      }
    }
  } catch(e) { console.warn("Gemini image error:", e); }

  // METHOD 4: Pollinations (no key)
  try {
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
  } catch(e) {}

  return null;
}

// ===== VOICE OUTPUT (ElevenLabs) =====
async function speakText(text) {
  if (!text?.trim()) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL", {
      method: "POST",
      headers: { "xi-api-key": KEYS.elevenlabs, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 800), model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    if (!res.ok) return;
    const blob = await res.blob();
    currentAudio = new Audio(URL.createObjectURL(blob));
    currentAudio.play();
  } catch(e) { console.warn("ElevenLabs error:", e); }
}

// ===== RENDER MESSAGE =====
function renderMessage(role, content, imageUrl, animate, extraHtml) {
  const container = document.getElementById("messagesContainer");
  const isAI = role === "assistant";
  const initial = isAI ? "N" : (userName ? userName[0].toUpperCase() : "U");
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let contentHtml = "";
  if (isAI) {
    contentHtml = renderMarkdown(content);
  } else if (content) {
    contentHtml = content.split("\n")
      .map(l => `<p style="margin:0 0 2px;">${escapeHtml(l) || "&nbsp;"}</p>`)
      .join("");
  }

  let imageHtml = "";
  if (imageUrl) {
    const isDataUrl = imageUrl.startsWith("data:");
    const imgId = "img_" + Date.now();
    const loaderId = "imgload_" + Date.now();
    imageHtml = `<div class="msg-image-wrap" style="margin-top:10px;">
      <div id="${loaderId}" style="color:var(--text-muted);font-size:13px;padding:8px 0;">${isDataUrl ? "" : "⏳ Loading…"}</div>
      <img id="${imgId}" src="${imageUrl}" alt="Generated" crossorigin="anonymous"
        style="max-width:100%;max-height:420px;border-radius:10px;border:1px solid var(--border);cursor:pointer;display:${isDataUrl?"block":"none"};"
        onclick="openImageModal(this.src)" loading="lazy"
        onload="this.style.display='block';const l=document.getElementById('${loaderId}');if(l)l.remove();"
        onerror="this.style.display='none';const l=document.getElementById('${loaderId}');if(l)l.textContent='❌ Failed to load';" />
      <div class="image-actions">
        <button class="image-action-btn" onclick="downloadImageFromSrc(document.getElementById('${imgId}').src,'nexus-image.png')">⬇ Download</button>
        <button class="image-action-btn" onclick="openImageModal(document.getElementById('${imgId}').src)">⛶ Full View</button>
      </div>
    </div>`;
  }

  const actionsHtml = isAI ? `
    <div class="msg-actions">
      <button class="msg-action-btn" onclick="copyMsgContent(this)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
      <button class="msg-action-btn" onclick="speakMsgContent(this)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        Speak
      </button>
      <button class="msg-action-btn" onclick="pinMessage(this)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
        Pin
      </button>
      <button class="msg-action-btn" onclick="regenerateLast()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
        Retry
      </button>
    </div>` : "";

  const aiIcon = `<svg width="14" height="14" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="6" fill="var(--accent)"/><path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
  const row = document.createElement("div");
  row.className = `message-row${isAI ? "" : " user"}`;
  if (animate) row.style.animation = "fadeIn 0.3s ease";
  row.innerHTML = `
    <div class="msg-avatar ${isAI ? "ai" : "user-av"}">${isAI ? aiIcon : initial}</div>
    <div class="msg-content">
      <div class="msg-bubble ${isAI ? "ai" : "user"}">
        ${contentHtml}${imageHtml}${extraHtml || ""}
      </div>
      ${actionsHtml}
      <span class="msg-time">${timeStr}</span>
    </div>`;
  container.appendChild(row);
  scrollToBottom();
}

// ===== PINNED MESSAGES =====
function pinMessage(btn) {
  const bubble = btn.closest(".msg-content")?.querySelector(".msg-bubble");
  if (!bubble) return;
  const text = (bubble.innerText || bubble.textContent || "").slice(0, 500);
  const pin = { id: Date.now(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), chatId: currentChatId };
  pinnedMessages.unshift(pin);
  if (pinnedMessages.length > 20) pinnedMessages.pop();
  savePins();
  showToast("📌 Message pinned!", "success");
  // Animate button
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> Pinned`;
  btn.style.color = "var(--accent)";
  setTimeout(() => {
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> Pin`;
    btn.style.color = "";
  }, 2000);
}

function openPinnedPanel() {
  let panel = document.getElementById("pinnedPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "pinnedPanel";
    panel.className = "modal-overlay";
    document.body.appendChild(panel);
  }
  panel.classList.remove("hidden");
  const pins = pinnedMessages;
  panel.innerHTML = `<div class="modal-box" style="max-width:520px;max-height:80vh;overflow-y:auto;">
    <div class="modal-header">
      <h3>📌 Pinned Messages (${pins.length})</h3>
      <button onclick="closePinnedPanel()" class="modal-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="gap:10px;display:flex;flex-direction:column;">
      ${pins.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px;">No pinned messages yet.<br>Click "Pin" on any AI response!</p>' :
        pins.map((p, i) => `<div class="pinned-item">
          <div class="pinned-item-text">${escapeHtml(p.text)}${p.text.length >= 500 ? "…" : ""}</div>
          <div class="pinned-item-meta">
            <span>${p.time}</span>
            <button class="msg-action-btn" onclick="unpinMessage(${i})" style="margin-left:auto;">Remove</button>
          </div>
        </div>`).join("")
      }
    </div>
  </div>`;
  panel.onclick = (e) => { if (e.target === panel) closePinnedPanel(); };
}
function closePinnedPanel() {
  const p = document.getElementById("pinnedPanel");
  if (p) p.classList.add("hidden");
}
function unpinMessage(i) {
  pinnedMessages.splice(i, 1);
  savePins();
  openPinnedPanel(); // re-render
  showToast("Unpinned", "");
}

// ===== CANVAS PREVIEW =====
function openCanvasPreview(encoded, lang) {
  try {
    const code = decodeURIComponent(escape(atob(encoded)));
    let panel = document.getElementById("canvasPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "canvasPanel";
      panel.className = "canvas-panel hidden";
      document.body.appendChild(panel);
    }
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="canvas-panel-header">
        <span class="canvas-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
          Live Preview — ${escapeHtml(lang)}
        </span>
        <div style="display:flex;gap:8px;">
          <button class="code-btn" onclick="refreshCanvasPreview('${encoded}','${escapeHtml(lang)}')">↻ Refresh</button>
          <button class="code-btn" onclick="closeCanvasPreview()">✕ Close</button>
        </div>
      </div>
      <iframe id="canvasIframe" class="canvas-iframe" sandbox="allow-scripts allow-same-origin" title="Code Preview"></iframe>`;

    const iframe = document.getElementById("canvasIframe");
    if (lang === "html" || lang === "jsx" || lang === "vue") {
      iframe.srcdoc = code;
    } else if (lang === "javascript" || lang === "js") {
      iframe.srcdoc = `<!DOCTYPE html><html><head><style>body{background:#1a1a2e;color:#e8e8f0;font-family:sans-serif;padding:16px;}</style></head><body><pre id="output"></pre><script>
        const _log = console.log; const _err = console.error;
        console.log = (...a) => { document.getElementById('output').textContent += a.join(' ') + '\\n'; };
        console.error = (...a) => { document.getElementById('output').textContent += 'ERROR: ' + a.join(' ') + '\\n'; };
        try { ${code} } catch(e) { document.getElementById('output').textContent += 'Error: ' + e.message; }
      <\/script></body></html>`;
    } else {
      iframe.srcdoc = `<!DOCTYPE html><html><head><style>body{background:#1a1a2e;color:#e8e8f0;padding:16px;font-family:monospace;white-space:pre-wrap;}</style></head><body>${escapeHtml(code)}</body></html>`;
    }
  } catch(e) { showToast("Preview error: " + e.message, "error"); }
}
function refreshCanvasPreview(encoded, lang) { openCanvasPreview(encoded, lang); }
function closeCanvasPreview() {
  const p = document.getElementById("canvasPanel");
  if (p) p.classList.add("hidden");
}

// ===== EXPORT CHAT =====
function exportChat() {
  if (!currentChatId || !chats[currentChatId]) { showToast("No chat to export", "error"); return; }
  const chat = chats[currentChatId];

  // Show export options
  let panel = document.getElementById("exportPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "exportPanel";
    panel.className = "modal-overlay hidden";
    panel.innerHTML = `<div class="modal-box" style="max-width:360px;">
      <div class="modal-header">
        <h3>Export Chat</h3>
        <button onclick="closeExportPanel()" class="modal-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="gap:10px;display:flex;flex-direction:column;">
        <button class="modal-save-btn" onclick="exportAsMarkdown()">📄 Export as Markdown (.md)</button>
        <button class="modal-save-btn" style="background:var(--accent2);" onclick="exportAsText()">📃 Export as Text (.txt)</button>
        <button class="modal-save-btn" style="background:linear-gradient(135deg,#f472b6,#a78bfa);" onclick="exportAsHtml()">🌐 Export as HTML</button>
      </div>
    </div>`;
    panel.onclick = (e) => { if (e.target === panel) closeExportPanel(); };
    document.body.appendChild(panel);
  }
  panel.classList.remove("hidden");
}
function closeExportPanel() { const p = document.getElementById("exportPanel"); if (p) p.classList.add("hidden"); }

function exportAsMarkdown() {
  const chat = chats[currentChatId];
  let md = `# ${chat.title || "Chat"}\n\n*Exported from NEXUS AI — ${new Date().toLocaleString()}*\n\n---\n\n`;
  (chat.messages || []).forEach(m => {
    const role = m.role === "assistant" ? "🤖 NEXUS AI" : `👤 ${userName || "You"}`;
    md += `### ${role}\n\n${m.content || ""}\n\n---\n\n`;
  });
  downloadText(md, `nexus-chat-${Date.now()}.md`, "text/markdown");
  closeExportPanel();
  showToast("✓ Exported as Markdown!", "success");
}
function exportAsText() {
  const chat = chats[currentChatId];
  let txt = `${chat.title || "Chat"}\nExported: ${new Date().toLocaleString()}\n${"=".repeat(50)}\n\n`;
  (chat.messages || []).forEach(m => {
    const role = m.role === "assistant" ? "NEXUS AI" : (userName || "You");
    txt += `[${role}]\n${m.content || ""}\n\n`;
  });
  downloadText(txt, `nexus-chat-${Date.now()}.txt`, "text/plain");
  closeExportPanel();
  showToast("✓ Exported as Text!", "success");
}
function exportAsHtml() {
  const chat = chats[currentChatId];
  let msgs = (chat.messages || []).map(m => {
    const isAI = m.role === "assistant";
    const label = isAI ? "NEXUS AI" : (userName || "You");
    const bg = isAI ? "#1a1a26" : "#0a1a2e";
    const border = isAI ? "#333" : "#00f5ff33";
    const contentRaw = (m.content || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
    return `<div style="margin:12px 0;padding:14px;background:${bg};border:1px solid ${border};border-radius:12px;">
      <strong style="color:${isAI?"#00f5ff":"#a78bfa"};">${label}</strong>
      <div style="margin-top:8px;line-height:1.6;">${contentRaw}</div>
    </div>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(chat.title||"Chat")}</title>
    <style>body{background:#0a0a0f;color:#e8e8f0;font-family:'DM Sans',sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;}</style>
  </head><body><h1 style="color:#00f5ff;">${escapeHtml(chat.title||"Chat")}</h1>
    <p style="color:#555570;">Exported from NEXUS AI • ${new Date().toLocaleString()}</p><hr style="border-color:#333;margin:20px 0;">${msgs}</body></html>`;
  downloadText(html, `nexus-chat-${Date.now()}.html`, "text/html");
  closeExportPanel();
  showToast("✓ Exported as HTML!", "success");
}
function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ===== COPY/SPEAK MSG =====
function copyMsgContent(btn) {
  const bubble = btn.closest(".msg-content")?.querySelector(".msg-bubble");
  const text = bubble ? (bubble.innerText || bubble.textContent) : "";
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.textContent = "✓ Copied!"; btn.classList.add("copied");
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
  });
}
function speakMsgContent(btn) {
  const bubble = btn.closest(".msg-content")?.querySelector(".msg-bubble");
  const text = bubble ? (bubble.innerText || "").slice(0, 800) : "";
  speakText(text);
}

// ===== MARKDOWN RENDER =====
function renderMarkdown(text) {
  if (!text) return "";
  try {
    const cleaned = text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    if (window.marked) return marked.parse(cleaned);
    return cleaned.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
  } catch(e) { return `<p>${escapeHtml(text)}</p>`; }
}

// ===== TYPING INDICATOR =====
function showTyping() {
  const id = "typing_" + Date.now();
  const el = document.createElement("div");
  el.id = id; el.className = "message-row";
  const aiIcon = `<svg width="14" height="14" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="6" fill="var(--accent)"/><path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
  el.innerHTML = `<div class="msg-avatar ai">${aiIcon}</div>
    <div class="msg-content"><div class="msg-bubble ai">
      <div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
    </div></div>`;
  document.getElementById("messagesContainer").appendChild(el);
  scrollToBottom();
  return id;
}
function removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

function showStatusTag(type, label) {
  const id = "status_" + Date.now();
  const el = document.createElement("div");
  el.id = id; el.style.cssText = "padding:4px 0 4px 46px;";
  el.innerHTML = `<span class="status-tag ${type}">${label}</span>`;
  document.getElementById("messagesContainer").appendChild(el);
  scrollToBottom(); return id;
}
function removeStatusTag(id) { const el = document.getElementById(id); if (el) el.remove(); }

// ===== CODE COPY/DOWNLOAD =====
function copyCodeB64(encoded, btn) {
  try {
    const code = decodeURIComponent(escape(atob(encoded)));
    navigator.clipboard.writeText(code).then(() => {
      const orig = btn.innerHTML;
      btn.textContent = "✓ Copied!"; btn.classList.add("copied");
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
    });
  } catch(e) { showToast("Copy failed", "error"); }
}
function downloadCodeB64(encoded, ext) {
  try {
    const code = decodeURIComponent(escape(atob(encoded)));
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `nexus-code.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("✓ File downloaded!", "success");
  } catch(e) { showToast("Download failed", "error"); }
}

// ===== IMAGE MODAL & DOWNLOAD =====
async function downloadImageFromSrc(src, filename) {
  try {
    if (src.startsWith("data:")) {
      const a = document.createElement("a"); a.href = src; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      const res = await fetch(src);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    showToast("✓ Image downloaded!", "success");
  } catch { showToast("Download failed. Try right-clicking.", "error"); }
}
function openImageModal(src) {
  document.getElementById("imageModalSrc").src = src;
  document.getElementById("imageModal").classList.remove("hidden");
}
function closeImageModal() { document.getElementById("imageModal")?.classList.add("hidden"); }
function downloadModalImage() {
  downloadImageFromSrc(document.getElementById("imageModalSrc").src, "nexus-ai-image.png");
}

// ===== SETTINGS =====
function openSettings() {
  const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
  const nm = document.getElementById("settingsName"); if (nm) nm.value = userName || "";
  const sm = document.getElementById("settingsModel"); if (sm) sm.value = s.model || getSelectedModel();
  const sv = document.getElementById("settingsVoice"); if (sv) sv.checked = !!s.voiceOutput;
  const ss = document.getElementById("settingsSearch"); if (ss) ss.checked = !!s.webSearch;
  const st = document.getElementById("settingsTheme"); if (st) st.value = s.theme || "dark";
  const smode = document.getElementById("settingsMode"); if (smode) smode.value = currentMode;
  const slang = document.getElementById("settingsVoiceLang"); if (slang) slang.value = currentVoiceLang;
  document.getElementById("settingsModal")?.classList.remove("hidden");
}
function closeSettings(e) {
  if (!e || e.target === document.getElementById("settingsModal")) {
    document.getElementById("settingsModal")?.classList.add("hidden");
  }
}
function saveSettings() {
  const name = document.getElementById("settingsName")?.value.trim();
  if (name) { userName = name; localStorage.setItem("nexus_userName", userName); updateUserUI(); }
  const s = {
    model: document.getElementById("settingsModel")?.value || getSelectedModel(),
    voiceOutput: document.getElementById("settingsVoice")?.checked || false,
    webSearch: document.getElementById("settingsSearch")?.checked || false,
    theme: document.getElementById("settingsTheme")?.value || "dark",
    mode: document.getElementById("settingsMode")?.value || "default",
    voiceLang: document.getElementById("settingsVoiceLang")?.value || "en-US"
  };
  localStorage.setItem("nexus_settings", JSON.stringify(s));
  const sel = getModelSelect(); if (sel) sel.value = s.model;
  voiceOutputEnabled = s.voiceOutput;
  webSearchEnabled = s.webSearch;
  currentMode = s.mode;
  currentVoiceLang = s.voiceLang;
  changeTheme(s.theme);
  updateModeUI();
  document.getElementById("settingsModal")?.classList.add("hidden");
  showToast("✓ Settings saved!", "success");
}
function changeTheme(t) {
  document.body.className = (!t || t === "dark") ? "" : `theme-${t}`;
}
function clearAllHistory() {
  if (!confirm("Delete ALL chat history? This cannot be undone.")) return;
  chats = {}; saveChats();
  document.getElementById("settingsModal")?.classList.add("hidden");
  newChat(); showToast("History cleared", "success");
}

// ===== REGENERATE =====
async function regenerateLast() {
  if (!currentChatId || isGenerating) return;
  const msgs = chats[currentChatId]?.messages || [];
  const lastUser = [...msgs].reverse().find(m => m.role === "user");
  if (!lastUser) return;
  const rows = document.querySelectorAll("#messagesContainer .message-row");
  if (rows.length > 0) rows[rows.length-1].remove();
  const aiIdx = msgs.map(m=>m.role).lastIndexOf("assistant");
  if (aiIdx !== -1) chats[currentChatId].messages.splice(aiIdx, 1);
  saveChats();
  const inp = document.getElementById("messageInput");
  if (inp) inp.value = lastUser.content;
  sendMessage();
}

// ===== HELPERS =====
function getCurrentHistory() {
  if (!currentChatId || !chats[currentChatId]) return [];
  return (chats[currentChatId].messages || [])
    .filter(m => m.content)
    .map(m => ({ role: m.role, content: m.content }));
}
function scrollToBottom() {
  const area = document.getElementById("chatArea");
  if (area) setTimeout(() => area.scrollTo({ top: area.scrollHeight, behavior: "smooth" }), 60);
}
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function showToast(msg, type) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const el = document.createElement("div");
  el.className = `toast ${type || ""}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2800);
}
