// reader.js
// Leitor de livros em PDF, no estilo Kindle: renderiza página a página com
// PDF.js (hospedado no próprio app, sem CDN externo), guarda a posição de
// leitura no Firestore (sincroniza entre aparelhos), e o arquivo em si é
// cacheado pelo Service Worker pra funcionar offline depois do primeiro
// carregamento (bom pra ler no trajeto, sem sinal).
//
// IMPORTANTE: este módulo só renderiza um PDF que você mesmo adiciona ao
// repositório (pasta /livros). Não inclui nem gera conteúdo de livro nenhum.

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

let pdfjsLib = null;
let pdfDoc = null;
let paginaAtual = 1;
let totalPaginas = 1;
let livroIdAtual = null;

async function garantirPdfJsCarregado() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("./vendor/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.mjs";
  return pdfjsLib;
}

/** Lista os livros disponíveis (arquivos que você colocou em /livros). */
export const LIVROS_DISPONIVEIS = [
  // Adicione uma linha pra cada PDF que você subir na pasta /livros do repositório.
  // O "id" é livre (usado só pra salvar sua posição de leitura no Firestore).
  { id: "livro-1", titulo: "Meu livro", arquivo: "livros/livro1.pdf" },
];

export async function abrirLivro(uid, livroId, canvas, onProgresso) {
  const livro = LIVROS_DISPONIVEIS.find((l) => l.id === livroId);
  if (!livro) throw new Error("Livro não encontrado na lista LIVROS_DISPONIVEIS.");

  const lib = await garantirPdfJsCarregado();
  pdfDoc = await lib.getDocument(livro.arquivo).promise;
  totalPaginas = pdfDoc.numPages;
  livroIdAtual = livroId;

  const posicaoSalva = await getPosicaoLeitura(uid, livroId);
  paginaAtual = posicaoSalva || 1;

  await renderizarPagina(canvas, paginaAtual);
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
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

export async function paginaAnterior(uid, canvas, onProgresso) {
  if (paginaAtual <= 1) return;
  paginaAtual--;
  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

export async function irParaPagina(uid, canvas, numero, onProgresso) {
  const alvo = Math.max(1, Math.min(totalPaginas, numero));
  paginaAtual = alvo;
  await renderizarPagina(canvas, paginaAtual);
  await salvarPosicaoLeitura(uid, livroIdAtual, paginaAtual);
  if (onProgresso) onProgresso(paginaAtual, totalPaginas);
}

async function salvarPosicaoLeitura(uid, livroId, pagina) {
  const ref = doc(db, "users", uid, "leituras", livroId);
  await setDoc(ref, { paginaAtual: pagina, atualizadaEm: new Date().toISOString() }, { merge: true });
}

async function getPosicaoLeitura(uid, livroId) {
  const ref = doc(db, "users", uid, "leituras", livroId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().paginaAtual : null;
}
