const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const DEFAULT_PERSONA = [
  "You are a friendly pixel companion inside a small browser room.",
  "Keep replies concise, warm, and useful.",
  "Do not claim to have access to private files, devices, or hidden state.",
  "When the user asks for code or technical help, answer clearly and directly."
].join("\n");

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const messages = normalizeMessages(body.messages);
    const model = normalizeModel(body.model || env.MODEL_NAME || "deepseek-chat");
    const persona = normalizePersona(body.persona);
    const apiKey = String(body.apiKey || "").trim();
    const baseUrl = normalizeBaseUrl(body.baseUrl || env.MODEL_BASE_URL || "https://api.deepseek.com");
    const wantsStream = body.stream === true;
    const maxTokens = normalizeMaxTokens(body.maxTokens);

    if (!apiKey) {
      return json({ error: "Please enter your API key in Settings before chatting." }, 400);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: persona },
          ...messages
        ],
        temperature: model === "deepseek-reasoner" ? 0.6 : 0.8,
        max_tokens: maxTokens,
        stream: wantsStream
      })
    });

    if (wantsStream) {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return json({ error: payload.error?.message || "Model request failed." }, response.status);
      }

      return streamModelResponse(response);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return json({ error: payload.error?.message || "Model request failed." }, response.status);
    }

    const reply = payload.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return json({ error: "The model returned an empty reply." }, 502);
    }

    return json({ reply, model });
  } catch (error) {
    return json({ error: error.message || "Invalid chat request." }, 400);
  }
}

function streamModelResponse(response) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const payload = JSON.parse(data);
              const token = payload.choices?.[0]?.delta?.content || "";
              if (token) controller.enqueue(encoder.encode(token));
            } catch {
              // Ignore partial or non-JSON server-sent event lines.
            }
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform"
    }
  });
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array.");
  }

  if (messages.length > 20) {
    throw new Error("Too many messages. Keep the latest 20 or fewer.");
  }

  return messages.map((message) => {
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = String(message.content || "").slice(0, 12000).trim();

    if (!content) {
      throw new Error("Message content cannot be empty.");
    }

    return { role, content };
  });
}

function normalizeModel(model) {
  const normalized = String(model || "deepseek-chat").trim().slice(0, 100);
  return /^[\w./:-]+$/.test(normalized) ? normalized : "deepseek-chat";
}

function normalizeBaseUrl(baseUrl) {
  const url = String(baseUrl || "https://api.deepseek.com").trim().replace(/\/$/, "");

  if (!/^https:\/\/api\.deepseek\.com(\/.*)?$/.test(url)) {
    return "https://api.deepseek.com";
  }

  return url;
}

function normalizeMaxTokens(maxTokens) {
  const value = Number(maxTokens || 800);

  if (!Number.isFinite(value)) {
    return 800;
  }

  return Math.max(256, Math.min(2400, Math.floor(value)));
}

function normalizePersona(persona) {
  const content = String(persona || DEFAULT_PERSONA).trim();
  return content.slice(0, 12000) || DEFAULT_PERSONA;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

