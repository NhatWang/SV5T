/**
 * Utils/azureAI.js
 * Gọi GPT-5.4 mini qua Azure OpenAI.
 * Dùng OpenAI Chat Completions API format.
 */

const AZURE_ENDPOINT = process.env.AZURE_FOUNDRY_ENDPOINT?.replace(/\/$/, "");
const AZURE_KEY      = process.env.AZURE_FOUNDRY_KEY;
const AZURE_MODEL    = process.env.AZURE_FOUNDRY_MODEL || "gpt-5.4-mini";
const API_VERSION    = "2025-04-01-preview";

function getUrl(stream = false) {
  return `${AZURE_ENDPOINT}/openai/deployments/${AZURE_MODEL}/chat/completions?api-version=${API_VERSION}`;
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "api-key": process.env.AZURE_FOUNDRY_KEY
  };
}

/**
 * Gọi GPT-5.4 mini — trả về text đầy đủ.
 */
async function callAzureClaude({ system, messages, maxTokens = 1024, temperature = 0.7 }) {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error("Thiếu AZURE_FOUNDRY_ENDPOINT hoặc AZURE_FOUNDRY_KEY trong .env");
  }

  const body = {
    max_completion_tokens: maxTokens,
    temperature,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages
    ]
  };

  const response = await fetch(getUrl(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Azure OpenAI API error:", response.status, errText);
    throw new Error(`Azure OpenAI API lỗi ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Azure OpenAI API không trả về nội dung");
  return text;
}

/**
 * Gọi GPT-5.4 mini với ảnh — trả về text đầy đủ.
 */
async function callAzureClaudeWithImage({ system, base64Image, mimeType, maxTokens = 1024 }) {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error("Thiếu AZURE_FOUNDRY_ENDPOINT hoặc AZURE_FOUNDRY_KEY trong .env");
  }

  const body = {
    max_completion_tokens: maxTokens,
    temperature: 0.2,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high"
            }
          },
          {
            type: "text",
            text: "Phân tích tài liệu trong ảnh theo hướng dẫn trên."
          }
        ]
      }
    ]
  };

  const response = await fetch(getUrl(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Azure OpenAI Vision API error:", response.status, errText);
    throw new Error(`Azure OpenAI Vision API lỗi ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Azure OpenAI Vision API không trả về nội dung");
  return text;
}

/**
 * Streaming version — dùng cho chatbot SSE.
 */
async function callAzureClaudeStream({ system, messages, maxTokens = 1024, temperature = 0.7, onChunk, onDone, onError }) {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    onError?.(new Error("Thiếu AZURE_FOUNDRY_ENDPOINT hoặc AZURE_FOUNDRY_KEY trong .env"));
    return;
  }

  const body = {
    max_completion_tokens: maxTokens,
    temperature,
    stream: true,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages
    ]
  };

  try {
    const response = await fetch(getUrl(true), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      onError?.(new Error(`Azure OpenAI Stream API lỗi ${response.status}: ${errText}`));
      return;
    }

    let buffer = "";
    let doneCalled = false;
    let chunkCount = 0;

    for await (const chunk of response.body) {
      buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === "data: [DONE]") {
          console.log(`[Stream] DONE — total chunks: ${chunkCount}`);
          if (!doneCalled) { doneCalled = true; onDone?.(); }
          continue;
        }

        const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;

          if (delta) {
            chunkCount++;
            onChunk?.(delta);
          }

          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason && finishReason !== "null" && !doneCalled) {
            console.log(`[Stream] finish_reason: ${finishReason}, chunks: ${chunkCount}`);
            doneCalled = true;
            onDone?.();
          }
        } catch {
          // Bỏ qua dòng không parse được
        }
      }
    }

    if (!doneCalled) {
      console.log(`[Stream] ended without DONE signal, chunks: ${chunkCount}`);
      onDone?.();
    }

  } catch (error) {
    onError?.(error);
  }
}

module.exports = { callAzureClaude, callAzureClaudeWithImage, callAzureClaudeStream };