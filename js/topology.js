// topology.js
// Editor visual de topologias de rede (módulo "Topologia").
//
// FASE 1 (esta versão): montagem, documentação e armazenamento de laboratórios.
// Não emula equipamentos — os campos de config (OSPF, VLANs, etc.) servem só
// como documentação por enquanto.
//
// Estrutura de dados pensada para reaproveitar no futuro (integração com
// EVE-NG/PNETLab/CML e modo de estudo/desafios):
//   topologia = {
//     nome: string,
//     mostrarInterfaces: boolean,
//     dispositivos: [{ id, tipo, nome, x, y, tamanho, propriedades: {...} }],
//     conexoes: [{ id, origemId, origemInterface, destinoId, destinoInterface }],
//   }

import {
  criarTopologia,
  atualizarTopologia,
  listarTopologias,
  getTopologia,
  excluirTopologia,
} from "./data-schema.js";

// ---------- TIPOS DE EQUIPAMENTO ----------

export const TIPOS_EQUIPAMENTO = {
  router: {
    label: "Router",
    cor: "var(--teal)",
    icone: `<circle cx="12" cy="12" r="9"/><path d="M7 12h10M7 9h6M7 15h4"/>`,
  },
  switchL2: {
    label: "Switch L2",
    cor: "var(--sage)",
    icone: `<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 17v3M12 17v3M18 17v3"/>`,
  },
  switchL3: {
    label: "Switch L3",
    cor: "var(--sage)",
    icone: `<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 17v3M12 17v3M18 17v3"/><circle cx="12" cy="12" r="2"/>`,
  },
  firewall: {
    label: "Firewall",
    cor: "var(--terracotta)",
    icone: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7c-1.6 2-3 2.9-3 5a3 3 0 0 0 6 0c0-1-.9-1.4-1-2.6 0 .9-1 1.3-1 1.8a.9.9 0 0 1-1-1.8c0-1 .5-1.4 0-2.4z"/>`,
  },
  ap: {
    label: "Access Point",
    cor: "var(--amber)",
    icone: `<circle cx="12" cy="18" r="1.4"/><path d="M8.3 15a5.2 5.2 0 0 1 7.4 0"/><path d="M5 11.6a9.4 9.4 0 0 1 14 0"/>`,
  },
  pc: {
    label: "PC",
    cor: "var(--ink-soft)",
    icone: `<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>`,
  },
  laptop: {
    label: "Laptop",
    cor: "var(--ink-soft)",
    icone: `<rect x="5" y="4" width="14" height="9" rx="1"/><path d="M2 18h20l-1.6-3H3.6z"/>`,
  },
  server: {
    label: "Server",
    cor: "var(--teal)",
    icone: `<rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="12" width="16" height="6" rx="1"/><circle cx="7.5" cy="6" r=".8" fill="currentColor"/><circle cx="7.5" cy="15" r=".8" fill="currentColor"/>`,
  },
  cloud: {
    label: "Cloud / Internet",
    cor: "var(--ink-soft)",
    icone: `<path d="M7 17a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-1.9A4.5 4.5 0 0 1 17 17H7z"/>`,
  },
};

// ---------- TEMPLATES CCNA (Fase 1: subset inicial) ----------

export const TEMPLATES = {
  vlanTrunk: {
    nome: "VLAN e Trunk",
    dispositivos: [
      { id: "d1", tipo: "switchL2", nome: "SW1", x: 260, y: 80, tamanho: 1, propriedades: { vlans: "10 (Vendas), 20 (TI)" } },
      { id: "d2", tipo: "pc", nome: "PC-Vendas", x: 100, y: 220, tamanho: 1, propriedades: { vlan: "10" } },
      { id: "d3", tipo: "pc", nome: "PC-TI", x: 420, y: 220, tamanho: 1, propriedades: { vlan: "20" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "F0/1", destinoId: "d2", destinoInterface: "NIC" },
      { id: "c2", origemId: "d1", origemInterface: "F0/2", destinoId: "d3", destinoInterface: "NIC" },
    ],
  },
  routerOnAStick: {
    nome: "Router-on-a-Stick",
    dispositivos: [
      { id: "d1", tipo: "router", nome: "R1", x: 260, y: 60, tamanho: 1, propriedades: { descricao: "Subinterfaces G0/0.10 (VLAN10) e G0/0.20 (VLAN20)" } },
      { id: "d2", tipo: "switchL2", nome: "SW1", x: 260, y: 200, tamanho: 1, propriedades: { trunks: "G0/1 trunk para R1" } },
      { id: "d3", tipo: "pc", nome: "PC-VLAN10", x: 100, y: 340, tamanho: 1, propriedades: { vlan: "10" } },
      { id: "d4", tipo: "pc", nome: "PC-VLAN20", x: 420, y: 340, tamanho: 1, propriedades: { vlan: "20" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "G0/0", destinoId: "d2", destinoInterface: "G0/1" },
      { id: "c2", origemId: "d2", origemInterface: "F0/1", destinoId: "d3", destinoInterface: "NIC" },
      { id: "c3", origemId: "d2", origemInterface: "F0/2", destinoId: "d4", destinoInterface: "NIC" },
    ],
  },
  ospf: {
    nome: "OSPF (3 roteadores)",
    dispositivos: [
      { id: "d1", tipo: "router", nome: "R1", x: 120, y: 80, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 1.1.1.1" } },
      { id: "d2", tipo: "router", nome: "R2", x: 380, y: 80, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 2.2.2.2" } },
      { id: "d3", tipo: "router", nome: "R3", x: 250, y: 260, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 3.3.3.3" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "G0/0", destinoId: "d2", destinoInterface: "G0/0" },
      { id: "c2", origemId: "d1", origemInterface: "G0/1", destinoId: "d3", destinoInterface: "G0/0" },
      { id: "c3", origemId: "d2", origemInterface: "G0/1", destinoId: "d3", destinoInterface: "G0/1" },
    ],
  },
};

// ---------- ESTADO EM MEMÓRIA ----------

let uidAtual = null;
let topologiaId = null;
let topologia = topologiaVazia();
let dispositivoSelecionadoId = null;
let modoConexao = false;
let origemConexaoId = null;
let arrastando = null; // { id, offsetX, offsetY } — dispositivo sendo movido
let contadorId = 1;

function topologiaVazia(nome = "Sem título") {
  return { nome, mostrarInterfaces: true, dispositivos: [], conexoes: [] };
}

function novoId(prefixo) {
  contadorId += 1;
  return `${prefixo}_${Date.now().toString(36)}${contadorId}`;
}

// ---------- INICIALIZAÇÃO ----------

export function initTopologia(uid) {
  uidAtual = uid;
  cachearElementos();
  montarPaleta();
  ligarEventosTopbar();
  ligarEventosCanvas();
  renderTudo();
}

let el = {};
function cachearElementos() {
  el.canvas = document.getElementById("topo-canvas");
  el.svg = document.getElementById("topo-svg-links");
  el.paleta = document.getElementById("topo-paleta");
  el.propriedades = document.getElementById("topo-propriedades");
  el.nomeAtual = document.getElementById("topo-nome-atual");
  el.wrapper = document.getElementById("topo-canvas-wrapper");
}

// ---------- PALETA (barra lateral de equipamentos) ----------

function montarPaleta() {
  el.paleta.innerHTML = Object.entries(TIPOS_EQUIPAMENTO)
    .map(
      ([tipo, def]) => `
      <button class="topo-paleta-item" data-tipo="${tipo}" title="Arraste para o canvas">
        <span class="topo-icone" style="color:${def.cor};"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def.icone}</svg></span>
        <span>${def.label}</span>
      </button>`
    )
    .join("");

  el.paleta.querySelectorAll(".topo-paleta-item").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => iniciarArrasteDaPaleta(e, btn.dataset.tipo));
  });
}

function iniciarArrasteDaPaleta(evtInicial, tipo) {
  evtInicial.preventDefault();
  const fantasma = document.createElement("div");
  fantasma.className = "topo-fantasma";
  fantasma.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TIPOS_EQUIPAMENTO[tipo].icone}</svg>`;
  document.body.appendChild(fantasma);
  moverFantasma(evtInicial);

  function moverFantasma(e) {
    fantasma.style.left = `${e.clientX}px`;
    fantasma.style.top = `${e.clientY}px`;
  }

  function aoMover(e) {
    moverFantasma(e);
  }

  function aoSoltar(e) {
    document.removeEventListener("pointermove", aoMover);
    document.removeEventListener("pointerup", aoSoltar);
    fantasma.remove();

    const rect = el.canvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const x = e.clientX - rect.left - 28;
      const y = e.clientY - rect.top - 28;
      adicionarDispositivo(tipo, Math.max(0, x), Math.max(0, y));
    }
  }

  document.addEventListener("pointermove", aoMover);
  document.addEventListener("pointerup", aoSoltar, { once: true });
}

// ---------- AÇÕES SOBRE DISPOSITIVOS ----------

function adicionarDispositivo(tipo, x, y) {
  const contagemMesmoTipo = topologia.dispositivos.filter((d) => d.tipo === tipo).length + 1;
  const dispositivo = {
    id: novoId("dev"),
    tipo,
    nome: `${TIPOS_EQUIPAMENTO[tipo].label.split(" ")[0]}${contagemMesmoTipo}`,
    x,
    y,
    tamanho: 1,
    propriedades: {},
  };
  topologia.dispositivos.push(dispositivo);
  selecionarDispositivo(dispositivo.id);
  renderTudo();
}

function duplicarDispositivo(id) {
  const original = topologia.dispositivos.find((d) => d.id === id);
  if (!original) return;
  const copia = { ...original, id: novoId("dev"), nome: `${original.nome} (cópia)`, x: original.x + 30, y: original.y + 30, propriedades: { ...original.propriedades } };
  topologia.dispositivos.push(copia);
  selecionarDispositivo(copia.id);
  renderTudo();
}

function excluirDispositivo(id) {
  topologia.dispositivos = topologia.dispositivos.filter((d) => d.id !== id);
  topologia.conexoes = topologia.conexoes.filter((c) => c.origemId !== id && c.destinoId !== id);
  if (dispositivoSelecionadoId === id) dispositivoSelecionadoId = null;
  renderTudo();
}

function selecionarDispositivo(id) {
  dispositivoSelecionadoId = id;
  renderPropriedades();
  renderDispositivos();
}

// ---------- CANVAS: arrastar dispositivos já posicionados ----------

function ligarEventosCanvas() {
  el.canvas.addEventListener("pointerdown", (e) => {
    const no = e.target.closest(".topo-node");
    if (!no) {
      dispositivoSelecionadoId = null;
      renderPropriedades();
      renderDispositivos();
      return;
    }
    if (e.target.closest(".topo-node-acao")) return; // botões de duplicar/excluir tratam sozinhos

    const id = no.dataset.id;

    if (modoConexao) {
      tratarCliqueModoConexao(id);
      return;
    }

    selecionarDispositivo(id);

    const dispositivo = topologia.dispositivos.find((d) => d.id === id);
    const rectCanvas = el.canvas.getBoundingClientRect();
    arrastando = {
      id,
      offsetX: e.clientX - rectCanvas.left - dispositivo.x,
      offsetY: e.clientY - rectCanvas.top - dispositivo.y,
    };
    document.addEventListener("pointermove", aoArrastarNoCanvas);
    document.addEventListener("pointerup", aoSoltarNoCanvas, { once: true });
  });
}

function aoArrastarNoCanvas(e) {
  if (!arrastando) return;
  const dispositivo = topologia.dispositivos.find((d) => d.id === arrastando.id);
  if (!dispositivo) return;
  const rectCanvas = el.canvas.getBoundingClientRect();
  dispositivo.x = Math.max(0, Math.min(e.clientX - rectCanvas.left - arrastando.offsetX, rectCanvas.width - 60));
  dispositivo.y = Math.max(0, Math.min(e.clientY - rectCanvas.top - arrastando.offsetY, rectCanvas.height - 60));
  renderDispositivos();
  renderConexoes();
}

function aoSoltarNoCanvas() {
  document.removeEventListener("pointermove", aoArrastarNoCanvas);
  arrastando = null;
}

// ---------- CONEXÕES ----------

function alternarModoConexao() {
  modoConexao = !modoConexao;
  origemConexaoId = null;
  document.getElementById("topo-btn-conectar").classList.toggle("ativo", modoConexao);
  renderDispositivos();
}

function tratarCliqueModoConexao(id) {
  if (!origemConexaoId) {
    origemConexaoId = id;
    renderDispositivos();
    return;
  }
  if (origemConexaoId === id) {
    origemConexaoId = null;
    renderDispositivos();
    return;
  }
  abrirModalNovaConexao(origemConexaoId, id);
}

function abrirModalNovaConexao(origemId, destinoId) {
  const origem = topologia.dispositivos.find((d) => d.id === origemId);
  const destino = topologia.dispositivos.find((d) => d.id === destinoId);
  const modal = document.getElementById("topo-modal-conexao");
  document.getElementById("topo-conexao-titulo").textContent = `Conectar ${origem.nome} → ${destino.nome}`;
  document.getElementById("topo-conexao-origem-nome").textContent = origem.nome;
  document.getElementById("topo-conexao-destino-nome").textContent = destino.nome;
  document.getElementById("topo-conexao-origem-if").value = "";
  document.getElementById("topo-conexao-destino-if").value = "";
  modal.classList.remove("hidden");
  modal.dataset.origemId = origemId;
  modal.dataset.destinoId = destinoId;
}

function confirmarNovaConexao() {
  const modal = document.getElementById("topo-modal-conexao");
  const origemInterface = document.getElementById("topo-conexao-origem-if").value.trim() || "—";
  const destinoInterface = document.getElementById("topo-conexao-destino-if").value.trim() || "—";
  topologia.conexoes.push({
    id: novoId("link"),
    origemId: modal.dataset.origemId,
    destinoId: modal.dataset.destinoId,
    origemInterface,
    destinoInterface,
  });
  modal.classList.add("hidden");
  modoConexao = false;
  origemConexaoId = null;
  document.getElementById("topo-btn-conectar").classList.remove("ativo");
  renderTudo();
}

function excluirConexao(id) {
  if (!confirm("Excluir essa conexão?")) return;
  topologia.conexoes = topologia.conexoes.filter((c) => c.id !== id);
  renderConexoes();
}

// ---------- RENDER ----------

function renderTudo() {
  el.nomeAtual.textContent = topologia.nome + (topologiaId ? "" : " (não salvo)");
  renderDispositivos();
  renderConexoes();
  renderPropriedades();
}

function renderDispositivos() {
  el.canvas.innerHTML = topologia.dispositivos
    .map((d) => {
      const def = TIPOS_EQUIPAMENTO[d.tipo] || TIPOS_EQUIPAMENTO.pc;
      const selecionado = d.id === dispositivoSelecionadoId;
      const emOrigemConexao = modoConexao && d.id === origemConexaoId;
      const escala = d.tamanho === 2 ? 1.3 : d.tamanho === 0 ? 0.8 : 1;
      return `
        <div class="topo-node ${selecionado ? "selecionado" : ""} ${emOrigemConexao ? "origem-conexao" : ""}"
             data-id="${d.id}" style="left:${d.x}px; top:${d.y}px; --escala:${escala};">
          <div class="topo-node-acoes">
            <button class="topo-node-acao" data-acao="duplicar" title="Duplicar">⧉</button>
            <button class="topo-node-acao" data-acao="excluir" title="Excluir">✕</button>
          </div>
          <div class="topo-node-icone" style="color:${def.cor}; border-color:${def.cor};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def.icone}</svg>
          </div>
          <div class="topo-node-label">${escaparHtml(d.nome)}</div>
        </div>`;
    })
    .join("");

  el.canvas.querySelectorAll('[data-acao="duplicar"]').forEach((btn) =>
    btn.addEventListener("click", (e) => duplicarDispositivo(e.target.closest(".topo-node").dataset.id))
  );
  el.canvas.querySelectorAll('[data-acao="excluir"]').forEach((btn) =>
    btn.addEventListener("click", (e) => {
      if (confirm("Excluir este equipamento e suas conexões?")) excluirDispositivo(e.target.closest(".topo-node").dataset.id);
    })
  );
}

function renderConexoes() {
  const largura = el.wrapper.scrollWidth;
  const altura = el.wrapper.scrollHeight;
  el.svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
  el.svg.setAttribute("width", largura);
  el.svg.setAttribute("height", altura);

  el.svg.innerHTML = topologia.conexoes
    .map((c) => {
      const origem = topologia.dispositivos.find((d) => d.id === c.origemId);
      const destino = topologia.dispositivos.find((d) => d.id === c.destinoId);
      if (!origem || !destino) return "";
      const x1 = origem.x + 28, y1 = origem.y + 28, x2 = destino.x + 28, y2 = destino.y + 28;
      const meioX = (x1 + x2) / 2, meioY = (y1 + y2) / 2;
      const label = topologia.mostrarInterfaces
        ? `<g>
             <rect x="${meioX - 46}" y="${meioY - 10}" width="92" height="20" rx="5" fill="var(--surface)" stroke="var(--border)" />
             <text x="${meioX}" y="${meioY + 4}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${escaparHtml(c.origemInterface)} ↔ ${escaparHtml(c.destinoInterface)}</text>
           </g>`
        : "";
      return `<g class="topo-link" data-id="${c.id}" style="cursor:pointer;">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="2" />
                ${label}
              </g>`;
    })
    .join("");

  el.svg.querySelectorAll(".topo-link").forEach((g) => g.addEventListener("click", () => excluirConexao(g.dataset.id)));
}

function renderPropriedades() {
  const d = topologia.dispositivos.find((x) => x.id === dispositivoSelecionadoId);
  if (!d) {
    el.propriedades.innerHTML = `<p class="topo-empty">Selecione um equipamento no canvas para ver e editar suas propriedades.</p>`;
    return;
  }

  const ehRoteadorOuSwitch = d.tipo === "router" || d.tipo === "switchL2" || d.tipo === "switchL3";
  const p = d.propriedades || {};

  const campo = (chave, label, tipo = "text") =>
    tipo === "textarea"
      ? `<label class="topo-campo"><span>${label}</span><textarea data-prop="${chave}" rows="2">${escaparHtml(p[chave] || "")}</textarea></label>`
      : `<label class="topo-campo"><span>${label}</span><input type="text" data-prop="${chave}" value="${escaparHtml(p[chave] || "")}" /></label>`;

  el.propriedades.innerHTML = `
    <div class="topo-prop-header">
      <label class="topo-campo"><span>Hostname / Nome</span><input type="text" id="topo-prop-nome" value="${escaparHtml(d.nome)}" /></label>
      <label class="topo-campo"><span>Tipo de equipamento</span>
        <select id="topo-prop-tipo">
          ${Object.entries(TIPOS_EQUIPAMENTO).map(([tipo, def]) => `<option value="${tipo}" ${tipo === d.tipo ? "selected" : ""}>${def.label}</option>`).join("")}
        </select>
      </label>
      <label class="topo-campo"><span>Tamanho do ícone</span>
        <select id="topo-prop-tamanho">
          <option value="0" ${d.tamanho === 0 ? "selected" : ""}>Pequeno</option>
          <option value="1" ${(d.tamanho ?? 1) === 1 ? "selected" : ""}>Padrão</option>
          <option value="2" ${d.tamanho === 2 ? "selected" : ""}>Grande</option>
        </select>
      </label>
    </div>
    <div class="topo-prop-grid">
      ${campo("modelo", "Modelo")}
      ${campo("ip", "Endereço IP")}
      ${campo("mascara", "Máscara / Prefixo")}
      ${campo("gateway", "Gateway")}
      ${campo("vlan", "VLAN")}
      ${campo("interface", "Interface")}
    </div>
    ${campo("descricao", "Descrição", "textarea")}
    ${campo("observacoes", "Observações", "textarea")}
    ${
      ehRoteadorOuSwitch
        ? `<h4 class="topo-prop-subtitulo">Configurações (documentação)</h4>
           <div class="topo-prop-grid">
             ${campo("ospf", "OSPF")}
             ${campo("vlans", "VLANs")}
             ${campo("trunks", "Trunks")}
             ${campo("etherchannel", "EtherChannel")}
             ${campo("stp", "STP")}
             ${campo("dhcp", "DHCP")}
             ${campo("nat", "NAT")}
             ${campo("ipv6", "IPv6")}
           </div>`
        : ""
    }
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button class="btn-secondary" id="topo-prop-duplicar" style="margin-top:0;">Duplicar</button>
      <button class="btn-secondary" id="topo-prop-excluir" style="margin-top:0; color:var(--terracotta); border-color:var(--terracotta);">Excluir</button>
    </div>
  `;

  document.getElementById("topo-prop-nome").addEventListener("input", (e) => {
    d.nome = e.target.value;
    renderDispositivos();
    el.nomeAtual.textContent = topologia.nome + (topologiaId ? "" : " (não salvo)");
  });
  document.getElementById("topo-prop-tipo").addEventListener("change", (e) => {
    d.tipo = e.target.value;
    renderDispositivos();
    renderPropriedades();
  });
  document.getElementById("topo-prop-tamanho").addEventListener("change", (e) => {
    d.tamanho = Number(e.target.value);
    renderDispositivos();
  });
  el.propriedades.querySelectorAll("[data-prop]").forEach((campoEl) => {
    campoEl.addEventListener("input", (e) => {
      d.propriedades = d.propriedades || {};
      d.propriedades[e.target.dataset.prop] = e.target.value;
    });
  });
  document.getElementById("topo-prop-duplicar").addEventListener("click", () => duplicarDispositivo(d.id));
  document.getElementById("topo-prop-excluir").addEventListener("click", () => {
    if (confirm("Excluir este equipamento e suas conexões?")) excluirDispositivo(d.id);
  });
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// ---------- AÇÕES DE TOPBAR (novo / salvar / abrir / renomear / duplicar / excluir) ----------

function ligarEventosTopbar() {
  document.getElementById("topo-btn-conectar").addEventListener("click", alternarModoConexao);
  document.getElementById("topo-btn-toggle-interfaces").addEventListener("click", () => {
    topologia.mostrarInterfaces = !topologia.mostrarInterfaces;
    document.getElementById("topo-btn-toggle-interfaces").classList.toggle("ativo", topologia.mostrarInterfaces);
    renderConexoes();
  });

  document.getElementById("topo-btn-novo").addEventListener("click", async () => {
    if (!confirm("Criar um novo laboratório? Alterações não salvas neste serão perdidas.")) return;
    topologiaId = null;
    topologia = topologiaVazia();
    dispositivoSelecionadoId = null;
    renderTudo();
  });

  document.getElementById("topo-btn-salvar").addEventListener("click", salvarTopologiaAtual);

  document.getElementById("topo-btn-abrir").addEventListener("click", abrirModalListaTopologias);
  document.getElementById("topo-modal-lista-fechar").addEventListener("click", () => {
    document.getElementById("topo-modal-lista").classList.add("hidden");
  });

  document.getElementById("topo-btn-renomear").addEventListener("click", () => {
    const novoNome = prompt("Novo nome do laboratório:", topologia.nome);
    if (novoNome && novoNome.trim()) {
      topologia.nome = novoNome.trim();
      renderTudo();
    }
  });

  document.getElementById("topo-btn-duplicar-lab").addEventListener("click", async () => {
    topologiaId = null;
    topologia = { ...topologia, nome: `${topologia.nome} (cópia)` };
    await salvarTopologiaAtual();
  });

  document.getElementById("topo-btn-excluir-lab").addEventListener("click", async () => {
    if (!topologiaId) {
      topologia = topologiaVazia();
      renderTudo();
      return;
    }
    if (!confirm(`Excluir "${topologia.nome}" definitivamente?`)) return;
    await excluirTopologia(uidAtual, topologiaId);
    topologiaId = null;
    topologia = topologiaVazia();
    renderTudo();
  });

  document.getElementById("topo-btn-templates").addEventListener("click", abrirModalTemplates);
  document.getElementById("topo-modal-templates-fechar").addEventListener("click", () => {
    document.getElementById("topo-modal-templates").classList.add("hidden");
  });

  document.getElementById("topo-btn-exportar-json").addEventListener("click", exportarJSON);
  document.getElementById("topo-btn-exportar-png").addEventListener("click", exportarPNG);
  document.getElementById("topo-btn-exportar-pdf").addEventListener("click", exportarPDF);

  document.getElementById("topo-conexao-confirmar").addEventListener("click", confirmarNovaConexao);
  document.getElementById("topo-conexao-cancelar").addEventListener("click", () => {
    document.getElementById("topo-modal-conexao").classList.add("hidden");
  });
}

async function salvarTopologiaAtual() {
  const dados = {
    nome: topologia.nome,
    mostrarInterfaces: topologia.mostrarInterfaces,
    dispositivos: topologia.dispositivos,
    conexoes: topologia.conexoes,
  };
  if (topologiaId) {
    await atualizarTopologia(uidAtual, topologiaId, dados);
  } else {
    const ref = await criarTopologia(uidAtual, dados);
    topologiaId = ref.id;
  }
  el.nomeAtual.textContent = topologia.nome;
  const status = document.getElementById("topo-status-salvo");
  status.textContent = "Salvo ✓";
  status.classList.add("visivel");
  setTimeout(() => status.classList.remove("visivel"), 2000);
}

async function abrirModalListaTopologias() {
  const modal = document.getElementById("topo-modal-lista");
  const lista = document.getElementById("topo-lista-labs");
  lista.innerHTML = `<p class="topo-empty">Carregando…</p>`;
  modal.classList.remove("hidden");

  const salvas = await listarTopologias(uidAtual);
  if (salvas.length === 0) {
    lista.innerHTML = `<p class="topo-empty">Nenhum laboratório salvo ainda.</p>`;
    return;
  }
  lista.innerHTML = salvas
    .map(
      (t) => `
      <button class="topo-lista-item" data-id="${t.id}">
        <strong>${escaparHtml(t.nome || "Sem título")}</strong>
        <span>${(t.dispositivos || []).length} equipamento(s) · ${(t.conexoes || []).length} conexão(ões)</span>
      </button>`
    )
    .join("");

  lista.querySelectorAll(".topo-lista-item").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const carregada = await getTopologia(uidAtual, btn.dataset.id);
      if (!carregada) return;
      topologiaId = carregada.id;
      topologia = {
        nome: carregada.nome || "Sem título",
        mostrarInterfaces: carregada.mostrarInterfaces !== false,
        dispositivos: carregada.dispositivos || [],
        conexoes: carregada.conexoes || [],
      };
      dispositivoSelecionadoId = null;
      modal.classList.add("hidden");
      renderTudo();
    })
  );
}

function abrirModalTemplates() {
  const modal = document.getElementById("topo-modal-templates");
  const lista = document.getElementById("topo-lista-templates");
  lista.innerHTML = Object.entries(TEMPLATES)
    .map(
      ([chave, t]) => `
      <button class="topo-lista-item" data-chave="${chave}">
        <strong>${escaparHtml(t.nome)}</strong>
        <span>${t.dispositivos.length} equipamento(s) · ${t.conexoes.length} conexão(ões)</span>
      </button>`
    )
    .join("");
  modal.classList.remove("hidden");

  lista.querySelectorAll(".topo-lista-item").forEach((btn) =>
    btn.addEventListener("click", () => {
      const template = TEMPLATES[btn.dataset.chave];
      topologiaId = null;
      topologia = {
        nome: template.nome,
        mostrarInterfaces: true,
        dispositivos: JSON.parse(JSON.stringify(template.dispositivos)),
        conexoes: JSON.parse(JSON.stringify(template.conexoes)),
      };
      dispositivoSelecionadoId = null;
      modal.classList.add("hidden");
      renderTudo();
    })
  );
}

// ---------- EXPORTAÇÃO ----------

function exportarJSON() {
  const dados = JSON.stringify(
    { nome: topologia.nome, dispositivos: topologia.dispositivos, conexoes: topologia.conexoes },
    null,
    2
  );
  baixarArquivo(`${slug(topologia.nome)}.json`, dados, "application/json");
}

function exportarPNG() {
  const canvas = desenharCanvasExportacao();
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    baixarUrl(`${slug(topologia.nome)}.png`, url);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

function exportarPDF() {
  const canvas = desenharCanvasExportacao();
  const img = canvas.toDataURL("image/png");
  const janela = window.open("", "_blank");
  if (!janela) {
    alert("Permita pop-ups para exportar em PDF (o navegador abre a caixa de impressão, onde você escolhe 'Salvar como PDF').");
    return;
  }
  janela.document.write(`
    <html><head><title>${escaparHtml(topologia.nome)}</title></head>
    <body style="margin:0; display:flex; align-items:center; justify-content:center;">
      <img src="${img}" style="max-width:100%;" onload="window.print()" />
    </body></html>
  `);
  janela.document.close();
}

function desenharCanvasExportacao() {
  const largura = Math.max(el.canvas.scrollWidth, 600);
  const altura = Math.max(el.canvas.scrollHeight, 400);
  const canvas = document.createElement("canvas");
  const escalaExport = 2;
  canvas.width = largura * escalaExport;
  canvas.height = altura * escalaExport;
  const ctx = canvas.getContext("2d");
  ctx.scale(escalaExport, escalaExport);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, largura, altura);

  // Conexões
  ctx.strokeStyle = "#B8B3A6";
  ctx.lineWidth = 2;
  topologia.conexoes.forEach((c) => {
    const origem = topologia.dispositivos.find((d) => d.id === c.origemId);
    const destino = topologia.dispositivos.find((d) => d.id === c.destinoId);
    if (!origem || !destino) return;
    ctx.beginPath();
    ctx.moveTo(origem.x + 28, origem.y + 28);
    ctx.lineTo(destino.x + 28, destino.y + 28);
    ctx.stroke();

    if (topologia.mostrarInterfaces) {
      const meioX = (origem.x + destino.x) / 2 + 28;
      const meioY = (origem.y + destino.y) / 2 + 28;
      ctx.fillStyle = "#5B6672";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${c.origemInterface} ↔ ${c.destinoInterface}`, meioX, meioY);
    }
  });

  // Dispositivos
  topologia.dispositivos.forEach((d) => {
    ctx.fillStyle = "#EFEDE6";
    ctx.strokeStyle = "#3E6B6B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x + 28, d.y + 28, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#3E6B6B";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((TIPOS_EQUIPAMENTO[d.tipo]?.label || d.tipo).slice(0, 3).toUpperCase(), d.x + 28, d.y + 32);

    ctx.fillStyle = "#242D33";
    ctx.font = "12px sans-serif";
    ctx.fillText(d.nome, d.x + 28, d.y + 68);
  });

  return canvas;
}

function baixarArquivo(nomeArquivo, conteudo, tipoMime) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  baixarUrl(nomeArquivo, url);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function baixarUrl(nomeArquivo, url) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function slug(texto) {
  return (texto || "topologia")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
