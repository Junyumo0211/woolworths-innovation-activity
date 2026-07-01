const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 3128);
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const options = [
  {
    id: "analytics",
    name: "App & Rewards Analytics",
    short: "Rewards Analytics",
    color: "#176c4d"
  },
  {
    id: "weather",
    name: "Weather-Based Inventory",
    short: "Weather Inventory",
    color: "#2563eb"
  },
  {
    id: "chatbot",
    name: "AI Customer Service Chatbot",
    short: "AI Chatbot",
    color: "#9333ea"
  },
  {
    id: "robotics",
    name: "Automated Warehouse Robotics",
    short: "Warehouse Robotics",
    color: "#dc6b19"
  }
];

const rounds = [
  {
    id: "strategic",
    title: "Round 1: Strategic Fit",
    prompt: "Which investment best strengthens Woolworths' customer and operating strategy?"
  },
  {
    id: "feasibility",
    title: "Round 2: Feasibility",
    prompt: "Which option could Woolworths implement with the least disruption and clearest data foundation?"
  },
  {
    id: "resilience",
    title: "Round 3: Risk & Resilience",
    prompt: "Which option most improves resilience against demand shifts, service pressure, or supply volatility?"
  },
  {
    id: "roi",
    title: "Round 4: 12-Month Value",
    prompt: "Which option is most likely to show measurable business value within one year?"
  }
];

const analyses = {
  analytics: {
    title: "Customer Intelligence Portfolio",
    body:
      "The class is leaning toward customer data as the highest-value innovation lever. This suggests the committee values measurable personalisation, loyalty growth, and targeted decision-making before heavier operational transformation."
  },
  weather: {
    title: "Resilient Operations Portfolio",
    body:
      "The class is prioritising operational resilience. This pattern suggests the committee sees demand forecasting, waste reduction, and localised inventory planning as the strongest route to defensible value."
  },
  chatbot: {
    title: "Service Automation Portfolio",
    body:
      "The class is drawn to visible customer-service improvement. This indicates a preference for scalable support, faster response times, and lower service load, while accepting adoption and quality-control risks."
  },
  robotics: {
    title: "Infrastructure Transformation Portfolio",
    body:
      "The class is favouring long-term automation capability. This implies the committee is willing to back higher capital investment for fulfilment speed, labour efficiency, and supply-chain scalability."
  },
  balanced: {
    title: "Balanced Experiment Portfolio",
    body:
      "The class is split across several innovation logics. This points to a staged portfolio approach: fund a small pilot in the leading option while reserving budget for a second experiment that manages a different risk or value driver."
  }
};

const votes = new Map();
const joined = new Set();
const clients = new Set();
let activityStarted = process.env.START_OPEN === "true";

function networkUrls() {
  const urls = [`http://localhost:${PORT}`];
  for (const details of Object.values(os.networkInterfaces())) {
    for (const item of details || []) {
      if (item.family === "IPv4" && !item.internal) {
        urls.push(`http://${item.address}:${PORT}`);
      }
    }
  }
  return urls;
}

function publicBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");

  const forwardedHost = req.headers["x-forwarded-host"];
  const host = forwardedHost || req.headers.host;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = String(host || "").includes("onrender.com") ? "https" : forwardedProto || "http";

  return `${protocol}://${host}`;
}

function results() {
  const totals = Object.fromEntries(options.map((option) => [option.id, 0]));
  const byRound = Object.fromEntries(
    rounds.map((round) => [round.id, Object.fromEntries(options.map((option) => [option.id, 0]))])
  );

  for (const vote of votes.values()) {
    for (const [roundId, optionId] of Object.entries(vote.choices || {})) {
      if (totals[optionId] !== undefined) totals[optionId] += 1;
      if (byRound[roundId] && byRound[roundId][optionId] !== undefined) byRound[roundId][optionId] += 1;
    }
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0]?.[1] || 0;
  const leaders = sorted.filter(([, score]) => score === topScore && score > 0);
  const analysisId = leaders.length === 1 ? leaders[0][0] : "balanced";

  return {
    options,
    rounds,
    totals,
    byRound,
    responseCount: votes.size,
    joinedCount: joined.size,
    activityStarted,
    totalChoices: Object.values(totals).reduce((sum, value) => sum + value, 0),
    leader: leaders.length === 1 ? leaders[0][0] : null,
    analysis: analyses[analysisId],
    urls: networkUrls(),
    publicUrl: process.env.PUBLIC_URL || ""
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function adminAllowed(req, url) {
  if (!ADMIN_KEY) return true;
  return req.headers["x-admin-key"] === ADMIN_KEY || url.searchParams.get("key") === ADMIN_KEY;
}

function broadcast() {
  const payload = `data: ${JSON.stringify(results())}\n\n`;
  for (const client of clients) client.write(payload);
}

function startActivity() {
  activityStarted = true;
  broadcast();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8"
    }[ext] || "application/octet-stream"
  );
}

async function sendQr(res, targetUrl) {
  try {
    const QRCode = require("qrcode");
    const svg = await QRCode.toString(targetUrl, {
      type: "svg",
      margin: 2,
      width: 900,
      color: {
        dark: "#162018",
        light: "#ffffff"
      }
    });
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(svg);
  } catch {
    const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=20&data=${encodeURIComponent(
      targetUrl
    )}`;
    res.writeHead(302, { Location: fallback });
    res.end();
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cleanPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        options,
        rounds,
        urls: networkUrls(),
        publicUrl: process.env.PUBLIC_URL || "",
        activityStarted
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/results") {
      sendJson(res, 200, results());
      return;
    }

    if (req.method === "GET" && url.pathname === "/qr.svg") {
      const targetUrl = url.searchParams.get("url") || `${publicBaseUrl(req)}/`;
      await sendQr(res, targetUrl);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify(results())}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vote") {
      const payload = JSON.parse(await readBody(req));
      if (!payload.voterId || typeof payload.choices !== "object") {
        sendJson(res, 400, { error: "Invalid vote payload." });
        return;
      }
      const choices = {};
      for (const round of rounds) {
        const choice = payload.choices[round.id];
        if (!options.some((option) => option.id === choice)) {
          sendJson(res, 400, { error: `Missing choice for ${round.id}.` });
          return;
        }
        choices[round.id] = choice;
      }
      votes.set(String(payload.voterId), { choices, submittedAt: new Date().toISOString() });
      broadcast();
      sendJson(res, 200, { ok: true, results: results() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/join") {
      const payload = JSON.parse(await readBody(req));
      if (payload.voterId) joined.add(String(payload.voterId));
      broadcast();
      sendJson(res, 200, { ok: true, activityStarted });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/start") {
      if (!adminAllowed(req, url)) {
        sendJson(res, 401, { error: "Teacher key required." });
        return;
      }
      startActivity();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reset") {
      if (!adminAllowed(req, url)) {
        sendJson(res, 401, { error: "Teacher key required." });
        return;
      }
      votes.clear();
      joined.clear();
      activityStarted = false;
      broadcast();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/export.csv") {
      if (!adminAllowed(req, url)) {
        sendJson(res, 401, { error: "Teacher key required." });
        return;
      }
      const header = ["voterId", "submittedAt", ...rounds.map((round) => round.id)];
      const rows = [header.join(",")];
      for (const [voterId, vote] of votes.entries()) {
        rows.push(
          [voterId, vote.submittedAt, ...rounds.map((round) => vote.choices[round.id])]
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(",")
        );
      }
      const body = rows.join("\n");
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=woolworths-innovation-votes.csv"
      });
      res.end(body);
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin") {
      req.url = "/admin.html";
      serveStatic(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/screen") {
      req.url = "/screen.html";
      serveStatic(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Woolworths Innovation Activity is running.");
  for (const url of networkUrls()) console.log(`Student voting: ${url}`);
  console.log(`Teacher dashboard: http://localhost:${PORT}/admin.html`);
});
