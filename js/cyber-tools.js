// cyber-tools.js
// Ferramentas de segurança — Fase 3. Tudo roda 100% no navegador, sem chamada
// externa: nenhum scanner de rede, nenhuma descoberta de hosts, nenhuma
// integração automática. Utilitários de estudo sobre entrada do próprio usuário.
//
// Carregado sob demanda por cyber.js quando a seção "Ferramentas" abre.

import { escapeHtml } from "./utils.js";

// ---------- Base64 ----------
function b64Encode(txt) {
  try {
    return btoa(unescape(encodeURIComponent(txt)));
  } catch {
    return "(não foi possível codificar)";
  }
}
function b64Decode(txt) {
  try {
    return decodeURIComponent(escape(atob(txt.trim())));
  } catch {
    return "(entrada não é Base64 válido)";
  }
}

// ---------- Hash (SHA via SubtleCrypto) ----------
async function calcularHash(txt, algo) {
  const buf = new TextEncoder().encode(txt);
  const digest = await crypto.subtle.digest(algo, buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Analisador de IP / URL (offline) ----------
function analisarIPv4(ip) {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return null;
  let tipo = "Público (roteável na internet)";
  if (o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168)) tipo = "Privado (RFC 1918) — não roteável na internet";
  else if (o[0] === 127) tipo = "Loopback (a própria máquina)";
  else if (o[0] === 169 && o[1] === 254) tipo = "Link-local / APIPA (falha de DHCP)";
  else if (o[0] >= 224 && o[0] <= 239) tipo = "Multicast";
  else if (o[0] >= 240) tipo = "Reservado / experimental";
  else if ((o[0] === 192 && o[1] === 0 && o[2] === 2) || (o[0] === 198 && o[1] === 51 && o[2] === 100) || (o[0] === 203 && o[1] === 0 && o[2] === 113))
    tipo = "Documentação (RFC 5737) — usado só em exemplos, nunca é um alvo real";
  return { octetos: o, tipo, binario: o.map((n) => n.toString(2).padStart(8, "0")).join(".") };
}

function analisarURL(str) {
  let u;
  try {
    u = new URL(str.trim());
  } catch {
    return null;
  }
  const partes = [];
  partes.push(["Esquema", u.protocol.replace(":", "") + (u.protocol === "https:" ? " (transporte cifrado)" : u.protocol === "http:" ? " (SEM cifra — dados em claro)" : "")]);
  partes.push(["Host", u.hostname]);
  if (u.port) partes.push(["Porta explícita", u.port]);
  if (u.username || u.password) partes.push(["⚠ Credenciais na URL", "userinfo presente — evite; vaza em logs e histórico"]);
  partes.push(["Caminho", u.pathname || "/"]);
  if (u.search) partes.push(["Query string", u.search.slice(1)]);
  if (u.hash) partes.push(["Fragmento", u.hash.slice(1)]);
  const ipHost = analisarIPv4(u.hostname);
  if (ipHost) partes.push(["Host é IP", ipHost.tipo]);
  return partes;
}

// ---------- Portas / protocolos (referência) ----------
const PORTAS = [
  ["20 / 21", "TCP", "FTP (dados / controle)", "Sem cifra. Preferir SFTP/FTPS."],
  ["22", "TCP", "SSH / SFTP", "Acesso remoto cifrado. Restringir origem, usar chave + MFA."],
  ["23", "TCP", "Telnet", "Texto claro — não usar. Substituir por SSH."],
  ["25", "TCP", "SMTP", "Envio de e-mail entre servidores."],
  ["53", "UDP/TCP", "DNS", "UDP p/ consultas, TCP p/ transferência de zona e respostas grandes."],
  ["67 / 68", "UDP", "DHCP (servidor / cliente)", "Broadcast — não roteia sem relay (ip helper-address)."],
  ["69", "UDP", "TFTP", "Simples, sem autenticação. Só em LAN confiável."],
  ["80", "TCP", "HTTP", "Sem cifra."],
  ["110 / 143", "TCP", "POP3 / IMAP", "Leitura de e-mail. Preferir as variantes sobre TLS (995 / 993)."],
  ["123", "UDP", "NTP", "Sincronização de relógio."],
  ["161 / 162", "UDP", "SNMP (poll / trap)", "SNMPv3 p/ autenticação e cifra."],
  ["389 / 636", "TCP", "LDAP / LDAPS", "Diretório. 636 é sobre TLS."],
  ["443", "TCP", "HTTPS", "HTTP sobre TLS."],
  ["445", "TCP", "SMB", "Compartilhamento Windows. Nunca expor à internet."],
  ["514", "UDP", "Syslog", "Coleta centralizada de logs."],
  ["3389", "TCP", "RDP", "Área de trabalho remota Windows. Atrás de VPN/bastion + MFA."],
];

// ---------- CVSS v3.1 (base score) ----------
// Fórmula da especificação pública do FIRST (first.org/cvss). Só o cálculo do
// base score — para estudar como severidade é derivada, não substitui o NVD.
const CVSS_METRICAS = {
  AV: { label: "Vetor de ataque", op: { N: ["Rede", 0.85], A: ["Adjacente", 0.62], L: ["Local", 0.55], P: ["Físico", 0.2] } },
  AC: { label: "Complexidade", op: { L: ["Baixa", 0.77], H: ["Alta", 0.44] } },
  PR: { label: "Privilégios necessários", op: { N: ["Nenhum", 0.85], L: ["Baixo", 0.62], H: ["Alto", 0.27] } },
  UI: { label: "Interação do usuário", op: { N: ["Nenhuma", 0.85], R: ["Requerida", 0.62] } },
  S: { label: "Escopo", op: { U: ["Inalterado", "U"], C: ["Alterado", "C"] } },
  C: { label: "Impacto — Confidencialidade", op: { H: ["Alto", 0.56], L: ["Baixo", 0.22], N: ["Nenhum", 0] } },
  I: { label: "Impacto — Integridade", op: { H: ["Alto", 0.56], L: ["Baixo", 0.22], N: ["Nenhum", 0] } },
  A: { label: "Impacto — Disponibilidade", op: { H: ["Alto", 0.56], L: ["Baixo", 0.22], N: ["Nenhum", 0] } },
};

function roundUp1(x) {
  return Math.ceil(x * 10) / 10;
}

function cvssBase(sel) {
  const av = CVSS_METRICAS.AV.op[sel.AV][1];
  const ac = CVSS_METRICAS.AC.op[sel.AC][1];
  let pr = CVSS_METRICAS.PR.op[sel.PR][1];
  if (sel.S === "C") pr = { 0.62: 0.68, 0.27: 0.5 }[pr] ?? pr;
  const ui = CVSS_METRICAS.UI.op[sel.UI][1];
  const c = CVSS_METRICAS.C.op[sel.C][1];
  const i = CVSS_METRICAS.I.op[sel.I][1];
  const a = CVSS_METRICAS.A.op[sel.A][1];

  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  let impact;
  if (sel.S === "U") impact = 6.42 * iscBase;
  // CVSS v3.1: expoente 13 e fator 0.9731 no termo de escopo alterado (na v3.0 era ^15 sem o fator).
  else impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase * 0.9731 - 0.02, 13);
  const exploit = 8.22 * av * ac * pr * ui;

  let score;
  if (impact <= 0) score = 0;
  else if (sel.S === "U") score = roundUp1(Math.min(impact + exploit, 10));
  else score = roundUp1(Math.min(1.08 * (impact + exploit), 10));

  let sev = "Nenhuma";
  if (score >= 9) sev = "Crítica";
  else if (score >= 7) sev = "Alta";
  else if (score >= 4) sev = "Média";
  else if (score > 0) sev = "Baixa";
  const vetor = `CVSS:3.1/AV:${sel.AV}/AC:${sel.AC}/PR:${sel.PR}/UI:${sel.UI}/S:${sel.S}/C:${sel.C}/I:${sel.I}/A:${sel.A}`;
  return { score: score.toFixed(1), sev, vetor };
}

// ---------- RENDER ----------
const FERRAMENTAS = [
  { id: "base64", nome: "Base64", desc: "Codificar / decodificar" },
  { id: "hash", nome: "Hash", desc: "SHA-256 / 384 / 512" },
  { id: "ipurl", nome: "Analisador IP / URL", desc: "Classificar e explicar" },
  { id: "portas", nome: "Portas e protocolos", desc: "Referência rápida" },
  { id: "cvss", nome: "Calculadora CVSS 3.1", desc: "Base score" },
];

export function renderFerramentas(raiz) {
  raiz.innerHTML = `
    <div class="cyber-tools-abas" id="cyber-tools-abas">
      ${FERRAMENTAS.map((f, i) => `<button class="cyber-tool-aba ${i === 0 ? "selecionada" : ""}" data-tool="${f.id}">${escapeHtml(f.nome)}</button>`).join("")}
    </div>
    <div id="cyber-tool-painel" class="cyber-tool-painel"></div>`;

  const abas = raiz.querySelector("#cyber-tools-abas");
  abas.addEventListener("click", (e) => {
    const b = e.target.closest(".cyber-tool-aba");
    if (!b) return;
    abas.querySelectorAll(".cyber-tool-aba").forEach((x) => x.classList.toggle("selecionada", x === b));
    montarFerramenta(b.dataset.tool, raiz.querySelector("#cyber-tool-painel"));
  });
  montarFerramenta("base64", raiz.querySelector("#cyber-tool-painel"));
}

function montarFerramenta(id, el) {
  if (id === "base64") {
    el.innerHTML = `
      <label class="cyber-tool-label">Texto</label>
      <textarea id="t-b64-in" class="cyber-lab-conclusao" rows="3" placeholder="Digite ou cole aqui…"></textarea>
      <div class="cyber-tool-acoes">
        <button class="btn-secondary" id="t-b64-enc">Codificar →</button>
        <button class="btn-secondary" id="t-b64-dec">← Decodificar</button>
      </div>
      <label class="cyber-tool-label">Resultado</label>
      <textarea id="t-b64-out" class="cyber-lab-conclusao" rows="3" readonly></textarea>`;
    el.querySelector("#t-b64-enc").onclick = () => (el.querySelector("#t-b64-out").value = b64Encode(el.querySelector("#t-b64-in").value));
    el.querySelector("#t-b64-dec").onclick = () => (el.querySelector("#t-b64-out").value = b64Decode(el.querySelector("#t-b64-in").value));
    return;
  }

  if (id === "hash") {
    el.innerHTML = `
      <label class="cyber-tool-label">Conteúdo</label>
      <textarea id="t-h-in" class="cyber-lab-conclusao" rows="3" placeholder="O conteúdo não sai do navegador."></textarea>
      <div class="cyber-tool-acoes">
        <button class="btn-secondary" data-algo="SHA-256">SHA-256</button>
        <button class="btn-secondary" data-algo="SHA-384">SHA-384</button>
        <button class="btn-secondary" data-algo="SHA-512">SHA-512</button>
      </div>
      <label class="cyber-tool-label">Digest (hex)</label>
      <textarea id="t-h-out" class="cyber-lab-conclusao cyber-tool-mono" rows="3" readonly></textarea>`;
    el.querySelectorAll("[data-algo]").forEach((b) => {
      b.onclick = async () => {
        el.querySelector("#t-h-out").value = "calculando…";
        el.querySelector("#t-h-out").value = await calcularHash(el.querySelector("#t-h-in").value, b.dataset.algo);
      };
    });
    return;
  }

  if (id === "ipurl") {
    el.innerHTML = `
      <label class="cyber-tool-label">IP ou URL</label>
      <input id="t-ip-in" class="cyber-tool-input" placeholder="Ex.: 10.20.0.10  ou  https://exemplo.test/login?u=1" />
      <button class="btn-secondary" id="t-ip-go" style="margin-top:8px;">Analisar</button>
      <div id="t-ip-out" class="cyber-tool-resultado"></div>`;
    el.querySelector("#t-ip-go").onclick = () => {
      const v = el.querySelector("#t-ip-in").value.trim();
      const out = el.querySelector("#t-ip-out");
      const ip = analisarIPv4(v);
      if (ip) {
        out.innerHTML = `<table class="cyber-tool-tabela">
          <tr><td>Tipo</td><td>${escapeHtml(ip.tipo)}</td></tr>
          <tr><td>Binário</td><td class="cyber-tool-mono">${ip.binario}</td></tr></table>`;
        return;
      }
      const url = analisarURL(v);
      if (url) {
        out.innerHTML = `<table class="cyber-tool-tabela">${url.map(([k, val]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(val))}</td></tr>`).join("")}</table>`;
        return;
      }
      out.innerHTML = `<p style="color:var(--terracotta); font-size:13px;">Não reconheci como IPv4 nem como URL válida.</p>`;
    };
    return;
  }

  if (id === "portas") {
    el.innerHTML = `<div class="cyber-tool-scroll"><table class="cyber-tool-tabela cyber-tool-portas">
      <tr><th>Porta</th><th>Proto</th><th>Serviço</th><th>Nota de segurança</th></tr>
      ${PORTAS.map((p) => `<tr><td class="cyber-tool-mono">${p[0]}</td><td>${p[1]}</td><td>${escapeHtml(p[2])}</td><td>${escapeHtml(p[3])}</td></tr>`).join("")}
    </table></div>`;
    return;
  }

  if (id === "cvss") {
    const sel = { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "H", I: "H", A: "H" };
    const grupos = Object.entries(CVSS_METRICAS)
      .map(
        ([k, m]) => `
      <div class="cyber-cvss-grupo">
        <span class="cyber-tool-label">${escapeHtml(m.label)}</span>
        <div class="cyber-cvss-ops" data-metrica="${k}">
          ${Object.entries(m.op).map(([code, [nome]]) => `<button class="cyber-cvss-op ${sel[k] === code ? "selecionada" : ""}" data-code="${code}">${escapeHtml(nome)}</button>`).join("")}
        </div>
      </div>`
      )
      .join("");
    el.innerHTML = `${grupos}<div id="t-cvss-out" class="cyber-cvss-out"></div>`;
    const atualizar = () => {
      const r = cvssBase(sel);
      el.querySelector("#t-cvss-out").innerHTML = `
        <div class="cyber-cvss-score">${r.score}</div>
        <div><strong>${escapeHtml(r.sev)}</strong></div>
        <div class="cyber-tool-mono" style="font-size:11px; margin-top:6px;">${escapeHtml(r.vetor)}</div>`;
    };
    el.querySelectorAll(".cyber-cvss-ops").forEach((grp) => {
      grp.addEventListener("click", (e) => {
        const b = e.target.closest(".cyber-cvss-op");
        if (!b) return;
        sel[grp.dataset.metrica] = b.dataset.code;
        grp.querySelectorAll(".cyber-cvss-op").forEach((x) => x.classList.toggle("selecionada", x === b));
        atualizar();
      });
    });
    atualizar();
    return;
  }
}

// Verificação de resposta de CTF (normalização simples).
export function conferirRespostaCtf(entrada, respostas) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.,;:!?]+$/g, "");
  const alvo = norm(entrada);
  return (respostas || []).some((r) => norm(r) === alvo);
}
