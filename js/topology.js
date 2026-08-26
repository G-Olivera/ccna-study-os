// topology.js
// Editor visual de topologias de rede (módulo "Topologia").
//
// Ainda não emula equipamentos — os campos de config (OSPF, VLANs, etc.) e o
// painel de CLI servem como documentação/planejamento por enquanto.
//
// Estrutura de dados pensada para reaproveitar no futuro (integração com
// EVE-NG/PNETLab/CML e modo de estudo/desafios):
//   topologia = {
//     nome, descricaoLab, tema, dificuldade, objetivo, observacoesLab,
//     mostrarInterfaces: boolean,
//     dispositivos: [{ id, tipo, nome, x, y, tamanho, localizacao, ip, mascara,
//                       gateway, vlanNativa, interfaces: [{nome,ip,status,descricao}],
//                       propriedades: {...} }],
//     conexoes: [{ id, origemId, origemInterface, destinoId, destinoInterface, tipo }],
//   }

import {
  criarTopologia,
  atualizarTopologia,
  listarTopologias,
  getTopologia,
  excluirTopologia,
} from "./data-schema.js";
import { criarSessaoCLI, gerarComandosEquivalentes } from "./cli-interpreter.js";

// ---------- TIPOS DE EQUIPAMENTO (organizados por categoria) ----------

const ICONES = {
  router: `<circle cx="12" cy="12" r="9"/><path d="M7 12h10M7 9h6M7 15h4"/>`,
  switchL2: `<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 17v3M12 17v3M18 17v3"/>`,
  switchL3: `<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 17v3M12 17v3M18 17v3"/><circle cx="12" cy="12" r="2"/>`,
  firewall: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7c-1.6 2-3 2.9-3 5a3 3 0 0 0 6 0c0-1-.9-1.4-1-2.6 0 .9-1 1.3-1 1.8a.9.9 0 0 1-1-1.8c0-1 .5-1.4 0-2.4z"/>`,
  ap: `<circle cx="12" cy="18" r="1.4"/><path d="M8.3 15a5.2 5.2 0 0 1 7.4 0"/><path d="M5 11.6a9.4 9.4 0 0 1 14 0"/>`,
  pc: `<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>`,
  laptop: `<rect x="5" y="4" width="14" height="9" rx="1"/><path d="M2 18h20l-1.6-3H3.6z"/>`,
  server: `<rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="12" width="16" height="6" rx="1"/><circle cx="7.5" cy="6" r=".8" fill="currentColor"/><circle cx="7.5" cy="15" r=".8" fill="currentColor"/>`,
  cloud: `<path d="M7 17a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-1.9A4.5 4.5 0 0 1 17 17H7z"/>`,
};

export const TIPOS_EQUIPAMENTO = {
  router: { label: "Router", cor: "var(--teal)", icone: ICONES.router, prefixo: "R", interfacesPadrao: ["G0/0", "G0/1", "G0/2"] },
  switchL2: { label: "Switch L2", cor: "var(--sage)", icone: ICONES.switchL2, prefixo: "SW", interfacesPadrao: ["G0/1", "G0/2", "Fa0/1", "Fa0/2"] },
  switchL3: { label: "Switch L3", cor: "var(--sage)", icone: ICONES.switchL3, prefixo: "MLS", interfacesPadrao: ["G0/1", "G0/2", "Fa0/1", "Fa0/2"] },
  ap: { label: "Access Point", cor: "var(--amber)", icone: ICONES.ap, prefixo: "AP", interfacesPadrao: ["Eth0", "WiFi"] },
  firewall: { label: "Firewall", cor: "var(--terracotta)", icone: ICONES.firewall, prefixo: "FW", interfacesPadrao: ["G0/0", "G0/1"] },
  pc: { label: "PC", cor: "var(--ink-soft)", icone: ICONES.pc, prefixo: "PC", interfacesPadrao: ["Fa0"] },
  laptop: { label: "Laptop", cor: "var(--ink-soft)", icone: ICONES.laptop, prefixo: "NOTE", interfacesPadrao: ["WiFi", "Ethernet"] },
  server: { label: "Server", cor: "var(--teal)", icone: ICONES.server, prefixo: "SRV", interfacesPadrao: ["Eth0", "Eth1"] },
  cloud: { label: "Cloud / Internet", cor: "var(--ink-soft)", icone: ICONES.cloud, prefixo: "CLOUD", interfacesPadrao: ["WAN"] },
};

const GRUPOS_EQUIPAMENTO = {
  Rede: ["router", "switchL2", "switchL3", "ap"],
  Segurança: ["firewall"],
  Endpoints: ["pc", "laptop"],
  Infraestrutura: ["server", "cloud"],
};

// Tipos que ainda não existem, mas o texto do pedido pede pra "preparar":
// WLC, IP Phone, Printer, IoT, ISP, NAS, Storage, Wireless Bridge, Load Balancer.
// Ficam de fora da paleta por enquanto — ver "+ Adicionar equipamento personalizado".

let equipamentosCustom = []; // [{ tipo, label, cor, icone, prefixo, interfacesPadrao }]

const TIPOS_INTERFACE = ["Ethernet", "FastEthernet", "GigabitEthernet", "Serial", "Fiber", "Wireless", "Console"];

function tipoDef(tipo) {
  return TIPOS_EQUIPAMENTO[tipo] || equipamentosCustom.find((c) => c.tipo === tipo) || TIPOS_EQUIPAMENTO.pc;
}

// ---------- TEMPLATES CCNA (subset inicial — mais chegam depois) ----------

export const TEMPLATES = {
  lanBasica: {
    nome: "LAN Básica",
    tema: "Fundamentos de rede",
    dificuldade: "Básico",
    objetivo: "Conectar 2 PCs através de um switch e validar conectividade.",
    dispositivos: [
      { id: "d1", tipo: "switchL2", nome: "SW1", x: 260, y: 100, tamanho: 1, propriedades: {} },
      { id: "d2", tipo: "pc", nome: "PC1", x: 120, y: 260, tamanho: 1, propriedades: {} },
      { id: "d3", tipo: "pc", nome: "PC2", x: 400, y: 260, tamanho: 1, propriedades: {} },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "Fa0/1", destinoId: "d2", destinoInterface: "Fa0", tipo: "FastEthernet" },
      { id: "c2", origemId: "d1", origemInterface: "Fa0/2", destinoId: "d3", destinoInterface: "Fa0", tipo: "FastEthernet" },
    ],
  },
  vlanTrunk: {
    nome: "VLAN e Trunk",
    tema: "VLAN",
    dificuldade: "Básico",
    objetivo: "Configurar VLANs e trunk entre switches.",
    dispositivos: [
      { id: "d1", tipo: "switchL2", nome: "SW1", x: 260, y: 80, tamanho: 1, propriedades: { vlans: "10 (Vendas), 20 (TI)" } },
      { id: "d2", tipo: "pc", nome: "PC-Vendas", x: 100, y: 220, tamanho: 1, propriedades: { vlan: "10" } },
      { id: "d3", tipo: "pc", nome: "PC-TI", x: 420, y: 220, tamanho: 1, propriedades: { vlan: "20" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "F0/1", destinoId: "d2", destinoInterface: "NIC", tipo: "FastEthernet" },
      { id: "c2", origemId: "d1", origemInterface: "F0/2", destinoId: "d3", destinoInterface: "NIC", tipo: "FastEthernet" },
    ],
  },
  routerOnAStick: {
    nome: "Router-on-a-Stick",
    tema: "Inter-VLAN Routing",
    dificuldade: "Intermediário",
    objetivo: "Rotear entre VLANs usando um único link (trunk) do switch ao roteador.",
    dispositivos: [
      { id: "d1", tipo: "router", nome: "R1", x: 260, y: 60, tamanho: 1, propriedades: { descricao: "Subinterfaces G0/0.10 (VLAN10) e G0/0.20 (VLAN20)" } },
      { id: "d2", tipo: "switchL2", nome: "SW1", x: 260, y: 200, tamanho: 1, propriedades: { trunks: "G0/1 trunk para R1" } },
      { id: "d3", tipo: "pc", nome: "PC-VLAN10", x: 100, y: 340, tamanho: 1, propriedades: { vlan: "10" } },
      { id: "d4", tipo: "pc", nome: "PC-VLAN20", x: 420, y: 340, tamanho: 1, propriedades: { vlan: "20" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "G0/0", destinoId: "d2", destinoInterface: "G0/1", tipo: "GigabitEthernet" },
      { id: "c2", origemId: "d2", origemInterface: "F0/1", destinoId: "d3", destinoInterface: "NIC", tipo: "FastEthernet" },
      { id: "c3", origemId: "d2", origemInterface: "F0/2", destinoId: "d4", destinoInterface: "NIC", tipo: "FastEthernet" },
    ],
  },
  ospf: {
    nome: "OSPF Single Area",
    tema: "OSPF",
    dificuldade: "Intermediário",
    objetivo: "Configurar OSPF área 0 entre 3 roteadores.",
    dispositivos: [
      { id: "d1", tipo: "router", nome: "R1", x: 120, y: 80, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 1.1.1.1" } },
      { id: "d2", tipo: "router", nome: "R2", x: 380, y: 80, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 2.2.2.2" } },
      { id: "d3", tipo: "router", nome: "R3", x: 250, y: 260, tamanho: 1, propriedades: { ospf: "Area 0, Router-ID 3.3.3.3" } },
    ],
    conexoes: [
      { id: "c1", origemId: "d1", origemInterface: "G0/0", destinoId: "d2", destinoInterface: "G0/0", tipo: "GigabitEthernet" },
      { id: "c2", origemId: "d1", origemInterface: "G0/1", destinoId: "d3", destinoInterface: "G0/0", tipo: "GigabitEthernet" },
      { id: "c3", origemId: "d2", origemInterface: "G0/1", destinoId: "d3", destinoInterface: "G0/1", tipo: "GigabitEthernet" },
    ],
  },
};
// Pendente pra próximas versões: Inter-VLAN Routing dedicado, OSPF Multi-Area, DHCP,
// NAT, IPv6, ACL, STP, EtherChannel, WLAN.

// ---------- ESTADO EM MEMÓRIA ----------

let uidAtual = null;
let topologiaId = null;
let topologia = topologiaVazia();
let dispositivoSelecionadoId = null;
let modoConexao = false;
let origemConexaoId = null;
let arrastando = null;
let contadorId = 1;
let abaPropriedadeAtual = "geral";
let zoomAtual = 1;
let modoMao = false;
let panArrastando = null;
let cliDeviceId = null;
let cliSecaoAtual = "terminal";
let temAlteracoesNaoSalvas = false;

function topologiaVazia(nome = "Sem título") {
  return {
    nome,
    descricaoLab: "",
    tema: "",
    dificuldade: "Básico",
    objetivo: "",
    observacoesLab: "",
    mostrarInterfaces: true,
    dispositivos: [],
    conexoes: [],
  };
}

function novoId(prefixo) {
  contadorId += 1;
  return `${prefixo}_${Date.now().toString(36)}${contadorId}`;
}

function marcarAlterado() {
  temAlteracoesNaoSalvas = true;
  atualizarStatusSalvo();
}

function atualizarStatusSalvo() {
  const status = document.getElementById("topo-status-salvo");
  if (!topologiaId) {
    status.textContent = "● Não salvo";
    status.classList.add("nao-salvo");
  } else if (temAlteracoesNaoSalvas) {
    status.textContent = "● Alterações não salvas";
    status.classList.add("nao-salvo");
  } else {
    status.textContent = "● Salvo";
    status.classList.remove("nao-salvo");
  }
}

// ---------- INICIALIZAÇÃO ----------

export function initTopologia(uid) {
  uidAtual = uid;
  cachearElementos();
  montarPaleta();
  ligarEventosTopbar();
  ligarEventosCanvas();
  ligarEventosZoomPan();
  ligarEventosBiblioteca();
  ligarEventosInfoLab();
  ligarAtalhosTeclado();
  renderTudo();
}

let el = {};
function cachearElementos() {
  el.canvas = document.getElementById("topo-canvas");
  el.canvasScroll = document.getElementById("topo-canvas-scroll");
  el.svg = document.getElementById("topo-svg-links");
  el.paleta = document.getElementById("topo-paleta");
  el.propriedades = document.getElementById("topo-propriedades");
  el.nomeAtual = document.getElementById("topo-nome-atual");
  el.wrapper = document.getElementById("topo-canvas-wrapper");
  el.labInfo = document.getElementById("topo-lab-info");
  el.zoomPct = document.getElementById("topo-zoom-pct");
  el.minimapaSvg = document.getElementById("topo-minimapa-svg");
  el.cliDeviceSelect = document.getElementById("topo-cli-device-select");
  el.cliSecoes = document.getElementById("topo-cli-secoes");
  el.cliConteudo = document.getElementById("topo-cli-conteudo");
  el.cliDeviceAtual = document.getElementById("topo-cli-device-atual");
}

// ---------- BIBLIOTECA DE EQUIPAMENTOS ----------

function todosOsTipos() {
  return { ...TIPOS_EQUIPAMENTO, ...Object.fromEntries(equipamentosCustom.map((c) => [c.tipo, c])) };
}

function montarPaleta() {
  const tipos = todosOsTipos();
  const grupos = { ...GRUPOS_EQUIPAMENTO, Personalizados: equipamentosCustom.map((c) => c.tipo) };

  el.paleta.innerHTML = Object.entries(grupos)
    .filter(([, lista]) => lista.length > 0)
    .map(
      ([nomeGrupo, lista]) => `
      <div class="topo-grupo-equip" data-grupo="${nomeGrupo}">
        <div class="topo-grupo-titulo" data-toggle-grupo="${nomeGrupo}">
          <span>${nomeGrupo}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="topo-grupo-itens">
          ${lista
            .map((tipo) => {
              const def = tipos[tipo];
              return `
              <button class="topo-paleta-item" data-tipo="${tipo}" data-nome-busca="${def.label.toLowerCase()}" title="Arraste para o canvas">
                <span class="topo-icone" style="color:${def.cor};"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def.icone}</svg></span>
                <span>${def.label}</span>
              </button>`;
            })
            .join("")}
        </div>
      </div>`
    )
    .join("");

  el.paleta.querySelectorAll(".topo-paleta-item").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => iniciarArrasteDaPaleta(e, btn.dataset.tipo));
  });
  el.paleta.querySelectorAll("[data-toggle-grupo]").forEach((cabecalho) => {
    cabecalho.addEventListener("click", () => {
      cabecalho.closest(".topo-grupo-equip").classList.toggle("recolhido");
    });
  });
}

function ligarEventosBiblioteca() {
  document.getElementById("topo-busca-equip").addEventListener("input", (e) => {
    const termo = e.target.value.trim().toLowerCase();
    el.paleta.querySelectorAll(".topo-paleta-item").forEach((item) => {
      item.classList.toggle("oculto-busca", termo.length > 0 && !item.dataset.nomeBusca.includes(termo));
    });
    // Se estiver buscando, abre todos os grupos pra não esconder resultado atrás de um grupo recolhido.
    if (termo.length > 0) {
      el.paleta.querySelectorAll(".topo-grupo-equip").forEach((g) => g.classList.remove("recolhido"));
    }
  });

  document.getElementById("topo-btn-equip-custom").addEventListener("click", () => {
    document.getElementById("topo-custom-nome").value = "";
    document.getElementById("topo-modal-equip-custom").classList.remove("hidden");
  });
  document.getElementById("topo-custom-cancelar").addEventListener("click", () => {
    document.getElementById("topo-modal-equip-custom").classList.add("hidden");
  });
  document.getElementById("topo-custom-confirmar").addEventListener("click", () => {
    const nome = document.getElementById("topo-custom-nome").value.trim();
    if (!nome) return;
    const base = document.getElementById("topo-custom-icone-base").value;
    const tipo = `custom_${novoId("t")}`;
    equipamentosCustom.push({
      tipo,
      label: nome,
      cor: "var(--amber)",
      icone: ICONES[base] || ICONES.pc,
      prefixo: nome.slice(0, 3).toUpperCase(),
      interfacesPadrao: TIPOS_EQUIPAMENTO[base]?.interfacesPadrao || ["Eth0"],
    });
    document.getElementById("topo-modal-equip-custom").classList.add("hidden");
    montarPaleta();
  });
}

function iniciarArrasteDaPaleta(evtInicial, tipo) {
  evtInicial.preventDefault();
  const def = tipoDef(tipo);
  const fantasma = document.createElement("div");
  fantasma.className = "topo-fantasma";
  fantasma.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def.icone}</svg>`;
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
      const x = (e.clientX - rect.left) / zoomAtual - 28;
      const y = (e.clientY - rect.top) / zoomAtual - 28;
      adicionarDispositivo(tipo, Math.max(0, x), Math.max(0, y));
    }
  }

  document.addEventListener("pointermove", aoMover);
  document.addEventListener("pointerup", aoSoltar, { once: true });
}

// ---------- AÇÕES SOBRE DISPOSITIVOS ----------

function adicionarDispositivo(tipo, x, y) {
  const def = tipoDef(tipo);
  const contagemMesmoTipo = topologia.dispositivos.filter((d) => d.tipo === tipo).length + 1;
  const dispositivo = {
    id: novoId("dev"),
    tipo,
    nome: `${def.prefixo}${contagemMesmoTipo}`,
    x,
    y,
    tamanho: 1,
    localizacao: "",
    ip: "",
    mascara: "",
    gateway: "",
    vlanNativa: "",
    interfaces: (def.interfacesPadrao || ["Eth0"]).map((nomeIf) => ({ nome: nomeIf, ip: "", status: "down", descricao: "Disponível" })),
    propriedades: {},
  };
  topologia.dispositivos.push(dispositivo);
  selecionarDispositivo(dispositivo.id);
  marcarAlterado();
  renderTudo();
}

function duplicarDispositivo(id) {
  const original = topologia.dispositivos.find((d) => d.id === id);
  if (!original) return;
  const copia = {
    ...original,
    id: novoId("dev"),
    nome: `${original.nome} (cópia)`,
    x: original.x + 30,
    y: original.y + 30,
    interfaces: (original.interfaces || []).map((i) => ({ ...i })),
    propriedades: { ...original.propriedades },
  };
  topologia.dispositivos.push(copia);
  selecionarDispositivo(copia.id);
  marcarAlterado();
  renderTudo();
}

function excluirDispositivo(id) {
  topologia.dispositivos = topologia.dispositivos.filter((d) => d.id !== id);
  topologia.conexoes = topologia.conexoes.filter((c) => c.origemId !== id && c.destinoId !== id);
  if (dispositivoSelecionadoId === id) dispositivoSelecionadoId = null;
  if (cliDeviceId === id) cliDeviceId = null;
  sessoesCLI.delete(id);
  marcarAlterado();
  renderTudo();
}

function selecionarDispositivo(id) {
  dispositivoSelecionadoId = id;
  abaPropriedadeAtual = "geral";
  renderPropriedades();
  renderDispositivos();
}

// ---------- ATALHOS DE TECLADO ----------

function ligarAtalhosTeclado() {
  document.addEventListener("keydown", (e) => {
    if (document.getElementById("tela-topologia").classList.contains("hidden")) return;
    const focoEmCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (focoEmCampo) return;

    if ((e.key === "Delete" || e.key === "Backspace") && dispositivoSelecionadoId) {
      e.preventDefault();
      if (confirm("Excluir este equipamento e suas conexões?")) excluirDispositivo(dispositivoSelecionadoId);
    }
  });
}
// Pendente: Ctrl+C/Ctrl+V (copiar/colar), Ctrl+Z/Ctrl+Y (desfazer/refazer),
// Ctrl+A (selecionar todos) e seleção múltipla — ver notas de entrega.

// ---------- ZOOM / PAN ----------

function ligarEventosZoomPan() {
  document.getElementById("topo-btn-zoom-mais").addEventListener("click", () => aplicarZoom(zoomAtual + 0.1));
  document.getElementById("topo-btn-zoom-menos").addEventListener("click", () => aplicarZoom(zoomAtual - 0.1));
  document.getElementById("topo-btn-zoom-ajustar").addEventListener("click", ajustarZoomATela);

  document.getElementById("topo-btn-modo-selecionar").addEventListener("click", () => alternarModoMao(false));
  document.getElementById("topo-btn-modo-mao").addEventListener("click", () => alternarModoMao(true));
  atualizarBotoesModo();

  el.canvasScroll.addEventListener("pointerdown", (e) => {
    if (!modoMao) return;
    if (e.target.closest(".topo-node")) return;
    panArrastando = { startX: e.clientX, startY: e.clientY, scrollLeft: el.canvasScroll.scrollLeft, scrollTop: el.canvasScroll.scrollTop };
    document.addEventListener("pointermove", aoArrastarPan);
    document.addEventListener("pointerup", () => (panArrastando = null), { once: true });
  });
}

function aoArrastarPan(e) {
  if (!panArrastando) return;
  el.canvasScroll.scrollLeft = panArrastando.scrollLeft - (e.clientX - panArrastando.startX);
  el.canvasScroll.scrollTop = panArrastando.scrollTop - (e.clientY - panArrastando.startY);
}

function alternarModoMao(ativar) {
  modoMao = ativar;
  el.wrapper.classList.toggle("modo-mao", modoMao);
  atualizarBotoesModo();
}

function atualizarBotoesModo() {
  document.getElementById("topo-btn-modo-selecionar").classList.toggle("ativo", !modoMao);
  document.getElementById("topo-btn-modo-mao").classList.toggle("ativo", modoMao);
}

function aplicarZoom(novoZoom) {
  zoomAtual = Math.max(0.4, Math.min(2, Math.round(novoZoom * 20) / 20));
  el.canvas.style.transform = `scale(${zoomAtual})`;
  el.zoomPct.textContent = `${Math.round(zoomAtual * 100)}%`;
  renderConexoes();
}

function ajustarZoomATela() {
  if (topologia.dispositivos.length === 0) {
    aplicarZoom(1);
    return;
  }
  const maxX = Math.max(...topologia.dispositivos.map((d) => d.x)) + 80;
  const maxY = Math.max(...topologia.dispositivos.map((d) => d.y)) + 80;
  const escalaX = el.canvasScroll.clientWidth / maxX;
  const escalaY = el.canvasScroll.clientHeight / maxY;
  aplicarZoom(Math.min(escalaX, escalaY, 1));
}

// ---------- MINIMAPA (visual, proporcional às posições reais) ----------

function renderMinimapa() {
  const largura = 145, altura = 90;
  if (topologia.dispositivos.length === 0) {
    el.minimapaSvg.innerHTML = "";
    return;
  }
  const maxX = Math.max(...topologia.dispositivos.map((d) => d.x), 1) + 80;
  const maxY = Math.max(...topologia.dispositivos.map((d) => d.y), 1) + 80;
  const escala = Math.min(largura / maxX, altura / maxY);

  const pontos = topologia.dispositivos
    .map((d) => `<circle cx="${d.x * escala + 4}" cy="${d.y * escala + 4}" r="3" fill="var(--teal)" />`)
    .join("");
  const linhas = topologia.conexoes
    .map((c) => {
      const o = topologia.dispositivos.find((d) => d.id === c.origemId);
      const dest = topologia.dispositivos.find((d) => d.id === c.destinoId);
      if (!o || !dest) return "";
      return `<line x1="${o.x * escala + 4}" y1="${o.y * escala + 4}" x2="${dest.x * escala + 4}" y2="${dest.y * escala + 4}" stroke="var(--border)" stroke-width="1" />`;
    })
    .join("");

  el.minimapaSvg.innerHTML = linhas + pontos;
}

// ---------- CANVAS: arrastar dispositivos já posicionados ----------

function ligarEventosCanvas() {
  el.canvas.addEventListener("pointerdown", (e) => {
    if (modoMao) return;
    const no = e.target.closest(".topo-node");
    if (!no) {
      dispositivoSelecionadoId = null;
      renderPropriedades();
      renderDispositivos();
      return;
    }
    if (e.target.closest(".topo-node-acao")) return;

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
      offsetX: (e.clientX - rectCanvas.left) / zoomAtual - dispositivo.x,
      offsetY: (e.clientY - rectCanvas.top) / zoomAtual - dispositivo.y,
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
  dispositivo.x = Math.max(0, (e.clientX - rectCanvas.left) / zoomAtual - arrastando.offsetX);
  dispositivo.y = Math.max(0, (e.clientY - rectCanvas.top) / zoomAtual - arrastando.offsetY);
  renderDispositivos();
  renderConexoes();
  renderMinimapa();
}

function aoSoltarNoCanvas() {
  document.removeEventListener("pointermove", aoArrastarNoCanvas);
  if (arrastando) marcarAlterado();
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
  const tipoSelect = document.getElementById("topo-conexao-tipo");
  if (tipoSelect) tipoSelect.value = "GigabitEthernet";
  modal.classList.remove("hidden");
  modal.dataset.origemId = origemId;
  modal.dataset.destinoId = destinoId;
}

function confirmarNovaConexao() {
  const modal = document.getElementById("topo-modal-conexao");
  const origemInterface = document.getElementById("topo-conexao-origem-if").value.trim() || "—";
  const destinoInterface = document.getElementById("topo-conexao-destino-if").value.trim() || "—";
  const tipoSelect = document.getElementById("topo-conexao-tipo");
  topologia.conexoes.push({
    id: novoId("link"),
    origemId: modal.dataset.origemId,
    destinoId: modal.dataset.destinoId,
    origemInterface,
    destinoInterface,
    tipo: tipoSelect ? tipoSelect.value : "GigabitEthernet",
  });
  modal.classList.add("hidden");
  modoConexao = false;
  origemConexaoId = null;
  document.getElementById("topo-btn-conectar").classList.remove("ativo");
  marcarAlterado();
  renderTudo();
}

function excluirConexao(id) {
  if (!confirm("Excluir essa conexão?")) return;
  topologia.conexoes = topologia.conexoes.filter((c) => c.id !== id);
  marcarAlterado();
  renderConexoes();
  renderMinimapa();
}

// ---------- RENDER GERAL ----------

function renderTudo() {
  el.nomeAtual.textContent = topologia.nome + (topologiaId ? "" : " (não salvo)");
  atualizarStatusSalvo();
  renderLabInfo();
  renderDispositivos();
  renderConexoes();
  renderPropriedades();
  renderMinimapa();
  renderCliDeviceOptions();
  renderCliConteudo();
}

function renderLabInfo() {
  const partes = [];
  if (topologia.tema) partes.push(`Tema: <strong>${escaparHtml(topologia.tema)}</strong>`);
  partes.push(`Dificuldade: <strong>${escaparHtml(topologia.dificuldade || "Básico")}</strong>`);
  if (topologia.objetivo) partes.push(`Objetivo: ${escaparHtml(topologia.objetivo)}`);
  el.labInfo.innerHTML = partes.map((p) => `<span>${p}</span>`).join("");
}

function renderDispositivos() {
  el.canvas.innerHTML = topologia.dispositivos
    .map((d) => {
      const def = tipoDef(d.tipo);
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
          ${d.propriedades?.modelo ? `<div class="topo-node-modelo">${escaparHtml(d.propriedades.modelo)}</div>` : ""}
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
  const largura = Math.max(el.canvas.scrollWidth, el.wrapper.clientWidth);
  const altura = Math.max(el.canvas.scrollHeight, el.wrapper.clientHeight);
  el.svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
  el.svg.setAttribute("width", largura * zoomAtual);
  el.svg.setAttribute("height", altura * zoomAtual);
  el.svg.style.transform = `scale(${zoomAtual})`;
  el.svg.style.transformOrigin = "top left";

  el.svg.innerHTML = topologia.conexoes
    .map((c) => {
      const origem = topologia.dispositivos.find((d) => d.id === c.origemId);
      const destino = topologia.dispositivos.find((d) => d.id === c.destinoId);
      if (!origem || !destino) return "";
      const x1 = origem.x + 29, y1 = origem.y + 29, x2 = destino.x + 29, y2 = destino.y + 29;
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

// ---------- PROPRIEDADES (abas: Geral / Interfaces / Configuração / Anotações) ----------

function renderPropriedades() {
  const d = topologia.dispositivos.find((x) => x.id === dispositivoSelecionadoId);
  if (!d) {
    el.propriedades.innerHTML = `<p class="topo-empty">Selecione um equipamento no canvas para ver e editar suas propriedades.</p>`;
    return;
  }

  const abas = ["geral", "interfaces", "configuracao", "anotacoes"];
  const rotulos = { geral: "Geral", interfaces: "Interfaces", configuracao: "Configuração", anotacoes: "Anotações" };

  el.propriedades.innerHTML = `
    <div class="topo-prop-tabs">
      ${abas.map((a) => `<button class="topo-prop-tab ${a === abaPropriedadeAtual ? "selecionada" : ""}" data-aba="${a}">${rotulos[a]}</button>`).join("")}
    </div>
    <div id="topo-prop-conteudo-aba"></div>
  `;

  el.propriedades.querySelectorAll("[data-aba]").forEach((btn) =>
    btn.addEventListener("click", () => {
      abaPropriedadeAtual = btn.dataset.aba;
      renderPropriedades();
    })
  );

  const container = document.getElementById("topo-prop-conteudo-aba");
  if (abaPropriedadeAtual === "geral") renderAbaGeral(container, d);
  else if (abaPropriedadeAtual === "interfaces") renderAbaInterfaces(container, d);
  else if (abaPropriedadeAtual === "configuracao") renderAbaConfiguracao(container, d);
  else renderAbaAnotacoes(container, d);
}

function campoTexto(chave, label, valor, tipo = "text") {
  return tipo === "textarea"
    ? `<label class="topo-campo"><span>${label}</span><textarea data-prop="${chave}" rows="2">${escaparHtml(valor || "")}</textarea></label>`
    : `<label class="topo-campo"><span>${label}</span><input type="text" data-prop="${chave}" value="${escaparHtml(valor || "")}" /></label>`;
}

function ligarCamposDireto(container, d, campos) {
  container.querySelectorAll("[data-prop]").forEach((elCampo) => {
    elCampo.addEventListener("input", (e) => {
      d[e.target.dataset.prop] = e.target.value;
      marcarAlterado();
      if (campos.includes("nome")) {
        renderDispositivos();
        el.nomeAtual.textContent = topologia.nome + (topologiaId ? "" : " (não salvo)");
      }
    });
  });
}

function renderAbaGeral(container, d) {
  container.innerHTML = `
    ${campoTexto("nome", "Hostname", d.nome)}
    <label class="topo-campo"><span>Tipo de equipamento</span>
      <select id="topo-prop-tipo">
        ${Object.entries(todosOsTipos()).map(([tipo, def]) => `<option value="${tipo}" ${tipo === d.tipo ? "selected" : ""}>${def.label}</option>`).join("")}
      </select>
    </label>
    <div class="topo-prop-grid">
      ${campoTexto("localizacao", "Localização", d.localizacao)}
      <label class="topo-campo"><span>Tamanho do ícone</span>
        <select id="topo-prop-tamanho">
          <option value="0" ${d.tamanho === 0 ? "selected" : ""}>Pequeno</option>
          <option value="1" ${(d.tamanho ?? 1) === 1 ? "selected" : ""}>Padrão</option>
          <option value="2" ${d.tamanho === 2 ? "selected" : ""}>Grande</option>
        </select>
      </label>
    </div>
    ${(() => { const p = d.propriedades || {}; return campoTexto("modelo", "Modelo", p.modelo); })()}
    ${(() => { const p = d.propriedades || {}; return campoTexto("descricao", "Descrição", p.descricao, "textarea"); })()}
    <h4 class="topo-prop-subtitulo">IP de gerenciamento</h4>
    <div class="topo-prop-grid">
      ${campoTexto("ip", "Endereço IP", d.ip)}
      ${campoTexto("mascara", "Máscara / Prefixo", d.mascara)}
      ${campoTexto("gateway", "Gateway", d.gateway)}
      ${campoTexto("vlanNativa", "VLAN nativa", d.vlanNativa)}
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button class="btn-secondary" id="topo-prop-duplicar" style="margin-top:0;">Duplicar</button>
      <button class="btn-secondary" id="topo-prop-excluir" style="margin-top:0; color:var(--terracotta); border-color:var(--terracotta);">Excluir</button>
    </div>
  `;

  ligarCamposDireto(container, d, ["nome", "localizacao", "ip", "mascara", "gateway", "vlanNativa"]);

  container.querySelectorAll('[data-prop="modelo"], [data-prop="descricao"]').forEach((elCampo) => {
    elCampo.addEventListener("input", (e) => {
      d.propriedades = d.propriedades || {};
      d.propriedades[e.target.dataset.prop] = e.target.value;
      marcarAlterado();
      renderDispositivos();
    });
  });

  document.getElementById("topo-prop-tipo").addEventListener("change", (e) => {
    d.tipo = e.target.value;
    marcarAlterado();
    renderDispositivos();
    renderPropriedades();
    renderMinimapa();
  });
  document.getElementById("topo-prop-tamanho").addEventListener("change", (e) => {
    d.tamanho = Number(e.target.value);
    marcarAlterado();
    renderDispositivos();
  });
  document.getElementById("topo-prop-duplicar").addEventListener("click", () => duplicarDispositivo(d.id));
  document.getElementById("topo-prop-excluir").addEventListener("click", () => {
    if (confirm("Excluir este equipamento e suas conexões?")) excluirDispositivo(d.id);
  });
}

function renderAbaInterfaces(container, d) {
  const interfaces = d.interfaces || [];
  container.innerHTML = `
    ${interfaces
      .map(
        (iface, i) => `
      <div class="topo-interface-linha">
        <div style="flex:1;">
          <input type="text" data-if-campo="nome" data-if-idx="${i}" value="${escaparHtml(iface.nome)}" style="font-weight:700; border:none; background:none; padding:2px 0; width:100%;" />
          <input type="text" data-if-campo="descricao" data-if-idx="${i}" value="${escaparHtml(iface.descricao || "")}" placeholder="Descrição" style="border:none; background:none; padding:2px 0; width:100%; font-size:11px; color:var(--ink-soft);" />
        </div>
        <input type="text" data-if-campo="ip" data-if-idx="${i}" value="${escaparHtml(iface.ip || "")}" placeholder="IP/prefixo" style="width:110px; padding:6px 8px; border-radius:6px; border:1px solid var(--border); font-size:11px;" />
        <select data-if-campo="status" data-if-idx="${i}" class="topo-if-status ${iface.status}">
          <option value="up" ${iface.status === "up" ? "selected" : ""}>UP</option>
          <option value="down" ${iface.status === "down" ? "selected" : ""}>DOWN</option>
          <option value="admin" ${iface.status === "admin" ? "selected" : ""}>ADMIN DOWN</option>
        </select>
        <button class="tarefa-acao remover" data-remover-if="${i}" title="Remover interface">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`
      )
      .join("")}
    <button class="btn-secondary" id="topo-if-adicionar" style="width:100%; margin-top:10px;">+ Adicionar interface</button>
  `;

  container.querySelectorAll("[data-if-campo]").forEach((campo) => {
    campo.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.ifIdx);
      d.interfaces[idx][e.target.dataset.ifCampo] = e.target.value;
      marcarAlterado();
      if (e.target.dataset.ifCampo === "status") renderAbaInterfaces(container, d);
    });
    campo.addEventListener("change", (e) => {
      if (e.target.dataset.ifCampo === "status") renderAbaInterfaces(container, d);
    });
  });
  container.querySelectorAll("[data-remover-if]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      d.interfaces.splice(Number(e.target.closest("[data-remover-if]").dataset.removerIf), 1);
      marcarAlterado();
      renderAbaInterfaces(container, d);
    });
  });
  document.getElementById("topo-if-adicionar").addEventListener("click", () => {
    d.interfaces = d.interfaces || [];
    d.interfaces.push({ nome: `Eth${d.interfaces.length}`, ip: "", status: "down", descricao: "Disponível" });
    marcarAlterado();
    renderAbaInterfaces(container, d);
  });
}

function renderAbaConfiguracao(container, d) {
  const ehRoteadorOuSwitch = ["router", "switchL2", "switchL3"].includes(d.tipo);
  const p = d.propriedades || {};
  const campo = (chave, label, tipo = "text") => campoTexto(chave, label, p[chave], tipo);

  container.innerHTML = ehRoteadorOuSwitch
    ? `<div class="topo-prop-grid">
        ${campo("ospf", "OSPF")}
        ${campo("vlans", "VLANs")}
        ${campo("trunks", "Trunks")}
        ${campo("etherchannel", "EtherChannel")}
        ${campo("stp", "STP")}
        ${campo("portSecurity", "Port Security")}
        ${campo("dhcp", "DHCP")}
        ${campo("nat", "NAT")}
        ${campo("ipv6", "IPv6")}
        ${campo("acl", "ACL")}
      </div>
      ${d.tipo === "router" ? campo("rotas", "Rotas estáticas", "textarea") : ""}
      <h4 class="topo-prop-subtitulo">Configuração completa (CLI)</h4>
      <textarea data-prop="configCompleta" rows="6" style="font-family:var(--font-mono); font-size:12px;">${escaparHtml(p.configCompleta || "")}</textarea>`
    : d.tipo === "firewall"
    ? `<div class="topo-prop-grid">
        ${campo("nat", "NAT")}
        ${campo("regras", "Regras")}
        ${campo("vpn", "VPN")}
        ${campo("rotas", "Rotas")}
      </div>`
    : `<p class="topo-empty">Este tipo de equipamento não tem configurações específicas nesta fase.</p>`;

  container.querySelectorAll("[data-prop]").forEach((campoEl) => {
    campoEl.addEventListener("input", (e) => {
      d.propriedades = d.propriedades || {};
      d.propriedades[e.target.dataset.prop] = e.target.value;
      marcarAlterado();
    });
  });
}

function renderAbaAnotacoes(container, d) {
  const p = d.propriedades || {};
  container.innerHTML = campoTexto("observacoes", "Observações", p.observacoes, "textarea");
  container.querySelectorAll("[data-prop]").forEach((campoEl) => {
    campoEl.addEventListener("input", (e) => {
      d.propriedades = d.propriedades || {};
      d.propriedades[e.target.dataset.prop] = e.target.value;
      marcarAlterado();
    });
  });
}

// ---------- TERMINAL INTERATIVO (integração real CLI ↔ Topologia) ----------

function renderTerminalInterativo(d) {
  if (!sessoesCLI.has(d.id)) {
    sessoesCLI.set(d.id, { sessao: criarSessaoCLI(d), historico: [] });
  }
  const estado = sessoesCLI.get(d.id);

  el.cliConteudo.innerHTML = `
    <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">
      Terminal real: os comandos digitados aqui alteram de verdade este equipamento (hostname, interfaces, VLANs, OSPF, rotas).
      Suporta um subconjunto de IOS: <code>enable</code>, <code>configure terminal</code>, <code>hostname</code>, <code>interface</code>,
      <code>ip address</code>, <code>shutdown</code>/<code>no shutdown</code>, <code>vlan</code>/<code>name</code>, <code>router ospf</code>/<code>network</code>,
      <code>ip route</code>, <code>show running-config</code>, <code>show ip interface brief</code>.
    </p>
    <div class="cli-terminal" id="topo-terminal" style="max-height:260px;">
      <div class="cli-historico" id="topo-terminal-historico"></div>
      <div class="cli-linha-atual">
        <span id="topo-terminal-prompt"></span>
        <input type="text" id="topo-terminal-input" autocomplete="off" spellcheck="false" />
      </div>
    </div>
    <button class="btn-secondary" id="topo-terminal-limpar" style="margin-top:8px;">Limpar histórico</button>
  `;

  const elHistorico = document.getElementById("topo-terminal-historico");
  const elPrompt = document.getElementById("topo-terminal-prompt");
  const elInput = document.getElementById("topo-terminal-input");
  const elTerminal = document.getElementById("topo-terminal");

  function renderHistorico() {
    elHistorico.innerHTML = estado.historico
      .map((linha) => {
        if (linha.tipo === "cmd") return `<div class="cli-linha-hist"><span class="cli-prompt-hist">${escaparHtml(linha.prompt)}</span>${escaparHtml(linha.texto)}</div>`;
        if (linha.tipo === "saida") return `<div class="cli-linha-hist cli-saida">${escaparHtml(linha.texto).replace(/\n/g, "<br/>")}</div>`;
        if (linha.tipo === "erro") return `<div class="cli-linha-hist cli-erro">${escaparHtml(linha.texto)}</div>`;
        return "";
      })
      .join("");
    elTerminal.scrollTop = elTerminal.scrollHeight;
    elPrompt.textContent = estado.sessao.prompt() + " ";
  }

  elInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && elInput.value.trim()) {
      const comando = elInput.value;
      estado.historico.push({ tipo: "cmd", prompt: estado.sessao.prompt(), texto: comando });
      const resultado = estado.sessao.executar(comando);
      if (resultado?.texto) estado.historico.push({ tipo: resultado.tipo, texto: resultado.texto });
      elInput.value = "";
      renderHistorico();
      marcarAlterado();
      // Reflete no resto da UI (nó no canvas, aba Propriedades, minimapa) em tempo real.
      renderDispositivos();
      if (dispositivoSelecionadoId === d.id && abaPropriedadeAtual !== "geral") renderPropriedades();
      el.cliDeviceSelect.querySelector(`option[value="${d.id}"]`).textContent = d.nome;
    }
  });
  document.getElementById("topo-terminal-limpar").addEventListener("click", () => {
    estado.historico = [];
    renderHistorico();
  });

  renderHistorico();
  elInput.focus();
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// ---------- PAINEL CONFIGURAÇÃO / CLI ----------

const SECOES_CLI = [
  { chave: "terminal", label: "▶ Terminal" },
  { chave: "comandos-sugeridos", label: "Comandos sugeridos" },
  { chave: "visao-geral", label: "Visão geral" },
  { chave: "interfaces", label: "Interfaces" },
  { chave: "vlans", label: "VLANs" },
  { chave: "rotas", label: "Rotas" },
  { chave: "ospf", label: "OSPF" },
  { chave: "dhcp", label: "DHCP" },
  { chave: "nat", label: "NAT" },
  { chave: "ipv6", label: "IPv6" },
  { chave: "completa", label: "Configuração completa" },
];

// Sessões de terminal ativas por dispositivo (mantém modo/histórico enquanto o
// usuário navega entre abas do CLI, sem perder o que já digitou).
const sessoesCLI = new Map();

function renderCliDeviceOptions() {
  el.cliDeviceSelect.innerHTML =
    `<option value="">— selecione —</option>` +
    topologia.dispositivos.map((d) => `<option value="${d.id}" ${d.id === cliDeviceId ? "selected" : ""}>${escaparHtml(d.nome)}</option>`).join("");

  if (!topologia.dispositivos.find((d) => d.id === cliDeviceId)) cliDeviceId = null;

  el.cliDeviceSelect.onchange = (e) => {
    cliDeviceId = e.target.value || null;
    renderCliConteudo();
  };
}

function renderCliSecoesMenu() {
  el.cliSecoes.innerHTML = SECOES_CLI.map(
    (s) => `<div class="topo-cli-secao-item ${s.chave === cliSecaoAtual ? "selecionada" : ""}" data-secao="${s.chave}">${s.label}</div>`
  ).join("");
  el.cliSecoes.querySelectorAll("[data-secao]").forEach((item) =>
    item.addEventListener("click", () => {
      cliSecaoAtual = item.dataset.secao;
      renderCliConteudo();
    })
  );
}

function renderCliConteudo() {
  renderCliSecoesMenu();
  const d = topologia.dispositivos.find((x) => x.id === cliDeviceId);
  el.cliDeviceAtual.textContent = d ? `| ${d.nome}` : "";

  if (!d) {
    el.cliConteudo.innerHTML = `<p class="topo-empty">Selecione um equipamento no canvas ou na lista acima.</p>`;
    return;
  }

  const p = d.propriedades || {};

  if (cliSecaoAtual === "terminal") {
    renderTerminalInterativo(d);
  } else if (cliSecaoAtual === "comandos-sugeridos") {
    el.cliConteudo.innerHTML = `
      <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">
        Comandos que reproduzem o estado atual deste equipamento — útil pra praticar digitação ou conferir o que já foi configurado.
      </p>
      <pre style="white-space:pre-wrap; font-family:var(--font-mono); font-size:12px; background:var(--ink); color:#cfe9e2; padding:14px; border-radius:8px;">${escaparHtml(gerarComandosEquivalentes(d))}</pre>
      <button class="btn-secondary" id="topo-cli-copiar-sugeridos" style="margin-top:8px;">Copiar</button>`;
    document.getElementById("topo-cli-copiar-sugeridos").addEventListener("click", () => {
      navigator.clipboard?.writeText(gerarComandosEquivalentes(d));
    });
  } else if (cliSecaoAtual === "visao-geral") {
    el.cliConteudo.innerHTML = `
      <div class="topo-prop-grid" style="font-size:13px;">
        <div><strong>Hostname:</strong> ${escaparHtml(d.nome)}</div>
        <div><strong>Modelo:</strong> ${escaparHtml(p.modelo || "—")}</div>
        <div><strong>Tipo:</strong> ${tipoDef(d.tipo).label}</div>
        <div><strong>IP de gerenciamento:</strong> ${escaparHtml(d.ip || "—")}</div>
        <div><strong>Interfaces:</strong> ${(d.interfaces || []).length}</div>
        <div><strong>Interfaces UP:</strong> ${(d.interfaces || []).filter((i) => i.status === "up").length}</div>
      </div>`;
  } else if (cliSecaoAtual === "interfaces") {
    el.cliConteudo.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr style="text-align:left; color:var(--ink-soft);">
          <th style="padding:8px; border-bottom:1px solid var(--border);">Interface</th>
          <th style="padding:8px; border-bottom:1px solid var(--border);">IP/Prefixo</th>
          <th style="padding:8px; border-bottom:1px solid var(--border);">Status</th>
          <th style="padding:8px; border-bottom:1px solid var(--border);">Descrição</th>
        </tr></thead>
        <tbody>
          ${(d.interfaces || [])
            .map(
              (i) => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid var(--border);">${escaparHtml(i.nome)}</td>
              <td style="padding:8px; border-bottom:1px solid var(--border);">${escaparHtml(i.ip || "—")}</td>
              <td style="padding:8px; border-bottom:1px solid var(--border);"><span class="topo-if-status ${i.status}">${i.status === "up" ? "UP" : i.status === "admin" ? "Admin Down" : "Down"}</span></td>
              <td style="padding:8px; border-bottom:1px solid var(--border);">${escaparHtml(i.descricao || "")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  } else if (cliSecaoAtual === "completa") {
    el.cliConteudo.innerHTML = `
      <p style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">Editor de configuração (documentação — os comandos não são executados nesta fase).</p>
      <textarea id="topo-cli-editor-completo" placeholder="hostname ${escaparHtml(d.nome)}&#10;&#10;interface ...&#10; ip address ...&#10; no shutdown">${escaparHtml(p.configCompleta || "")}</textarea>
      <button class="btn-primary" id="topo-cli-salvar-completo" style="margin-top:8px;">Salvar configuração</button>`;
    document.getElementById("topo-cli-salvar-completo").addEventListener("click", () => {
      d.propriedades = d.propriedades || {};
      d.propriedades.configCompleta = document.getElementById("topo-cli-editor-completo").value;
      marcarAlterado();
      alert("Configuração salva na topologia em memória. Clique em \"Salvar\" na barra de ferramentas pra gravar de vez.");
    });
  } else {
    // vlans / rotas / ospf / dhcp / nat / ipv6 — refletem o que já foi preenchido na aba Configuração das Propriedades.
    const mapaChave = { vlans: "vlans", rotas: "rotas", ospf: "ospf", dhcp: "dhcp", nat: "nat", ipv6: "ipv6" };
    const valor = p[mapaChave[cliSecaoAtual]];
    el.cliConteudo.innerHTML = valor
      ? `<pre style="white-space:pre-wrap; font-family:var(--font-mono); font-size:12px; background:var(--bg); padding:14px; border-radius:8px;">${escaparHtml(valor)}</pre>`
      : `<p class="topo-empty">Nada preenchido ainda pra "${SECOES_CLI.find((s) => s.chave === cliSecaoAtual).label}". Edite na aba Configuração do painel de Propriedades.</p>`;
  }
}

// ---------- INFORMAÇÕES DO LAB ----------

function ligarEventosInfoLab() {
  document.getElementById("topo-btn-info-lab").addEventListener("click", () => {
    document.getElementById("topo-info-nome").value = topologia.nome || "";
    document.getElementById("topo-info-descricao").value = topologia.descricaoLab || "";
    document.getElementById("topo-info-tema").value = topologia.tema || "";
    document.getElementById("topo-info-dificuldade").value = topologia.dificuldade || "Básico";
    document.getElementById("topo-info-objetivo").value = topologia.objetivo || "";
    document.getElementById("topo-info-observacoes").value = topologia.observacoesLab || "";
    document.getElementById("topo-modal-info-lab").classList.remove("hidden");
  });
  document.getElementById("topo-modal-info-fechar").addEventListener("click", () => {
    document.getElementById("topo-modal-info-lab").classList.add("hidden");
  });
  document.getElementById("topo-info-salvar").addEventListener("click", () => {
    topologia.nome = document.getElementById("topo-info-nome").value.trim() || topologia.nome;
    topologia.descricaoLab = document.getElementById("topo-info-descricao").value;
    topologia.tema = document.getElementById("topo-info-tema").value;
    topologia.dificuldade = document.getElementById("topo-info-dificuldade").value;
    topologia.objetivo = document.getElementById("topo-info-objetivo").value;
    topologia.observacoesLab = document.getElementById("topo-info-observacoes").value;
    marcarAlterado();
    document.getElementById("topo-modal-info-lab").classList.add("hidden");
    renderTudo();
  });
}

// ---------- AÇÕES DE TOPBAR ----------

function ligarEventosTopbar() {
  document.getElementById("topo-btn-conectar").addEventListener("click", alternarModoConexao);
  document.getElementById("topo-btn-toggle-interfaces").addEventListener("click", () => {
    topologia.mostrarInterfaces = !topologia.mostrarInterfaces;
    document.getElementById("topo-btn-toggle-interfaces").classList.toggle("ativo", topologia.mostrarInterfaces);
    marcarAlterado();
    renderConexoes();
  });

  document.getElementById("topo-btn-novo").addEventListener("click", async () => {
    if (!confirm("Criar um novo laboratório? Alterações não salvas neste serão perdidas.")) return;
    topologiaId = null;
    topologia = topologiaVazia();
    dispositivoSelecionadoId = null;
    cliDeviceId = null;
    sessoesCLI.clear();
    temAlteracoesNaoSalvas = false;
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
      marcarAlterado();
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
      sessoesCLI.clear();
      renderTudo();
      return;
    }
    if (!confirm(`Excluir "${topologia.nome}" definitivamente?`)) return;
    await excluirTopologia(uidAtual, topologiaId);
    topologiaId = null;
    topologia = topologiaVazia();
    sessoesCLI.clear();
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
    descricaoLab: topologia.descricaoLab,
    tema: topologia.tema,
    dificuldade: topologia.dificuldade,
    objetivo: topologia.objetivo,
    observacoesLab: topologia.observacoesLab,
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
  temAlteracoesNaoSalvas = false;
  el.nomeAtual.textContent = topologia.nome;
  atualizarStatusSalvo();
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
        descricaoLab: carregada.descricaoLab || "",
        tema: carregada.tema || "",
        dificuldade: carregada.dificuldade || "Básico",
        objetivo: carregada.objetivo || "",
        observacoesLab: carregada.observacoesLab || "",
        mostrarInterfaces: carregada.mostrarInterfaces !== false,
        dispositivos: (carregada.dispositivos || []).map((d) => ({ interfaces: [], localizacao: "", ip: "", mascara: "", gateway: "", vlanNativa: "", ...d })),
        conexoes: carregada.conexoes || [],
      };
      dispositivoSelecionadoId = null;
      cliDeviceId = null;
      sessoesCLI.clear();
      temAlteracoesNaoSalvas = false;
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
        ...topologiaVazia(template.nome),
        tema: template.tema || "",
        dificuldade: template.dificuldade || "Básico",
        objetivo: template.objetivo || "",
        dispositivos: JSON.parse(JSON.stringify(template.dispositivos)).map((d) => ({
          interfaces: (tipoDef(d.tipo).interfacesPadrao || ["Eth0"]).map((n) => ({ nome: n, ip: "", status: "down", descricao: "Disponível" })),
          localizacao: "",
          ip: "",
          mascara: "",
          gateway: "",
          vlanNativa: "",
          ...d,
        })),
        conexoes: JSON.parse(JSON.stringify(template.conexoes)),
      };
      dispositivoSelecionadoId = null;
      cliDeviceId = null;
      sessoesCLI.clear();
      temAlteracoesNaoSalvas = false;
      modal.classList.add("hidden");
      renderTudo();
    })
  );
}

// ---------- EXPORTAÇÃO ----------

function exportarJSON() {
  const dados = JSON.stringify(
    {
      name: topologia.nome,
      metadata: { tema: topologia.tema, dificuldade: topologia.dificuldade, objetivo: topologia.objetivo, descricao: topologia.descricaoLab, observacoes: topologia.observacoesLab },
      devices: topologia.dispositivos,
      links: topologia.conexoes,
    },
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

// Exporta só o canvas (equipamentos + conexões) — sem sidebar, biblioteca ou propriedades.
function desenharCanvasExportacao() {
  const largura = Math.max(...topologia.dispositivos.map((d) => d.x), 0) + 200;
  const altura = Math.max(...topologia.dispositivos.map((d) => d.y), 0) + 160;
  const canvas = document.createElement("canvas");
  const escalaExport = 2;
  canvas.width = largura * escalaExport;
  canvas.height = altura * escalaExport;
  const ctx = canvas.getContext("2d");
  ctx.scale(escalaExport, escalaExport);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, largura, altura);

  ctx.strokeStyle = "#B8B3A6";
  ctx.lineWidth = 2;
  topologia.conexoes.forEach((c) => {
    const origem = topologia.dispositivos.find((d) => d.id === c.origemId);
    const destino = topologia.dispositivos.find((d) => d.id === c.destinoId);
    if (!origem || !destino) return;
    ctx.beginPath();
    ctx.moveTo(origem.x + 29, origem.y + 29);
    ctx.lineTo(destino.x + 29, destino.y + 29);
    ctx.stroke();

    if (topologia.mostrarInterfaces) {
      const meioX = (origem.x + destino.x) / 2 + 29;
      const meioY = (origem.y + destino.y) / 2 + 29;
      ctx.fillStyle = "#5B6672";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${c.origemInterface} ↔ ${c.destinoInterface}`, meioX, meioY);
    }
  });

  topologia.dispositivos.forEach((d) => {
    ctx.fillStyle = "#EFEDE6";
    ctx.strokeStyle = "#3E6B6B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x + 29, d.y + 29, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#3E6B6B";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((tipoDef(d.tipo).label || d.tipo).slice(0, 3).toUpperCase(), d.x + 29, d.y + 33);

    ctx.fillStyle = "#242D33";
    ctx.font = "12px sans-serif";
    ctx.fillText(d.nome, d.x + 29, d.y + 70);
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
