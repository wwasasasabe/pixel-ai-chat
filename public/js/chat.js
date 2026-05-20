import { clearMessages, loadMessages, saveMessages } from "./storage.js";

const CONFIG_KEY = "pixel-ai-chat.config.v1";
const PERSONA_KEY = "pixel-ai-chat.persona.v1";
const NAME_KEY = "pixel-ai-chat.assistant-name.v1";
const DEFAULT_NAME = "Pixel Companion";

const DEFAULT_PERSONA = [
  "You are a friendly pixel companion inside a small browser room.",
  "Keep replies concise, warm, and useful.",
  "When the user asks for code or technical help, answer clearly and directly.",
  "Do not claim to have access to private files, devices, or hidden state."
].join("\n");

export function initChat({
  onUserMessage = () => {},
  onAssistantStart = () => {},
  onAssistantDelta = () => {},
  onAssistantMessage = () => {}
} = {}) {
  const messagesEl = document.querySelector("#messages");
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  const sendButton = document.querySelector("#sendButton");
  const clearButton = document.querySelector("#clearChat");
  const tabs = [...document.querySelectorAll(".mode-tab")];
  const views = [...document.querySelectorAll("[data-panel-view]")];
  const apiKeyInput = document.querySelector("#apiKeyInput");
  const baseUrlInput = document.querySelector("#baseUrlInput");
  const modelInput = document.querySelector("#modelInput");
  const saveApiButton = document.querySelector("#saveApiButton");
  const testApiButton = document.querySelector("#testApiButton");
  const apiStatus = document.querySelector("#apiStatus");
  const personaInput = document.querySelector("#personaInput");
  const assistantNameInput = document.querySelector("#assistantNameInput");
  const savePersonaButton = document.querySelector("#savePersonaButton");
  const personaStatus = document.querySelector("#personaStatus");

  let messages = loadMessages();
  let isSending = false;
  let config = loadConfig();

  apiKeyInput.value = config.apiKey || "";
  baseUrlInput.value = config.baseUrl || "https://api.deepseek.com";
  modelInput.value = config.model || "deepseek-chat";
  personaInput.value = loadPersona();
  assistantNameInput.value = loadAssistantName();

  renderMessages(messagesEl, messages);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const panel = tab.dataset.panel;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      views.forEach((view) => view.classList.toggle("active", view.dataset.panelView === panel));
      form.hidden = panel !== "chat";
      if (panel === "chat") input.focus();
    });
  });

  saveApiButton.addEventListener("click", () => {
    config = readApiConfig();
    saveConfig(config);
    apiStatus.textContent = config.apiKey
      ? "API settings saved in this browser."
      : "Settings saved. Add an API key before chatting.";
  });

  savePersonaButton.addEventListener("click", () => {
    savePersona(personaInput.value);
    saveAssistantName(assistantNameInput.value);
    renderMessages(messagesEl, messages);
    personaStatus.textContent = "Persona saved. It will be sent with the next message.";
  });

  testApiButton.addEventListener("click", async () => {
    apiStatus.textContent = "Testing connection...";
    testApiButton.disabled = true;

    try {
      const reply = await requestAssistantReply([
        { role: "user", content: "Reply with only: connection ok" }
      ]);
      apiStatus.textContent = `Connected: ${reply.slice(0, 80)}`;
    } catch (error) {
      apiStatus.textContent = `Connection failed: ${error.message}`;
    } finally {
      testApiButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = input.value.trim();
    if (!content || isSending) return;

    const userMessage = createMessage("user", content);
    messages = [...messages, userMessage];
    saveMessages(messages);
    renderMessages(messagesEl, messages);
    onUserMessage(userMessage);

    input.value = "";
    isSending = true;
    sendButton.disabled = true;
    sendButton.textContent = "...";

    const requestMessages = [...messages];
    const assistantMessage = createMessage("assistant", "");
    messages = [...messages, assistantMessage];
    saveMessages(messages);
    renderMessages(messagesEl, messages);
    onAssistantStart(assistantMessage);

    try {
      await requestAssistantReplyStream(requestMessages, (chunk) => {
        assistantMessage.content += chunk;
        saveMessages(messages);
        renderMessages(messagesEl, messages);
        onAssistantDelta(chunk, assistantMessage);
      });

      if (!assistantMessage.content.trim()) {
        throw new Error("Assistant returned an empty reply.");
      }

      saveMessages(messages);
      renderMessages(messagesEl, messages);
      onAssistantMessage(assistantMessage);
    } catch (error) {
      assistantMessage.content = `Connection failed: ${error.message}`;
      saveMessages(messages);
      renderMessages(messagesEl, messages);
      onAssistantMessage(assistantMessage);
    } finally {
      isSending = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      input.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  clearButton.addEventListener("click", () => {
    clearMessages();
    messages = [];
    renderMessages(messagesEl, messages);
    input.focus();
  });
}

function createMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now()
  };
}

function renderMessages(container, messages) {
  container.replaceChildren(...messages.map(renderMessage));
  container.scrollTop = container.scrollHeight;
}

function renderMessage(message) {
  const article = document.createElement("article");
  article.className = `message ${message.role}`;

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = getAuthorName(message.role);

  const body = document.createElement("p");
  body.textContent = message.content || "...";

  article.append(author, body);
  return article;
}

function getAuthorName(role) {
  if (role === "user") return "You";
  if (role === "system") return "System";
  return loadAssistantName();
}

async function requestAssistantReply(messages) {
  const response = await fetchChat(messages, false);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.reply) {
    throw new Error(payload.error || "Assistant request failed.");
  }

  return payload.reply;
}

async function requestAssistantReplyStream(messages, onDelta) {
  const response = await fetchChat(messages, true);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Assistant request failed.");
  }

  if (!response.body) {
    const payload = await response.json().catch(() => ({}));
    if (!payload.reply) throw new Error(payload.error || "Assistant request failed.");
    onDelta(payload.reply);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onDelta(chunk);
  }

  const tail = decoder.decode();
  if (tail) onDelta(tail);
}

function fetchChat(messages, stream) {
  const config = loadConfig();
  const apiMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => String(message.content || "").trim())
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));

  return fetch(window.PIXEL_CHAT_API_URL || "/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      persona: buildPersonaPrompt(),
      messages: apiMessages,
      stream
    })
  });
}

function loadConfig() {
  try {
    return {
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
      ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}")
    };
  } catch {
    return { model: "deepseek-chat", baseUrl: "https://api.deepseek.com", apiKey: "" };
  }
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function readApiConfig() {
  return {
    apiKey: document.querySelector("#apiKeyInput")?.value.trim() || "",
    baseUrl: (document.querySelector("#baseUrlInput")?.value.trim() || "https://api.deepseek.com").replace(/\/$/, ""),
    model: document.querySelector("#modelInput")?.value || "deepseek-chat"
  };
}

function loadPersona() {
  return localStorage.getItem(PERSONA_KEY) || DEFAULT_PERSONA;
}

function savePersona(persona) {
  localStorage.setItem(PERSONA_KEY, persona.trim() || DEFAULT_PERSONA);
}

function loadAssistantName() {
  return sanitizeAssistantName(localStorage.getItem(NAME_KEY) || DEFAULT_NAME);
}

function saveAssistantName(name) {
  localStorage.setItem(NAME_KEY, sanitizeAssistantName(name));
}

function sanitizeAssistantName(name) {
  return String(name || DEFAULT_NAME).trim().slice(0, 32) || DEFAULT_NAME;
}

function buildPersonaPrompt() {
  return [
    `Assistant display name: ${loadAssistantName()}`,
    loadPersona().trim()
  ].filter(Boolean).join("\n\n");
}

