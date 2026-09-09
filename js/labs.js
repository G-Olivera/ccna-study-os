// labs.js
// Busca um laboratório do conteúdo global (comandos, topologia e erros comuns
// já vêm no doc do lab — ver seed-labs.js). Usado pelo simulador de CLI.

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function getLabById(labId) {
  const snap = await getDoc(doc(db, "content", "labs", "items", labId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
