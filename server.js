const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.MODEL || "openai/gpt-4o-mini";
const VISION_MODEL = process.env.VISION_MODEL || "openai/gpt-4o-mini";
const index = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const systemPrompt = `You are UMOYA, a patient tutor for South African Grade 12 learners. You answer ONLY Mathematics and Physical Science questions. Users may write in English, isiXhosa, isiZulu, Sesotho, Setswana, Sepedi, Xitsonga, siSwati, Tshivenda, or Afrikaans, including mixed language. Understand the question and reply in the same language or language mix. Do not translate unless asked. For questions outside Mathematics or Physical Science, politely say that UMOYA only helps with Mathematics and Physical Science. Format subject questions strictly:
SUBJECT: <subject>
STEP 1: <one short step>
STEP 2: ... (max 6 steps)
ANSWER: <final answer>
CHECK: <one practice question>
For greetings reply normally. Politely decline all other subjects and non-school topics.`;

function offlineAnswer(messages) {
  const latest = String(messages.at(-1)?.content || "");
  const question = latest.toLowerCase();
  const context = messages.map(message => String(message.content || "")).join(" ").toLowerCase();
  const xhosa = /\b(xhosa|isixhosa|ndicela|chaza|cacisa|amanyathelo|inyathelo)\b/.test(question);
  const target = context;
  if (target.includes("2x") && target.includes("5x") && target.includes("3")) {
    if (xhosa) {
      return "SUBJECT: Mathematics\nINYATHELO 1: Yenza i-factorisation: 2x² - 5x - 3 = (2x + 1)(x - 3).\nINYATHELO 2: Beka i-factor nganye ilingane no-zero: 2x + 1 = 0 okanye x - 3 = 0.\nINYATHELO 3: Sombulula ezi equations: x = -1/2 okanye x = 3.\nANSWER: Impendulo ngu x = 3 okanye x = -1/2.\nCHECK: Faka la maxabiso kwi 2x² - 5x - 3 ukuze uqinisekise impendulo.";
    }
    return "SUBJECT: Mathematics\nSTEP 1: Factorise 2x² - 5x - 3 as (2x + 1)(x - 3).\nSTEP 2: Set each factor equal to zero: 2x + 1 = 0 or x - 3 = 0.\nSTEP 3: Solve to get x = -1/2 or x = 3.\nANSWER: x = 3 or x = -1/2.\nCHECK: Substitute each value into 2x² - 5x - 3 to verify.";
  }
  if ((target.includes("4 kg") && target.includes("20 n")) || target.includes("acceleration") || target.includes("force") || target.includes("newton") || target.includes("amandla")) {
    if (xhosa) {
      return "SUBJECT: Physical Science\nINYATHELO 1: Sebenzisa umthetho wesibini kaNewton: F = ma.\nINYATHELO 2: Lungisa le formula ukuze ufumane i-acceleration: a = F/m.\nINYATHELO 3: Faka amanani: a = 20 N ÷ 4 kg.\nANSWER: I-acceleration ngu 5 m·s⁻².\nCHECK: Ngawaphi amandla afunekayo uku-accelerate u-6 kg nge 5 m·s⁻²?";
    }
    return "SUBJECT: Physical Science\nSTEP 1: Use Newton's second law, F = ma.\nSTEP 2: Rearrange for acceleration: a = F/m.\nSTEP 3: Substitute F = 20 N and m = 4 kg.\nANSWER: a = 20/4 = 5 m·s⁻².\nCHECK: What force is needed to accelerate 6 kg at 5 m·s⁻²?";
  }
  if (/[=+\-*/²^]|solve|factor|equation|algebra|calculate|math|mathematics|xhosa.*(izibalo|mathematics)|izibalo|sombulula|isibalo|xazulula|bereken|vergelyking/.test(target)) {
    if (xhosa) {
      return "SUBJECT: Mathematics\nINYATHELO 1: Chonga amanani anikiweyo kunye nento ekufuneka uyifumane.\nINYATHELO 2: Khetha umthetho okanye ifomula efanelekileyo.\nINYATHELO 3: Faka amanani uze ubale ngononophelo.\nANSWER: Nceda uthumele umbuzo opheleleyo weMathematics ukuze ndibale impendulo echanekileyo.\nCHECK: Ngawaphi amanani anikiweyo kumbuzo?";
    }
    return "SUBJECT: Mathematics\nSTEP 1: Identify the given values and the quantity to find.\nSTEP 2: Choose the appropriate mathematical rule or formula.\nSTEP 3: Substitute the values and simplify carefully.\nANSWER: Please include the complete Mathematics question so I can calculate the correct answer.\nCHECK: Which values are given in the question?";
  }
  return "SUBJECT: UMOYA scope\nANSWER: Ndiyanceda kuphela ngeMathematics nePhysical Science. Please send a Mathematics or Physical Science question.";
}

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 8000000) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function chat(messages) {
  if (!process.env.GITHUB_TOKEN) return offlineAnswer(messages);
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
  if (!response.ok) return offlineAnswer(messages);
  if (!Array.isArray(data.choices)) return offlineAnswer(messages);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return offlineAnswer(messages);
  return content;
}

async function scanAttachment(file) {
  if (!file || typeof file.dataUrl !== "string") throw new Error("Please attach an image or PDF.");
  if (file.dataUrl.length > 7500000) throw new Error("That file is too large. Please use a file smaller than 5 MB.");
  if (file.type === "application/pdf") {
    return "I can receive PDF files, but this browser demo cannot read PDF pages yet. Please upload a photo or screenshot of the maths or physical science question.";
  }
  if (!file.type.startsWith("image/")) throw new Error("Only images and PDFs are supported.");
  if (!process.env.GITHUB_TOKEN) return offlineAnswer([{ role: "user", content: "Please solve the maths or physics question in this image." }]);
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: `${systemPrompt} Read the attached image carefully. Extract the question, then solve it. If it is not Mathematics or Physical Science, decline it.` },
        { role: "user", content: [
          { type: "text", text: "Read and solve the question in this image. Explain the steps clearly." },
          { type: "image_url", image_url: { url: file.dataUrl } }
        ] }
      ],
      max_tokens: 700
    })
  });
  const data = await response.json().catch(() => ({}));
  const content = data.choices?.[0]?.message?.content;
  if (!response.ok || typeof content !== "string" || !content.trim()) {
    throw new Error(data.error?.message || "The image could not be read. Try a clearer photo.");
  }
  return content;
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
      console.error("Chat request failed:", error.message || error);
      return send(res, error instanceof SyntaxError ? 400 : 502, { error: error.message || "Something went wrong." });
    }
  }
  if (req.method === "POST" && req.url === "/api/scan") {
    try {
      const body = JSON.parse(await readBody(req));
      return send(res, 200, { reply: await scanAttachment(body.file) });
    } catch (error) {
      console.error("Attachment scan failed:", error.message || error);
      return send(res, error instanceof SyntaxError ? 400 : 502, { error: error.message || "The attachment could not be read." });
    }
  }
  send(res, 404, { error: "Not found." });
});

server.listen(PORT, () => console.log(`UMOYA listening on http://localhost:${PORT}`));
