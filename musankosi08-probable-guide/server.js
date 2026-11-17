const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.MODEL || "openai/gpt-4o-mini";
const index = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const systemPrompt = `You are UMOYA, a patient tutor for South African Grade 12 learners (CAPS curriculum: maths, maths lit, physical science, life science, accounting). Users may mix English with isiXhosa, isiZulu, Sesotho or Afrikaans; reply in the same mix. Format strictly:
SUBJECT: <subject>
STEP 1: <one short step>
STEP 2: ... (max 6 steps)
ANSWER: <final answer>
CHECK: <one practice question>
For greetings or non-problem questions reply normally without this format. Politely decline non-school topics.`;

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 200000) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function chat(messages) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 500
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `AI request failed (${response.status}).`);
  return data.choices?.[0]?.message?.content || "I could not find an answer. Please try again.";
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return send(res, 200, index, "text/html; charset=utf-8");
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      const body = JSON.parse(await readBody(req));
      if (!Array.isArray(body.messages)) return send(res, 400, { error: "messages must be an array." });
      const messages = body.messages.slice(-6).map(message => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "").slice(0, 600)
      }));
      return send(res, 200, { reply: await chat(messages) });
    } catch (error) {
      return send(res, error instanceof SyntaxError ? 400 : 502, { error: error.message || "Something went wrong." });
    }
  }
  send(res, 404, { error: "Not found." });
});

server.listen(PORT, () => console.log(`UMOYA listening on http://localhost:${PORT}`));
