// lab-real.js
// "Lab Real": sobe a topologia desenhada no módulo Topologia como equipamentos
// de verdade (FRRouting + Linux) numa VM, via agente (pasta lab-agent/ do repo).
//
// Fluxo: app → HTTPS (ID token do Firebase) → agente → Containerlab → containers.
// Este módulo: painel de controle, status ao vivo no canvas, teste de ping e
// console real (xterm.js, carregado só quando abre um terminal).

import { auth } from "./firebase-config.js";
import { escapeHtml } from "./utils.js";
import { LAB_AGENT_URL } from "./lab-config.js";
import { aoRenderizarTopologia, obterTopologiaAtual } from "./topology.js";

const AGENTE = (LAB_AGENT_URL || "").replace(/\/+$/, "");
const INTERVALO_STATUS_MS = 8000;

const estado = {
  status: null, // resposta de GET /labs/:lab
  ocupado: null, // "subindo" | "derrubando" | null
  erro: null,
  agenteOnline: null,
  timer: null,
  ultimoTopologiaId: null,
};

let iniciado = false;

// ---------- utilidades ----------

export function nomeDoLab(topologiaId) {
  const limpo = String(topologiaId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return limpo ? `ccna-${limpo}` : null;
}

async function api(metodo, caminho, corpo) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("Faça login de novo.");
  const token = await usuario.getIdToken();
  const resp = await fetch(AGENTE + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error([dados.erro || `Erro ${resp.status}`, dados.detalhe].filter(Boolean).join("\n"));
  return dados;
}

const $ = (id) => document.getElementById(id);

// ---------- inicialização ----------

export function initLabReal() {
  if (iniciado) return;
  iniciado = true;

  $("topo-btn-lab-real")?.addEventListener("click", abrirPainel);
  $("lab-real-fechar")?.addEventListener("click", fecharPainel);
  $("lab-real-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "lab-real-modal") fecharPainel();
  });
  $("lab-console-fechar")?.addEventListener("click", fecharConsole);

  aoRenderizarTopologia(decorarCanvas);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && estado.status?.noAr) atualizarStatus();
  });
}

function abrirPainel() {
  $("lab-real-modal").classList.remove("hidden");
  renderPainel();
  if (AGENTE) atualizarStatus();
}

function fecharPainel() {
  $("lab-real-modal").classList.add("hidden");
}

// ---------- status ----------

async function atualizarStatus() {
  const { topologiaId } = obterTopologiaAtual();
  const lab = nomeDoLab(topologiaId);
  if (!AGENTE || !lab) {
    estado.status = null;
    renderPainel();
    return;
  }
  try {
    estado.status = await api("GET", `/labs/${lab}`);
    estado.agenteOnline = true;
    estado.erro = null;
  } catch (e) {
    estado.agenteOnline = !/Failed to fetch|NetworkError|Load failed/i.test(e.message);
    estado.erro = estado.agenteOnline ? e.message : "Não consegui falar com o agente. A VM está ligada?";
  }
  agendarProximoStatus();
  renderPainel();
  redecorar();
}

function agendarProximoStatus() {
  clearTimeout(estado.timer);
  if (estado.status?.noAr || estado.ocupado) {
    estado.timer = setTimeout(() => {
      if (document.visibilityState === "visible") atualizarStatus();
      else agendarProximoStatus();
    }, INTERVALO_STATUS_MS);
  }
}

// ---------- ações ----------

async function subirLab() {
  const { topologia, topologiaId } = obterTopologiaAtual();
  if (!topologiaId) return alert("Salve a topologia antes de subir o lab.");
  const resetar = $("lab-real-resetar")?.checked;
  if (resetar && !confirm("Começar do zero apaga as configs que você salvou (write memory) neste lab. Continuar?")) return;

  estado.ocupado = "subindo";
  estado.erro = null;
  renderPainel();
  try {
    const r = await api("POST", "/labs", {
      topologiaId,
      topologia,
      preconfig: $("lab-real-preconfig")?.checked,
      resetar,
    });
    estado.status = r.status ? { ...r.status, mapa: r.mapa, avisos: r.avisos } : null;
  } catch (e) {
    estado.erro = e.message;
  } finally {
    estado.ocupado = null;
  }
  await atualizarStatus();
}

async function derrubarLab() {
  const lab = nomeDoLab(obterTopologiaAtual().topologiaId);
  if (!lab || !confirm("Derrubar o lab? O que você salvou com \"write memory\" volta na próxima vez que subir.")) return;
  estado.ocupado = "derrubando";
  renderPainel();
  try {
    await api("DELETE", `/labs/${lab}`);
  } catch (e) {
    estado.erro = e.message;
  } finally {
    estado.ocupado = null;
  }
  await atualizarStatus();
}

async function testarPing() {
  const lab = nomeDoLab(obterTopologiaAtual().topologiaId);
  const no = $("lab-real-ping-no").value;
  const destino = $("lab-real-ping-destino").value.trim();
  const saida = $("lab-real-ping-saida");
  saida.textContent = `ping ${destino} a partir de ${no}…`;
  saida.className = "lab-real-ping-saida";
  try {
    const r = await api("POST", `/labs/${lab}/ping`, { no, destino });
    saida.textContent = r.saida.trim() || "(sem saída)";
    saida.classList.add(r.ok ? "ok" : "falha");
  } catch (e) {
    saida.textContent = e.message;
    saida.classList.add("falha");
  }
}

// ---------- render do painel ----------

function renderPainel() {
  const corpo = $("lab-real-corpo");
  if (!corpo) return;
  const { topologia, topologiaId, temAlteracoesNaoSalvas } = obterTopologiaAtual();

  if (!AGENTE) {
    corpo.innerHTML = renderSemAgente();
    $("lab-real-copiar-uid")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(auth.currentUser?.uid || "");
      $("lab-real-copiar-uid").textContent = "Copiado ✓";
    });
    return;
  }
  if (!topologiaId) {
    corpo.innerHTML = `<p class="topo-empty">Salve a topologia primeiro (botão <strong>Salvar</strong>) — o lab real usa o ID dela.</p>`;
    return;
  }

  const st = estado.status;
  const noAr = !!st?.noAr;
  const ocupado = estado.ocupado || (st?.processando ? "processando" : null);
  const textoOcupado = { subindo: "Subindo os equipamentos… (30–90 s)", derrubando: "Derrubando…", processando: "O agente está processando este lab…" }[ocupado];

  const linhaEstado = ocupado
    ? `<span class="lab-real-pill amber">● ${textoOcupado}</span>`
    : estado.agenteOnline === false
      ? `<span class="lab-real-pill red">● Agente fora do ar</span>`
      : noAr
        ? `<span class="lab-real-pill green">● Lab no ar</span>`
        : `<span class="lab-real-pill">○ Lab desligado</span>`;

  const nos = (st?.nos || []).slice().sort((a, b) => a.no.localeCompare(b.no));
  const papelPorNo = Object.fromEntries(Object.values(st?.mapa || {}).map((m) => [m.no, m]));

  corpo.innerHTML = `
    <div class="lab-real-topo">
      ${linhaEstado}
      <button class="btn-secondary lab-real-mini" id="lab-real-atualizar" ${ocupado ? "disabled" : ""}>↻ Atualizar</button>
    </div>
    ${temAlteracoesNaoSalvas && noAr ? `<p class="lab-real-aviso">Você mudou a topologia. Clique em <strong>Subir / aplicar</strong> de novo pra refletir no lab.</p>` : ""}
    ${estado.erro ? `<pre class="lab-real-erro">${escapeHtml(estado.erro)}</pre>` : ""}
    ${(st?.avisos || []).map((a) => `<p class="lab-real-aviso">${escapeHtml(a)}</p>`).join("")}

    <div class="lab-real-acoes">
      <button class="btn-primary" id="lab-real-subir" ${ocupado ? "disabled" : ""}>${noAr ? "▶ Subir / aplicar mudanças" : "▶ Subir lab"}</button>
      <button class="btn-secondary" id="lab-real-derrubar" ${!noAr || ocupado ? "disabled" : ""}>■ Derrubar</button>
    </div>
    <details class="lab-real-opcoes">
      <summary>Opções</summary>
      <label><input type="checkbox" id="lab-real-preconfig" /> Pré-configurar os IPs das interfaces dos roteadores (senão você configura tudo na mão)</label>
      <label><input type="checkbox" id="lab-real-resetar" /> Começar do zero (apaga configs salvas com write memory)</label>
    </details>

    ${nos.length ? `
      <h3 class="lab-real-h3">Equipamentos</h3>
      <div class="lab-real-nos">
        ${nos.map((n) => renderNo(n, papelPorNo[n.no])).join("")}
      </div>

      <h3 class="lab-real-h3">Testar conectividade</h3>
      <div class="lab-real-ping">
        <select id="lab-real-ping-no">${nos.filter((n) => n.rodando).map((n) => `<option>${escapeHtml(n.no)}</option>`).join("")}</select>
        <input id="lab-real-ping-destino" type="text" inputmode="decimal" placeholder="IP de destino" />
        <button class="btn-secondary lab-real-mini" id="lab-real-ping-btn">Ping</button>
      </div>
      <pre id="lab-real-ping-saida" class="lab-real-ping-saida"></pre>
    ` : `<p class="topo-empty" style="margin-top:12px;">Nenhum equipamento no ar para esta topologia (${escapeHtml(topologia.dispositivos.length + " no desenho")}).</p>`}

    ${renderColaFrr()}
  `;

  $("lab-real-atualizar")?.addEventListener("click", atualizarStatus);
  $("lab-real-subir")?.addEventListener("click", subirLab);
  $("lab-real-derrubar")?.addEventListener("click", derrubarLab);
  $("lab-real-ping-btn")?.addEventListener("click", testarPing);
  $("lab-real-ping-destino")?.addEventListener("keydown", (e) => e.key === "Enter" && testarPing());
  corpo.querySelectorAll("[data-console]").forEach((b) =>
    b.addEventListener("click", () => abrirConsole(b.dataset.console, b.dataset.shell))
  );
}

const ROTULO_PAPEL = { frr: "Roteador (FRR)", switch: "Switch (bridge Linux)", host: "Host Linux" };

function renderNo(n, info) {
  const papel = info?.papel;
  const nomeAppPorEth = Object.fromEntries(Object.entries(info?.interfaces || {}).map(([app, eth]) => [eth, app]));
  const ifs = Object.entries(n.interfaces || {})
    .sort((a, b) => Number(a[0].slice(3)) - Number(b[0].slice(3)))
    .map(([eth, est]) => {
      const app = nomeAppPorEth[eth];
      return `<span class="lab-real-if ${est === "up" ? "up" : "down"}" title="${escapeHtml(est)}">${app ? `${escapeHtml(app)} = ` : ""}${eth}</span>`;
    })
    .join("");
  return `
    <div class="lab-real-no">
      <div class="lab-real-no-cab">
        <span class="lab-real-dot ${n.rodando ? "on" : "off"}"></span>
        <strong>${escapeHtml(n.no)}</strong>
        <span class="lab-real-papel">${ROTULO_PAPEL[papel] || ""}</span>
      </div>
      <div class="lab-real-ifs">${ifs || '<span class="lab-real-papel">sem links</span>'}</div>
      ${n.rodando ? `
        <div class="lab-real-no-acoes">
          <button class="btn-secondary lab-real-mini" data-console="${escapeHtml(n.no)}" data-shell="cli">${papel === "frr" ? "Console (vtysh)" : "Terminal"}</button>
          ${papel === "frr" ? `<button class="btn-secondary lab-real-mini" data-console="${escapeHtml(n.no)}" data-shell="sh">Shell Linux</button>` : ""}
        </div>` : ""}
    </div>`;
}

function renderSemAgente() {
  const uid = auth.currentUser?.uid || "(faça login)";
  return `
    <p>O Lab Real roda numa VM sua na Oracle Cloud (grátis). Falta conectar o app a ela:</p>
    <ol class="lab-real-passos">
      <li>Crie a VM e rode o <code>lab-agent/setup.sh</code> (instruções em <code>lab-agent/README.md</code>).</li>
      <li>Ele pede o seu UID do Firebase:
        <div class="lab-real-uid"><code>${escapeHtml(uid)}</code><button class="btn-secondary lab-real-mini" id="lab-real-copiar-uid">Copiar</button></div>
      </li>
      <li>No final ele mostra um endereço <code>https://…sslip.io</code>. Coloque em <code>js/lab-config.js</code> e publique.</li>
    </ol>`;
}

function renderColaFrr() {
  return `
    <details class="lab-real-opcoes">
      <summary>Cola: IOS → FRR (vtysh)</summary>
      <pre class="lab-real-cola">enable / conf t / end / exit      → iguais ao IOS
interface G0/0                    → interface eth1  (veja o mapa acima)
ip address 10.0.0.1 255.255.255.252 → ip address 10.0.0.1/30
no shutdown                       → no shutdown
router ospf 1 / network … area 0  → router ospf / network 10.0.0.0/30 area 0
ip route 0.0.0.0 0.0.0.0 10.0.0.2 → ip route 0.0.0.0/0 10.0.0.2
show ip route / show ip ospf neighbor / show run → iguais
copy run start                    → write memory
ping (no roteador)                → use "Shell Linux" ou o teste de ping acima

PCs (Terminal): ip addr · ip route · ping 10.0.0.1 · traceroute 10.0.0.1</pre>
    </details>`;
}

// ---------- status pintado no canvas ----------

function redecorar() {
  const canvas = $("topo-canvas");
  const svg = $("topo-svg-links");
  if (!canvas || !svg) return;
  const { topologia, topologiaId } = obterTopologiaAtual();
  decorarCanvas({ canvas, svg, topologia, topologiaId });
}

function decorarCanvas({ canvas, svg, topologia, topologiaId }) {
  if (topologiaId !== estado.ultimoTopologiaId) {
    estado.ultimoTopologiaId = topologiaId;
    estado.status = null;
    estado.erro = null;
    if (AGENTE && topologiaId) setTimeout(atualizarStatus, 0);
  }

  const st = estado.status;
  const valido = st && st.lab === nomeDoLab(topologiaId) && st.noAr;
  const nosPorNome = Object.fromEntries((st?.nos || []).map((n) => [n.no, n]));

  canvas.querySelectorAll(".topo-node").forEach((elNo) => {
    elNo.classList.remove("lab-on", "lab-off");
    if (!valido) return;
    const info = st.mapa?.[elNo.dataset.id];
    if (!info) return;
    elNo.classList.add(nosPorNome[info.no]?.rodando ? "lab-on" : "lab-off");
  });

  svg.querySelectorAll(".topo-link").forEach((g) => {
    g.classList.remove("lab-link-up", "lab-link-down");
    if (!valido) return;
    const c = topologia.conexoes.find((x) => x.id === g.dataset.id);
    if (!c) return;
    const lado = (devId, nomeIf) => {
      const info = st.mapa?.[devId];
      const eth = info?.interfaces?.[nomeIf];
      return info && eth ? nosPorNome[info.no]?.interfaces?.[eth] : undefined;
    };
    const a = lado(c.origemId, c.origemInterface);
    const b = lado(c.destinoId, c.destinoInterface);
    if (a === undefined || b === undefined) return;
    g.classList.add(a === "up" && b === "up" ? "lab-link-up" : "lab-link-down");
  });
}

// ---------- console real (xterm.js) ----------

let sessaoConsole = null;

async function carregarXterm() {
  if (!document.getElementById("xterm-css")) {
    const link = document.createElement("link");
    link.id = "xterm-css";
    link.rel = "stylesheet";
    link.href = "js/vendor/xterm/xterm.css";
    document.head.appendChild(link);
  }
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("./vendor/xterm/xterm.mjs"),
    import("./vendor/xterm/addon-fit.mjs"),
  ]);
  return { Terminal, FitAddon };
}

async function abrirConsole(no, shell) {
  fecharConsole();
  const lab = nomeDoLab(obterTopologiaAtual().topologiaId);
  $("lab-console-titulo").textContent = `${no} — ${shell === "sh" ? "shell Linux" : "console"}`;
  $("lab-console-modal").classList.remove("hidden");
  const alvo = $("lab-console-terminal");
  alvo.innerHTML = "";

  const { Terminal, FitAddon } = await carregarXterm();
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace',
    theme: { background: "#1B2226", foreground: "#E5E9EA", cursor: "#7FAE8C", selectionBackground: "#3E6B6B" },
    scrollback: 3000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(alvo);
  fit.fit();
  term.writeln("\x1b[90mConectando…\x1b[0m");

  const ws = new WebSocket(AGENTE.replace(/^http/, "ws") + "/console");
  const enviar = (obj) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(obj));
  const redimensionar = () => {
    fit.fit();
    enviar({ t: "resize", cols: term.cols, rows: term.rows });
  };

  ws.onopen = async () => {
    const token = await auth.currentUser?.getIdToken();
    enviar({ t: "auth", token, lab, no, shell });
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.t === "out") term.write(msg.d);
    else if (msg.t === "pronto") {
      term.reset();
      redimensionar();
      term.focus();
      if (msg.ehFrr && shell !== "sh") enviar({ t: "in", d: "\r" });
    } else if (msg.t === "erro") term.writeln(`\r\n\x1b[31m${msg.msg}\x1b[0m`);
    else if (msg.t === "fim") term.writeln("\r\n\x1b[90m[sessão encerrada]\x1b[0m");
  };
  ws.onclose = () => term.writeln("\r\n\x1b[90m[desconectado]\x1b[0m");
  ws.onerror = () => term.writeln("\r\n\x1b[31mFalha na conexão com o agente.\x1b[0m");

  term.onData((d) => enviar({ t: "in", d }));
  const ro = new ResizeObserver(() => redimensionar());
  ro.observe(alvo);

  // teclas que o teclado do celular não tem
  $("lab-console-teclas").querySelectorAll("[data-tecla]").forEach((b) => {
    b.onclick = () => {
      enviar({ t: "in", d: JSON.parse(`"${b.dataset.tecla}"`) });
      term.focus();
    };
  });

  sessaoConsole = { term, ws, ro };
}

function fecharConsole() {
  if (sessaoConsole) {
    sessaoConsole.ro.disconnect();
    sessaoConsole.ws.close();
    sessaoConsole.term.dispose();
    sessaoConsole = null;
  }
  $("lab-console-modal")?.classList.add("hidden");
}
