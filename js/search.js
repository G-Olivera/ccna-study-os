// search.js
// Busca de conteúdo real do app: teoria (tópicos), laboratórios, flashcards e questões.
// Carrega os 4 tipos de conteúdo uma vez (cache em memória) e filtra localmente —
// evita ficar batendo no Firestore a cada tecla digitada.

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { getAllTopics } from "./data-schema.js";

let indice = null;
let carregando = null;

export async function carregarIndiceBusca() {
  if (indice) return indice;
  if (carregando) return carregando;

  carregando = (async () => {
    const [topicos, labsSnap, flashcardsSnap, questoesSnap] = await Promise.all([
      getAllTopics(),
      getDocs(collection(db, "content", "labs", "items")),
      getDocs(collection(db, "content", "flashcards", "items")),
      getDocs(collection(db, "content", "questions", "items")),
    ]);

    indice = {
      topicos,
      labs: labsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      flashcards: flashcardsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      questoes: questoesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
    return indice;
  })();

  return carregando;
}

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Filtra o índice já carregado. Retorna no máximo 5 resultados por categoria. */
export function buscarConteudo(termo) {
  const vazio = { topicos: [], labs: [], flashcards: [], questoes: [] };
  if (!indice || !termo || termo.trim().length < 2) return vazio;

  const t = normalizar(termo);

  return {
    topicos: indice.topicos
      .filter((x) => normalizar(x.nome).includes(t) || normalizar(x.dominio).includes(t) || normalizar(x.modulo).includes(t))
      .slice(0, 5),
    labs: indice.labs.filter((x) => normalizar(x.titulo).includes(t)).slice(0, 5),
    flashcards: indice.flashcards
      .filter((x) => normalizar(x.front).includes(t) || normalizar(x.categoria).includes(t))
      .slice(0, 5),
    questoes: indice.questoes.filter((x) => normalizar(x.enunciado).includes(t)).slice(0, 5),
  };
}

export function totalResultados(resultado) {
  return resultado.topicos.length + resultado.labs.length + resultado.flashcards.length + resultado.questoes.length;
}
