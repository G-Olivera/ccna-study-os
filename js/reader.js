// reader.js
// Biblioteca + leitor de livros em PDF, no estilo Kindle. Dois jeitos de ter
// um livro na biblioteca:
// 1. "Estático": PDF hospedado no seu repositório GitHub (pasta /livros),
//    listado aqui em LIVROS_ESTATICOS. Funciona em qualquer aparelho.
// 2. "Local": você adiciona direto pelo botão no app. Fica salvo no
//    IndexedDB (armazenamento do próprio navegador) — só nesse aparelho,
//    mas sem precisar mexer no GitHub.
//
// IMPORTANTE: este módulo só renderiza PDFs que você mesmo adiciona (seja
// via repositório, seja via upload local). Não inclui nem gera conteúdo de
// livro nenhum. As "capas" são geradas por cor + iniciais — de propósito,
// pra não usar nenhuma arte de capa real (conteúdo protegido de terceiros).

import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

let pdfjsLib = null;
let pdfDoc = null;
let paginaAtual = 1;
let totalPaginas = 1;
let livroIdAtual = null;

/**
 * Livros hospedados no repositório (pasta /livros). Adicione uma entrada pra
 * cada PDF que você subir lá — funcionam em qualquer aparelho.
 */
export const LIVROS_ESTATICOS = [
  // Exemplo:
  // {
  //   id: "livro-1",
  //   titulo: "CCNA 200-301 Official Cert Guide",
  //   volume: "Volume 1",
  //   autor: "Wendell Odom",
  //   categoria: "CCNA 200-301",
  //   arquivo: "livros/livro1.pdf",
  //   corCapa: "#3E6B6B",
  // },
];

const CORES_CAPA = ["#3E6B6B", "#C97B4A", "#5B8266", "#B3654A", "#6B5B95", "#4A7C9B"];

async function garantirPdfJsCarregado() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("./vendor/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.mjs";
  return pdfjsLib;
}

// ---------- IndexedDB (livros adicionados direto pelo app) ----------

const DB_NOME = "ccna-study-os-livros";
const STORE_NOME = "livros";

function abrirBancoLocal() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NOME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Salva um PDF escolhido pelo usuário direto no navegador (IndexedDB). */
export async function adicionarLivroLocal(arquivo, metadados = {}) {
  const bancoDb = await abrirBancoLocal();
  const dadosArquivo = await arquivo.arrayBuffer();

  const tituloPadrao = arquivo.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
  const livro = {
    id: `local-${Date.now()}`,
    titulo: metadados.titulo?.trim() || tituloPadrao,
    volume: "",
    autor: metadados.autor?.trim() || "",
    categoria: metadados.categoria?.trim() || "Meus livros",
    corCapa: CORES_CAPA[Math.floor(Math.random() * CORES_CAPA.length)],
    dadosArquivo,
    criadoEm: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = bancoDb.transaction(STORE_NOME, "readwrite");
    tx.objectStore(STORE_NOME).add(livro);
    tx.oncomplete = () => resolve(livro);
    tx.onerror = () => reject(tx.error);
  });
}

/** Edita título/autor/categoria de um livro local já salvo (não mexe no PDF em si). */
export async function editarLivroLocal(id, dados) {
  const bancoDb = await abrirBancoLocal();
  return new Promise((resolve, reject) => {
    const tx = bancoDb.transaction(STORE_NOME, "readwrite");
    const store = tx.objectStore(STORE_NOME);
    const req = store.get(id);
    req.onsuccess = () => {
      const atual = req.result;
      if (!atual) return reject(new Error("Livro não encontrado."));
      store.put({ ...atual, ...dados });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lista os livros locais (sem o binário pesado, só metadados, pra biblioteca ficar leve). */
export async function listarLivrosLocais() {
  const bancoDb = await abrirBancoLocal();
  return new Promise((resolve, reject) => {
    const tx = bancoDb.transaction(STORE_NOME, "readonly");
    const req = tx.objectStore(STORE_NOME).getAll();
    req.onsuccess = () => {
      const livros = req.result.map(({ dadosArquivo, ...metadados }) => metadados);
      resolve(livros);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getLivroLocalCompleto(id) {
  const bancoDb = await abrirBancoLocal();
  return new Promise((resolve, reject) => {
    const tx = bancoDb.transaction(STORE_NOME, "readonly");
    const req = tx.objectStore(STORE_NOME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removerLivroLocal(id) {
  const bancoDb = await abrirBancoLocal();
  return new Promise((resolve, reject) => {
    const tx = bancoDb.transaction(STORE_NOME, "readwrite");
    tx.objectStore(STORE_NOME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Lista combinada (estáticos + locais) ----------

export async function listarTodosLivros() {
  const locais = await listarLivrosLocais().catch(() => []);
  return [
    ...LIVROS_ESTATICOS.map((l) => ({ ...l, origem: "estatico" })),
    ...locais.map((l) => ({ ...l, origem: "local" })),
  ];
}

// ---------- Progresso e favoritos (Firestore — só a posição, nunca o arquivo) ----------

export async function listarProgressoLeituras(uid) {
  const snap = await getDocs(collection(db, "users", uid, "leituras"));
  const mapa = {};
  snap.docs.forEach((d) => (mapa[d.id] = d.data()));
  return mapa;
}

export async function toggleFavorito(uid, livroId, favoritoAtual) {
  const ref = doc(db, "users", uid, "leituras", livroId);
  await setDoc(ref, { favorito: !favoritoAtual }, { merge: true });
  return !favoritoAtual;
}

async function salvarPosicaoLeitura(uid, livroId, pagina, total) {
  const ref = doc(db, "users", uid, "leituras", livroId);
  await setDoc(ref, { paginaAtual: pagina, totalPaginas: total, atualizadaEm: new Date().toISOString() }, { merge: true });
}

async function getPosicaoLeitura(uid, livroId) {
  const ref = doc(db, "users", uid, "leituras", livroId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function removerProgressoLeitura(uid, livroId) {
  await deleteDoc(doc(db, "users", uid, "leituras", livroId));
}

// ---------- Leitor ----------

/** `livro` é o objeto completo (com campo `origem`), vindo de listarTodosLivros(). */
export async function abrirLivro(uid, livro, canvas, onProgresso) {
  const lib = await garantirPdfJsCarregado();

  if (livro.origem === "local") {
    const completo = await getLivroLocalCompleto(livro.id);
    if (!completo) throw new Error("Livro local não encontrado.");
    pdfDoc = await lib.getDocument({ data: completo.dadosArquivo.slice(0) }).promise;
  } else {
    pdfDoc = await lib.getDocument(livro.arquivo).promise;
  }

  totalPaginas = pdfDoc.numPages;
  livroIdAtual = livro.id;

  const posicaoSalva = await getPosicaoLeitura(uid, livro.id);
  paginaAtual = posicaoSalva?.paginaAtual || 1;

  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livro.id, paginaAtual, totalPaginas);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

async function renderizarPagina(canvas, numero) {
  const pagina = await pdfDoc.getPage(numero);
  const viewport = pagina.getViewport({ scale: 1.4 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await pagina.render({ canvasContext: ctx, viewport }).promise;
}

export async function proximaPagina(uid, canvas, onProgresso) {
  if (paginaAtual >= totalPaginas) return;
  paginaAtual++;
  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual, totalPaginas);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

export async function paginaAnterior(uid, canvas, onProgresso) {
  if (paginaAtual <= 1) return;
  paginaAtual--;
  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual, totalPaginas);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

export async function irParaPagina(uid, canvas, numero, onProgresso) {
  const alvo = Math.max(1, Math.min(totalPaginas, numero));
  paginaAtual = alvo;
  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual, totalPaginas);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}
