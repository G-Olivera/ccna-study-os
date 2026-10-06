// server.js — API HTTP do agente do Lab Real.
//
//   GET    /saude                    → sem auth, só pra testar se está no ar
//   POST   /labs                     → { topologiaId, topologia, preconfig?, resetar? }  sobe/reconfigura
//   GET    /labs/:lab                → status dos nós e interfaces
//   DELETE /labs/:lab                → derruba
//   POST   /labs/:lab/ping           → { no, destino }
//   WS     /console                  → terminal real (ver console.js)

import http from "node:http";
import express from "express";
import { config } from "./config.js";
import { middlewareAuth } from "./auth.js";
import { subirLab, derrubarLab, statusLab, ping } from "./labs.js";
import { ErroTopologia } from "./topologia-para-clab.js";
import { ligarConsole } from "./console.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");

app.use((req, res, next) => {
  const origem = req.headers.origin;
  if (origem && config.origensPermitidas.includes(origem)) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "512kb" }));

app.get("/saude", (_req, res) => res.json({ ok: true, servico: "ccna-lab-agent" }));

app.use(middlewareAuth);

const rota = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    if (e instanceof ErroTopologia) return res.status(400).json({ erro: e.message });
    console.error(e);
    const detalhe = (e.stderr || e.message || "").toString().split("\n").filter(Boolean).slice(-4).join("\n");
    res.status(500).json({ erro: "Falha no agente.", detalhe });
  });

app.post("/labs", rota(async (req, res) => {
  const { topologiaId, topologia, preconfig, resetar } = req.body || {};
  res.json(await subirLab(topologia, { topologiaId, preconfig: !!preconfig, resetar: !!resetar }));
}));

app.get("/labs/:lab", rota(async (req, res) => res.json(await statusLab(req.params.lab))));

app.delete("/labs/:lab", rota(async (req, res) => res.json(await derrubarLab(req.params.lab))));

app.post("/labs/:lab/ping", rota(async (req, res) => {
  const { no, destino } = req.body || {};
  res.json(await ping(req.params.lab, String(no || ""), destino));
}));

const servidor = http.createServer(app);
ligarConsole(servidor);
servidor.listen(config.porta, config.host, () => {
  console.log(`[lab-agent] ouvindo em ${config.host}:${config.porta} — UIDs: ${config.uidsPermitidos.length}, MFA: ${config.exigirMfa}`);
});
