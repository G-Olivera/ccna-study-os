// reader.js
// Biblioteca + leitor de livros em PDF, no estilo Kindle: renderiza página a
// página com PDF.js (hospedado no próprio app, sem CDN externo), guarda a
// posição de leitura e favoritos no Firestore, e o arquivo em si é cacheado
// pelo Service Worker pra funcionar offline (bom pro seu trajeto sem sinal).
//
// IMPORTANTE: este módulo só renderiza PDFs que você mesmo adiciona ao
// repositório (pasta /livros). Não inclui nem gera conteúdo de livro nenhum.
// As "capas" são geradas por cor + iniciais — de propósito, pra não usar
// nenhuma arte de capa real (isso seria conteúdo protegido de terceiros).

import { doc, getDoc, getDocs, setDoc, collection } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

let pdfjsLib = null;
let pdfDoc = null;
let paginaAtual = 1;
let totalPaginas = 1;
let livroIdAtual = null;

/**
 * Catálogo dos livros disponíveis. Adicione uma entrada pra cada PDF que
 * você subir em /livros. "categoria" é livre — usada pro filtro da biblioteca.
 */
export const LIVROS_DISPONIVEIS = [
  {
    id: "livro-1",
    titulo: "Meu livro",
    volume: "",
    autor: "",
    categoria: "CCNA 200-301",
    arquivo: "livros/livro1.pdf",
    corCapa: "#3E6B6B",
  },
  // Exemplo de como adicionar um segundo livro (Volume 2, por exemplo):
  // {
  //   id: "livro-2",
  //   titulo: "Meu livro",
  //   volume: "Volume 2",
  //   autor: "",
  //   categoria: "CCNA 200-301",
  //   arquivo: "livros/livro2.pdf",
  //   corCapa: "#C97B4A",
  // },
];

async function garantirPdfJsCarregado() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("./vendor/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.mjs";
  return pdfjsLib;
}

// ---------- PROGRESSO E FAVORITOS ----------

/** Busca o progresso de leitura (e favoritos) de todos os livros do usuário. */
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

// ---------- LEITOR ----------

export async function abrirLivro(uid, livroId, canvas, onProgresso) {
  const livro = LIVROS_DISPONIVEIS.find((l) => l.id === livroId);
  if (!livro) throw new Error("Livro não encontrado na lista LIVROS_DISPONIVEIS.");

  const lib = await garantirPdfJsCarregado();
  pdfDoc = await lib.getDocument(livro.arquivo).promise;
  totalPaginas = pdfDoc.numPages;
  livroIdAtual = livroId;

  const posicaoSalva = await getPosicaoLeitura(uid, livroId);
  paginaAtual = posicaoSalva?.paginaAtual || 1;

  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroId, paginaAtual, totalPaginas);
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
