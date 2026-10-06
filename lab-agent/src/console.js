// console.js — terminal real de um nó via WebSocket.
//
// Protocolo (tudo JSON):
//   cliente → {t:"auth", token, lab, no, shell:"cli"|"sh"}   (primeira mensagem, obrigatória)
//   cliente → {t:"in", d:"texto digitado"} | {t:"resize", cols, rows}
//   servidor → {t:"out", d:"..."} | {t:"pronto"} | {t:"erro", msg} | {t:"fim"}
// O token vai na 1ª mensagem (e não na URL) pra não aparecer em logs de proxy.

import { WebSocketServer } from "ws";
import { verificarToken } from "./auth.js";
import { config } from "./config.js";
import { containerDoNo, validarLab } from "./labs.js";

export function ligarConsole(servidorHttp) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  servidorHttp.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname !== "/console" || !config.origensPermitidas.includes(req.headers.origin)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => sessao(ws));
  });
}

function sessao(ws) {
  const enviar = (obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));
  let stream = null;
  let exec = null;
  const limiteAuth = setTimeout(() => ws.close(4001, "sem auth"), 10_000);

  ws.on("message", async (bruto) => {
    let msg;
    try {
      msg = JSON.parse(bruto.toString());
    } catch {
      return;
    }

    if (!stream) {
      if (msg.t !== "auth") return ws.close(4001, "auth primeiro");
      clearTimeout(limiteAuth);
      try {
        await verificarToken(msg.token);
        validarLab(msg.lab);
        const container = await containerDoNo(msg.lab, String(msg.no || ""));
        if (!container) throw new Error("Equipamento não encontrado (o lab está no ar?).");
        const info = await container.inspect();
        const ehFrr = /frrouting\/frr/.test(info.Config.Image);
        const cmd = msg.shell === "sh" || !ehFrr ? ["sh", "-c", "command -v bash >/dev/null && exec bash -l || exec sh -l"] : ["vtysh"];
        exec = await container.exec({
          Cmd: cmd,
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Env: ["TERM=xterm-256color"],
        });
        stream = await exec.start({ hijack: true, stdin: true, Tty: true });
        stream.on("data", (b) => enviar({ t: "out", d: b.toString("utf8") }));
        stream.on("end", () => {
          enviar({ t: "fim" });
          ws.close(1000);
        });
        enviar({ t: "pronto", ehFrr });
      } catch (e) {
        enviar({ t: "erro", msg: e.message });
        ws.close(4003);
      }
      return;
    }

    if (msg.t === "in" && typeof msg.d === "string") stream.write(msg.d);
    if (msg.t === "resize" && exec) {
      const w = Math.min(Math.max(Number(msg.cols) || 80, 20), 400);
      const h = Math.min(Math.max(Number(msg.rows) || 24, 5), 200);
      exec.resize({ w, h }).catch(() => {});
    }
  });

  ws.on("close", () => {
    clearTimeout(limiteAuth);
    if (stream) stream.end();
  });
}
