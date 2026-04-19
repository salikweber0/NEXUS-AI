// ============================================
// NEXUS AI — script.js  (FIXED v2)
// ============================================

const KEYS = {
  groq:       "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",
  gemini:     "AIzaSyABiBtPD1lCeNioY1TlKNIF0bJ7ILtGAds",
  together:   "tgp_v1_Hxmgazk0IgKGUXiYqBDkmOjm0gN-93kUQJDynl3B93E",
  exa:        "f4933915-e904-42e9-9362-51f238f87214",
  tavily:     "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",
  elevenlabs: "sk_bfd64e9a4b6e45adfa507c6cfb35488a318935753028320a",
  stability:  "sk-zEvxPp4ldaAIT28TvEwPDD3FQ8ThEA5wBO3g8QqKDR2ltgBQ",
  mem0:       "m0-x1vcd5sc1XAaCf3ElmNzzhFCKZkCTxX4EoueHJc0"
};

// ===== STATE =====
let userName = "";
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

// ===== INIT =====
window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();

  // Setup marked.js with custom renderer (FIX: proper code blocks)
  if (window.marked) {
    const renderer = new marked.Renderer();

    renderer.code = function(code, language) {
      const lang = (language || "text").trim();
      const validLang = window.hljs && hljs.getLanguage(lang) ? lang : "plaintext";
      let highlighted = escapeHtml(code);
      try {
        if (window.hljs) {
          highlighted = hljs.highlight(code, { language: validLang, ignoreIllegals: true }).value;
        }
      } catch (e) { highlighted = escapeHtml(code); }

      const extMap = {
        javascript:"js", python:"py", html:"html", css:"css", java:"java",
        cpp:"cpp", c:"c", typescript:"ts", json:"json", markdown:"md",
        bash:"sh", shell:"sh", sql:"sql", php:"php", ruby:"rb", go:"go", rust:"rs"
      };
      const ext = extMap[lang.toLowerCase()] || "txt";
      // Use btoa to safely encode code for passing to onclick
      let encoded = "";
      try { encoded = btoa(unescape(encodeURIComponent(code))); } catch(e) { encoded = btoa(code); }

      return `<div class="code-block-wrap">
<div class="code-header">
  <span class="code-lang">${escapeHtml(lang)}</span>
  <div class="code-actions">
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

  // Loader -> Name/App
  setTimeout(() => {
    const loader = document.getElementById("loader");
    loader.classList.add("fade-out");
    setTimeout(() => {
      loader.style.display = "none";
      if (userName) showMainApp();
      else document.getElementById("nameScreen").classList.remove("hidden");
    }, 500);
  }, 3000);
});

// ===== STORAGE =====
function loadFromStorage() {
  try {
    userName = localStorage.getItem("nexus_userName") || "";
    chats = JSON.parse(localStorage.getItem("nexus_chats") || "{}");
    const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
    if (s.voiceOutput) voiceOutputEnabled = true;
    if (s.webSearch) webSearchEnabled = true;
    if (s.theme && s.theme !== "dark") document.body.className = "theme-" + s.theme;
    if (s.model) setTimeout(() => {
      const sel = document.getElementById("modelSelect");
      if (sel) sel.value = s.model;
    }, 100);
  } catch (e) { console.warn("Storage load error:", e); }
}
function saveChats() {
  try { localStorage.setItem("nexus_chats", JSON.stringify(chats)); } catch(e) {}
}

// ===== NAME SCREEN =====
function startChat() {
  const input = document.getElementById("nameInput");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    input.style.borderColor = "var(--danger)";
    return;
  }
  input.style.borderColor = "";
  userName = name;
  localStorage.setItem("nexus_userName", userName);
  document.getElementById("nameScreen").classList.add("hidden");
  showMainApp();
}
document.addEventListener("keydown", (e) => {
  const ns = document.getElementById("nameScreen");
  if (ns && !ns.classList.contains("hidden") && e.key === "Enter") startChat();
});

function showMainApp() {
  document.getElementById("mainApp").classList.remove("hidden");
  updateUserUI();
  renderHistory();
  const ids = Object.keys(chats).sort((a,b) => (chats[b].createdAt||0) - (chats[a].createdAt||0));
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
  const open = sidebar.classList.toggle("open");
  overlay.classList.toggle("visible", open);
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
    if (sidebar.classList.contains("open")) toggleSidebar();
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
    return `<div class="history-item ${active}" onclick="loadChat('${id}')">
      <span class="history-item-icon">${icon}</span>
      <span class="history-item-text">${escapeHtml(chat.title || "New Chat")}</span>
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
  btn.dataset.active = webSearchEnabled;
  showToast(webSearchEnabled ? "🔍 Web Search ON" : "Web Search OFF", webSearchEnabled ? "success" : "");
}
function toggleImageMode() {
  imageModeEnabled = !imageModeEnabled;
  const btn = document.getElementById("imageGenBtn");
  btn.dataset.active = imageModeEnabled;
  const inp = document.getElementById("messageInput");
  inp.placeholder = imageModeEnabled
    ? "Describe the image you want to generate..."
    : "Ask anything... (Shift+Enter for new line)";
  showToast(imageModeEnabled ? "🎨 Image Mode ON" : "Image Mode OFF", imageModeEnabled ? "success" : "");
}
function toggleVoice() {
  voiceOutputEnabled = !voiceOutputEnabled;
  document.getElementById("voiceToggleBtn").classList.toggle("active", voiceOutputEnabled);
  showToast(voiceOutputEnabled ? "🔊 Voice Output ON" : "Voice Output OFF", voiceOutputEnabled ? "success" : "");
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
  if (pendingFiles.length === 0) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  wrap.innerHTML = pendingFiles.map((f, i) => {
    const isImg = f.type.startsWith("image/");
    const preview = isImg
      ? `<img src="${URL.createObjectURL(f)}" alt="" style="width:22px;height:22px;border-radius:3px;object-fit:cover;">`
      : `<span>📄</span>`;
    const name = f.name.length > 22 ? f.name.slice(0,20)+"…" : f.name;
    return `<div class="preview-chip">${preview}<span>${escapeHtml(name)}</span><button class="preview-chip-del" onclick="removeFile(${i})">×</button></div>`;
  }).join("");
}
function removeFile(i) { pendingFiles.splice(i, 1); updateFilePreview(); }

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
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => {
    isRecording = true;
    document.getElementById("voiceInputBtn").style.color = "var(--danger)";
    showVoiceIndicator(true);
  };
  recognition.onresult = (e) => {
    const t = e.results[0][0].transcript;
    const inp = document.getElementById("messageInput");
    inp.value = t; autoResize(inp);
  };
  recognition.onend = recognition.onerror = () => {
    isRecording = false;
    document.getElementById("voiceInputBtn").style.color = "";
    showVoiceIndicator(false);
  };
  recognition.start();
}
function showVoiceIndicator(show) {
  let el = document.getElementById("voiceIndicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "voiceIndicator";
    el.className = "voice-indicator hidden";
    el.innerHTML = `<div class="voice-pulse"></div><span>Listening… Speak now</span>
      <button onclick="if(window.recognition)recognition.stop()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:0 4px">Stop</button>`;
    document.body.appendChild(el);
  }
  el.classList.toggle("hidden", !show);
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  if (isGenerating) return;
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text && pendingFiles.length === 0) return;

  input.value = "";
  input.style.height = "auto";
  document.getElementById("welcomeScreen").style.display = "none";
  isGenerating = true;
  document.getElementById("sendBtn").disabled = true;

  const filesSnapshot = [...pendingFiles];
  pendingFiles = [];
  updateFilePreview();

  // Process uploaded files
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
    } else {
      try {
        const txt = await file.text();
        fileTexts.push({ name: file.name, content: txt.slice(0, 8000) });
        fileAttachHtml += `<div class="msg-file-attach"><span class="msg-file-icon">📄</span><span>${escapeHtml(file.name)}</span></div>`;
      } catch {}
    }
  }

  renderMessage("user", text, null, false, fileAttachHtml);

  if (!currentChatId) newChat();
  if (!chats[currentChatId]) chats[currentChatId] = { title: "New Chat", messages: [], createdAt: Date.now() };
  chats[currentChatId].messages.push({ role: "user", content: text });
  // Set title from first user message
  if (chats[currentChatId].messages.filter(m => m.role === "user").length === 1 && text) {
    chats[currentChatId].title = text.slice(0, 55) + (text.length > 55 ? "…" : "");
    renderHistory();
  }
  saveChats();

  const typingId = showTyping();

  try {
    let aiResponse = "";
    let generatedImageUrl = null;

    // --- IMAGE GENERATION ---
    if (imageModeEnabled) {
      removeTyping(typingId);

      // Show beautiful generation animation card immediately
      const animCardId = "imgcard_" + Date.now();
      renderImageGeneratingCard(animCardId, text);

      generatedImageUrl = await generateImage(text);

      if (generatedImageUrl) {
        // Replace animation card with actual image
        replaceImageCard(animCardId, text, generatedImageUrl);
        aiResponse = `Here's your generated image!\n\nPrompt: *"${text}"*`;
      } else {
        removeImageCard(animCardId);
        const fallbackId = showTyping();
        const desc = await callGroq(
          `Describe in vivid, detailed language what a photorealistic image of "${text}" would look like. Cover colors, composition, lighting, atmosphere, and key details. 3-4 sentences.`,
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
      aiResponse = await callLLM(promptWithCtx, imageBase64, imageMediaType, fileTexts);
      removeTyping(thinkId);
      renderMessage("assistant", aiResponse, null, true);
    }

    // --- FILE ANALYSIS ---
    else if (filesSnapshot.length > 0 && (imageBase64 || fileTexts.length > 0)) {
      removeTyping(typingId);
      const analyzeId = showStatusTag("analyzing", "🔬 Analyzing your file…");
      aiResponse = await callLLM(text || "Analyze and describe this.", imageBase64, imageMediaType, fileTexts);
      removeStatusTag(analyzeId);
      renderMessage("assistant", aiResponse, null, true);
    }

    // --- NORMAL CHAT ---
    else {
      aiResponse = await callLLM(text, null, null, []);
      removeTyping(typingId);
      renderMessage("assistant", aiResponse, null, true);
    }

    chats[currentChatId].messages.push({
      role: "assistant",
      content: aiResponse,
      imageUrl: generatedImageUrl || undefined
    });
    saveChats();

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
  document.getElementById("sendBtn").disabled = false;
  scrollToBottom();
}

// ===== CALL LLM (router) =====
async function callLLM(prompt, imageBase64, imageMediaType, fileTexts) {
  const model = document.getElementById("modelSelect").value;
  const history = getCurrentHistory();

  let systemPrompt = `You are NEXUS AI, an advanced intelligent assistant. Be helpful, accurate, and detailed.

FORMATTING RULES (MUST FOLLOW):
- Use proper markdown formatting in ALL responses
- For ANY code: use fenced code blocks with language tag. Example:
\`\`\`html
<h1>Hello</h1>
\`\`\`
- For lists use proper markdown: - item or 1. item
- Use **bold** for emphasis, ## for headings
- Never output \\n as literal text — use real line breaks
- Write complete, working code when asked

User: ${userName}`;

  if (fileTexts.length > 0) {
    systemPrompt += "\n\nAnalyze these uploaded files:\n" +
      fileTexts.map(f => `\n=== ${f.name} ===\n${f.content}`).join("\n");
  }

  // Vision → use Gemini
  if (imageBase64) {
    return callGemini(prompt, imageBase64, imageMediaType, history, systemPrompt);
  }
  if (model === "gemini-flash" || model === "gemini-pro") {
    return callGemini(prompt, null, null, history, systemPrompt);
  }
  return callGroq(prompt, history, systemPrompt, model);
}

// ===== GROQ =====
async function callGroq(prompt, history, systemPrompt, modelKey) {
  const modelMap = {
    "groq-llama":   "llama-3.3-70b-versatile",
    "groq-mixtral": "mixtral-8x7b-32768"
  };
  const modelId = modelMap[modelKey] || "llama-3.3-70b-versatile";

  const messages = [
    { role: "system", content: systemPrompt || "You are NEXUS AI, a helpful AI assistant. Always use proper markdown formatting." },
    ...history.slice(-12),
    { role: "user", content: prompt }
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEYS.groq}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096, temperature: 0.7 })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Groq API: " + (err.error?.message || `HTTP ${res.status}`));
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ===== GEMINI =====
async function callGemini(prompt, imageBase64, imageMediaType, history, systemPrompt) {
  const sel = document.getElementById("modelSelect").value;
  // Valid Gemini model IDs (v1beta API)
  const modelMap = {
    "gemini-pro":       "gemini-1.5-pro",
    "gemini-flash":     "gemini-2.0-flash",
    "gemini-flash15":   "gemini-1.5-flash",
  };
  const modelName = modelMap[sel] || "gemini-2.0-flash";

  const userParts = [];
  if (imageBase64) {
    userParts.push({ inline_data: { mime_type: imageMediaType || "image/jpeg", data: imageBase64 } });
  }
  userParts.push({ text: prompt });

  const contents = [];
  const histSlice = history.slice(-10);
  histSlice.forEach(m => {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    });
  });
  contents.push({ role: "user", parts: userParts });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt || "You are NEXUS AI, a helpful assistant." }] },
    contents,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${KEYS.gemini}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Gemini API: " + (err.error?.message || `HTTP ${res.status}`));
  }
  const data = await res.json();
  if (!data.candidates?.[0]) {
    const reason = data.promptFeedback?.blockReason || "unknown";
    throw new Error(`Gemini blocked this request (reason: ${reason}). Try rephrasing.`);
  }
  return data.candidates[0].content.parts[0].text;
}

// ===== WEB SEARCH (Tavily) =====
async function searchWeb(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEYS.tavily,
        query, search_depth: "advanced",
        max_results: 6, include_answer: true
      })
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
  row.id = cardId;
  row.className = "message-row";
  row.style.animation = "fadeIn 0.3s ease";
  row.innerHTML = `
    <div class="msg-avatar ai">${aiIcon}</div>
    <div class="msg-content">
      <div class="msg-bubble ai" style="overflow:hidden;padding:0;">
        <div class="img-gen-card">
          <div class="img-gen-canvas">
            <div class="img-gen-particles" id="particles_${cardId}"></div>
            <div class="img-gen-rings">
              <div class="img-gen-ring r1"></div>
              <div class="img-gen-ring r2"></div>
              <div class="img-gen-ring r3"></div>
            </div>
            <div class="img-gen-center">
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="6" fill="var(--accent)"/>
                <path d="M14 2L14 7M14 21L14 26M2 14L7 14M21 14L26 14" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <div class="img-gen-info">
            <div class="img-gen-title">
              <span class="img-gen-dot"></span>
              Creating your image&hellip;
            </div>
            <div class="img-gen-prompt">"${escapeHtml(prompt)}"</div>
            <div class="img-gen-steps">
              <div class="img-gen-step active" id="step1_${cardId}">&#10022; Interpreting prompt</div>
              <div class="img-gen-step" id="step2_${cardId}">&#10022; Generating pixels</div>
              <div class="img-gen-step" id="step3_${cardId}">&#10022; Rendering final image</div>
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
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "img-gen-particle";
      p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;opacity:${0.3+Math.random()*0.7}`;
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
        <p style="margin:0 0 8px;font-weight:600;">&#10024; Here's your generated image!</p>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Prompt: <em style="color:var(--accent)">"${escapeHtml(prompt)}"</em></p>
        <div class="msg-image-wrap">
          ${!isDataUrl ? `<div id="loadtxt_${imgId}" style="color:var(--text-muted);font-size:13px;padding:6px 0;">&#9203; Loading image&hellip;</div>` : ""}
          <img id="${imgId}" src="${imageUrl}" alt="Generated image"
            style="max-width:100%;max-height:460px;border-radius:12px;border:1px solid var(--border);cursor:pointer;display:${isDataUrl ? "block" : "none"};transition:opacity 0.5s ease;opacity:0;"
            onclick="openImageModal(this.src)"
            onload="this.style.display='block';this.style.opacity='1';const l=document.getElementById('loadtxt_${imgId}');if(l)l.remove();"
            onerror="this.style.display='none';const l=document.getElementById('loadtxt_${imgId}');if(l)l.innerHTML='<span style=color:var(--danger)>&#10060; Failed to load. <a href=\\'${imageUrl}\\' target=\\'_blank\\' style=color:var(--accent)>Open directly &#8599;</a></span>';" />
          <div class="image-actions" style="margin-top:10px;">
            <button class="image-action-btn" onclick="downloadImageFromSrc(document.getElementById('${imgId}').src,'nexus-image.png')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <button class="image-action-btn" onclick="openImageModal(document.getElementById('${imgId}').src)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              Full View
            </button>
            <button class="image-action-btn" onclick="window.open('${imageUrl}','_blank')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open
            </button>
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

function removeImageCard(cardId) {
  const el = document.getElementById(cardId);
  if (el) el.remove();
}

// ===== SMART PROMPT BUILDER =====
function buildImagePrompt(userPrompt) {
  // Step 1: Extract color-subject pairs like "pink dolphin", "blue whale", "red rose"
  const colorWords = ["red","orange","yellow","green","blue","purple","pink","brown","black","white","gray","grey","golden","silver","cyan","magenta","violet","indigo","crimson","scarlet","emerald","sapphire","turquoise","lavender","coral","teal","navy","maroon","beige","tan","bronze","transparent","glowing","neon"];

  const tokens = userPrompt.toLowerCase().split(/\s+/);
  const colorSubjectPairs = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (colorWords.includes(tokens[i])) {
      const subject = tokens[i+1].replace(/[^a-z]/g,'');
      if (subject && subject.length > 1) {
        colorSubjectPairs.push({ color: tokens[i], subject });
      }
    }
  }

  // Step 2: Build explicit binding instructions
  let colorBindings = "";
  if (colorSubjectPairs.length > 0) {
    const bindings = colorSubjectPairs.map(p => `the ${p.subject} MUST be ${p.color} colored`).join(", ");
    colorBindings = ` IMPORTANT: ${bindings}.`;
  }

  // Step 3: Assemble final prompt with quality boosters
  return `${userPrompt}.${colorBindings} Highly detailed, photorealistic, 4k, masterpiece, professional photography, sharp focus, vibrant colors, perfect lighting.`;
}

// ===== IMAGE GENERATION =====
async function generateImage(prompt) {
  // ── SMART PROMPT ENGINEERING ─────────────────────────────────────────────────
  // Parse subjects and their colors explicitly so AI doesn't mix them up
  const enhancedPrompt = buildImagePrompt(prompt);

  // ── METHOD 1: Stability AI (sd3-turbo) ──────────────────────────────────────
  // Uses FormData + fetch — works in browser with CORS allowed on their API
  try {
    const fd = new FormData();
    fd.append("prompt", enhancedPrompt);
    fd.append("output_format", "jpeg");
    fd.append("aspect_ratio", "1:1");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEYS.stability}`,
        "Accept": "image/*"
      },
      body: fd
    });

    if (res.ok) {
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // data:image/jpeg;base64,...
        reader.readAsDataURL(blob);
      });
    } else {
      const errText = await res.text().catch(()=>"");
      console.warn("Stability SD3 error:", res.status, errText);
    }
  } catch (e) { console.warn("Stability SD3 exception:", e); }

  // ── METHOD 2: Stability AI (core) fallback ──────────────────────────────────
  try {
    const fd = new FormData();
    fd.append("prompt", enhancedPrompt);
    fd.append("output_format", "jpeg");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEYS.stability}`,
        "Accept": "image/*"
      },
      body: fd
    });

    if (res.ok) {
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } else {
      const errText = await res.text().catch(()=>"");
      console.warn("Stability Core error:", res.status, errText);
    }
  } catch (e) { console.warn("Stability Core exception:", e); }

  // ── METHOD 3: Together AI (FLUX.1-schnell) ───────────────────────────────────
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEYS.together}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt: enhancedPrompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: "b64_json"
      })
    });

    if (res.ok) {
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return "data:image/png;base64," + b64;
      const url = data?.data?.[0]?.url;
      if (url) return url;
    } else {
      const errText = await res.text().catch(()=>"");
      console.warn("Together AI error:", res.status, errText);
    }
  } catch (e) { console.warn("Together AI exception:", e); }

  // ── METHOD 4: Gemini 2.0 Flash image generation ──────────────────────────────
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${KEYS.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a high quality image of: ${prompt}` }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
        })
      }
    );
    if (res.ok) {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return `data:${mime};base64,` + part.inlineData.data;
        }
      }
    }
  } catch (e) { console.warn("Gemini image gen error:", e); }

  // ── METHOD 5: Pollinations (no-key, last resort) ─────────────────────────────
  try {
    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 999999);
    return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
  } catch (e) {}

  return null;
}

// ===== VOICE OUTPUT (ElevenLabs) =====
async function speakText(text) {
  if (!text || !text.trim()) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL", {
      method: "POST",
      headers: { "xi-api-key": KEYS.elevenlabs, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 800),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!res.ok) return;
    const blob = await res.blob();
    currentAudio = new Audio(URL.createObjectURL(blob));
    currentAudio.play();
  } catch (e) { console.warn("ElevenLabs error:", e); }
}

// ===== RENDER MESSAGE =====
function renderMessage(role, content, imageUrl, animate, extraHtml) {
  const container = document.getElementById("messagesContainer");
  const isAI = role === "assistant";
  const initial = isAI ? "N" : (userName ? userName[0].toUpperCase() : "U");
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Render content
  let contentHtml = "";
  if (isAI) {
    contentHtml = renderMarkdown(content);
  } else if (content) {
    contentHtml = content.split("\n")
      .map(l => `<p style="margin:0 0 2px;">${escapeHtml(l) || "&nbsp;"}</p>`)
      .join("");
  }

  // Image
  let imageHtml = "";
  if (imageUrl) {
    const isDataUrl = imageUrl.startsWith("data:");
    const imgId = "img_" + Date.now();
    const loaderId = "imgload_" + Date.now();
    imageHtml = `<div class="msg-image-wrap" style="margin-top:10px;">
      <div id="${loaderId}" style="color:var(--text-muted);font-size:13px;padding:8px 0;">${isDataUrl ? "" : "⏳ Generating image, please wait..."}</div>
      <img id="${imgId}" src="${imageUrl}" alt="Generated image" crossorigin="anonymous"
        style="max-width:100%;max-height:420px;border-radius:10px;border:1px solid var(--border);cursor:pointer;display:${isDataUrl ? "block" : "none"};"
        onclick="openImageModal(this.src)" loading="lazy"
        onload="this.style.display='block';const l=document.getElementById('${loaderId}');if(l)l.remove();"
        onerror="this.style.display='none';const l=document.getElementById('${loaderId}');if(l)l.innerHTML='<span style=color:var(--danger)>❌ Image failed to load. <a href=\\''+this.src+'\\' target=\\'_blank\\' style=color:var(--accent)>Open directly</a></span>';" />
      <div class="image-actions">
        <button class="image-action-btn" onclick="downloadImageFromSrc(document.getElementById('${imgId}').src,'nexus-image.png')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button class="image-action-btn" onclick="openImageModal(document.getElementById('${imgId}').src)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          Full View
        </button>
        ${!isDataUrl ? `<button class="image-action-btn" onclick="window.open(document.getElementById('${imgId}').src,'_blank')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open
        </button>` : ""}
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
        ${contentHtml}
        ${imageHtml}
        ${extraHtml || ""}
      </div>
      ${actionsHtml}
      <span class="msg-time">${timeStr}</span>
    </div>`;

  container.appendChild(row);
  scrollToBottom();
}

function copyMsgContent(btn) {
  const bubble = btn.closest(".msg-content").querySelector(".msg-bubble");
  const text = bubble ? (bubble.innerText || bubble.textContent) : "";
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.textContent = "✓ Copied!"; btn.classList.add("copied");
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
  });
}
function speakMsgContent(btn) {
  const bubble = btn.closest(".msg-content").querySelector(".msg-bubble");
  const text = bubble ? (bubble.innerText || "").slice(0, 800) : "";
  speakText(text);
}

// ===== MARKDOWN RENDER (FIX: clean escaped newlines) =====
function renderMarkdown(text) {
  if (!text) return "";
  try {
    // FIX: Replace any literal \n that might have come from API
    const cleaned = text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    if (window.marked) return marked.parse(cleaned);
    // Fallback: basic conversion
    return cleaned
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/\n/g,"<br>");
  } catch (e) {
    return `<p>${escapeHtml(text)}</p>`;
  }
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

// ===== CODE COPY/DOWNLOAD (base64 safe) =====
function copyCodeB64(encoded, btn) {
  try {
    const code = decodeURIComponent(escape(atob(encoded)));
    navigator.clipboard.writeText(code).then(() => {
      const orig = btn.innerHTML;
      btn.textContent = "✓ Copied!"; btn.classList.add("copied");
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
    });
  } catch (e) { showToast("Copy failed", "error"); }
}
function downloadCodeB64(encoded, ext) {
  try {
    const code = decodeURIComponent(escape(atob(encoded)));
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nexus-code.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("✓ File downloaded!", "success");
  } catch (e) { showToast("Download failed", "error"); }
}

// ===== IMAGE DOWNLOAD =====
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

// ===== IMAGE MODAL =====
function openImageModal(src) {
  document.getElementById("imageModalSrc").src = src;
  document.getElementById("imageModal").classList.remove("hidden");
}
function closeImageModal() { document.getElementById("imageModal").classList.add("hidden"); }
function downloadModalImage() {
  downloadImageFromSrc(document.getElementById("imageModalSrc").src, "nexus-ai-image.png");
}

// ===== SETTINGS =====
function openSettings() {
  const s = JSON.parse(localStorage.getItem("nexus_settings") || "{}");
  document.getElementById("settingsName").value = userName || "";
  document.getElementById("settingsModel").value = s.model || document.getElementById("modelSelect").value;
  document.getElementById("settingsVoice").checked = !!s.voiceOutput;
  document.getElementById("settingsSearch").checked = !!s.webSearch;
  document.getElementById("settingsTheme").value = s.theme || "dark";
  document.getElementById("settingsModal").classList.remove("hidden");
}
function closeSettings(e) {
  if (!e || e.target === document.getElementById("settingsModal")) {
    document.getElementById("settingsModal").classList.add("hidden");
  }
}
function saveSettings() {
  const name = document.getElementById("settingsName").value.trim();
  if (name) { userName = name; localStorage.setItem("nexus_userName", userName); updateUserUI(); }
  const s = {
    model: document.getElementById("settingsModel").value,
    voiceOutput: document.getElementById("settingsVoice").checked,
    webSearch: document.getElementById("settingsSearch").checked,
    theme: document.getElementById("settingsTheme").value
  };
  localStorage.setItem("nexus_settings", JSON.stringify(s));
  document.getElementById("modelSelect").value = s.model;
  voiceOutputEnabled = s.voiceOutput;
  webSearchEnabled = s.webSearch;
  changeTheme(s.theme);
  document.getElementById("settingsModal").classList.add("hidden");
  showToast("✓ Settings saved!", "success");
}
function changeTheme(t) {
  document.body.className = (!t || t === "dark") ? "" : `theme-${t}`;
}
function clearAllHistory() {
  if (!confirm("Delete ALL chat history? This cannot be undone.")) return;
  chats = {}; saveChats();
  document.getElementById("settingsModal").classList.add("hidden");
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
  document.getElementById("messageInput").value = lastUser.content;
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