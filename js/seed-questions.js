// seed-questions.js
// Popula content/questions/items com um lote inicial de questões de exemplo.
// Segue o MESMO padrão da Fase 1 (seed-content.js): só grava se ainda não populado,
// e exige que suas regras do Firestore liberem escrita em content/ pro seu UID.
//
// Formato de cada questão — use este molde pra ir expandindo o banco:
// {
//   id, dominio, topicId, dificuldade: "facil"|"medio"|"dificil",
//   enunciado, alternativas: {A,B,C,D}, respostaCorreta: "A"|"B"|"C"|"D", justificativa
// }

import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const questoesExemplo = [
  {
    id: "q-1.5-001",
    dominio: "Network Fundamentals",
    topicId: "m12-02",
    dificuldade: "facil",
    enunciado: "Qual é a máscara de sub-rede padrão para uma rede classe C?",
    alternativas: { A: "255.0.0.0", B: "255.255.0.0", C: "255.255.255.0", D: "255.255.255.255" },
    respostaCorreta: "C",
    justificativa: "Redes classe C usam os primeiros 24 bits para rede, ou seja, 255.255.255.0.",
  },
  {
    id: "q-2.3-001",
    dominio: "Network Access",
    topicId: "m10-04",
    dificuldade: "medio",
    enunciado: "No STP, qual porta em um switch não-root com o menor custo até a raiz é chamada de?",
    alternativas: { A: "Designated Port", B: "Root Port", C: "Blocking Port", D: "Alternate Port" },
    respostaCorreta: "B",
    justificativa: "A Root Port é a porta de menor custo até a bridge raiz em um switch não-root.",
  },
  {
    id: "q-3.3-001",
    dominio: "IP Connectivity",
    topicId: "m16-03",
    dificuldade: "dificil",
    enunciado: "Em OSPF, qual comando define o ID do roteador manualmente?",
    alternativas: {
      A: "router-id",
      B: "ospf router-id",
      C: "network router-id",
      D: "id ospf",
    },
    respostaCorreta: "A",
    justificativa: "Dentro do modo de configuração do OSPF, o comando `router-id X.X.X.X` define o Router ID manualmente.",
  },
  {
    id: "q-1.4-001",
    dominio: "Network Fundamentals",
    topicId: "m04-03",
    dificuldade: "facil",
    enunciado: "Qual protocolo garante entrega confiável e ordenada dos dados?",
    alternativas: { A: "UDP", B: "TCP", C: "ICMP", D: "ARP" },
    respostaCorreta: "B",
    justificativa: "TCP é orientado a conexão, com confirmação de entrega e reordenação de pacotes.",
  },
  {
    id: "q-1.6-001",
    dominio: "Network Fundamentals",
    topicId: "m18-02",
    dificuldade: "medio",
    enunciado: "Qual o prefixo padrão de um endereço IPv6 link-local?",
    alternativas: { A: "fe80::/10", B: "2001::/32", C: "ff00::/8", D: "::1/128" },
    respostaCorreta: "A",
    justificativa: "fe80::/10 é reservado para endereços link-local em IPv6.",
  },
  {
    id: "q-2.1-001",
    dominio: "Network Access",
    topicId: "m07-03",
    dificuldade: "facil",
    enunciado: "Qual protocolo padroniza o encapsulamento de VLAN em enlaces trunk?",
    alternativas: { A: "ISL", B: "802.1Q", C: "802.1X", D: "LACP" },
    respostaCorreta: "B",
    justificativa: "802.1Q é o padrão IEEE de trunking de VLANs, sucessor do ISL proprietário da Cisco.",
  },
  {
    id: "q-2.4-001",
    dominio: "Network Access",
    topicId: "m09-03",
    dificuldade: "medio",
    enunciado: "Qual protocolo é padrão aberto (não proprietário) para EtherChannel?",
    alternativas: { A: "PAgP", B: "LACP", C: "HSRP", D: "VTP" },
    respostaCorreta: "B",
    justificativa: "LACP (802.3ad) é o padrão IEEE aberto; PAgP é proprietário da Cisco.",
  },
  {
    id: "q-3.2-001",
    dominio: "IP Connectivity",
    topicId: "m14-02",
    dificuldade: "facil",
    enunciado: "Qual comando cria uma rota estática padrão apontando para 192.168.1.1?",
    alternativas: {
      A: "ip route 0.0.0.0 0.0.0.0 192.168.1.1",
      B: "ip default-route 192.168.1.1",
      C: "route add default 192.168.1.1",
      D: "ip static-route 192.168.1.1",
    },
    respostaCorreta: "A",
    justificativa: "A sintaxe `ip route 0.0.0.0 0.0.0.0 <next-hop>` cria a rota padrão (default route).",
  },
  {
    id: "q-3.4-001",
    dominio: "IP Connectivity",
    topicId: "m15-05",
    dificuldade: "medio",
    enunciado: "Qual protocolo FHRP é proprietário da Cisco?",
    alternativas: { A: "VRRP", B: "GLBP", C: "CARP", D: "STP" },
    respostaCorreta: "B",
    justificativa: "HSRP e GLBP são protocolos proprietários Cisco; VRRP é o padrão aberto equivalente ao HSRP.",
  },
  {
    id: "q-4.3-001",
    dominio: "IP Services",
    topicId: "m20-01",
    dificuldade: "facil",
    enunciado: "Qual é a sequência correta do processo DHCP?",
    alternativas: { A: "Offer, Discover, Ack, Request", B: "Discover, Offer, Request, Ack", C: "Request, Discover, Offer, Ack", D: "Discover, Request, Ack, Offer" },
    respostaCorreta: "B",
    justificativa: "DORA: Discover → Offer → Request → Ack.",
  },
  {
    id: "q-4.7-001",
    dominio: "IP Services",
    topicId: "m24-01",
    dificuldade: "facil",
    enunciado: "Qual porta padrão o SSH utiliza?",
    alternativas: { A: "21", B: "22", C: "23", D: "443" },
    respostaCorreta: "B",
    justificativa: "SSH usa a porta TCP 22 por padrão.",
  },
  {
    id: "q-5.4-001",
    dominio: "Security Fundamentals",
    topicId: "m23-01",
    dificuldade: "medio",
    enunciado: "O que acontece quando um pacote não corresponde a nenhuma linha de uma ACL?",
    alternativas: { A: "É permitido por padrão", B: "É negado por padrão (deny implícito)", C: "Gera erro de configuração", D: "É registrado em log e permitido" },
    respostaCorreta: "B",
    justificativa: "Toda ACL tem um 'deny any' implícito ao final.",
  },
  {
    id: "q-5.5-001",
    dominio: "Security Fundamentals",
    topicId: "m25-03",
    dificuldade: "medio",
    enunciado: "Qual recurso de camada 2 impede servidores DHCP não autorizados na rede?",
    alternativas: { A: "Port Security", B: "DHCP Snooping", C: "BPDU Guard", D: "Dynamic ARP Inspection" },
    respostaCorreta: "B",
    justificativa: "DHCP Snooping filtra mensagens DHCP de fontes não confiáveis.",
  },
  {
    id: "q-6.4-001",
    dominio: "Automation and Programmability",
    topicId: "m37-02",
    dificuldade: "facil",
    enunciado: "Qual método HTTP é normalmente usado para CRIAR um recurso via REST API?",
    alternativas: { A: "GET", B: "POST", C: "DELETE", D: "HEAD" },
    respostaCorreta: "B",
    justificativa: "POST é convencionalmente usado para criar um novo recurso.",
  },
  {
    id: "q-6.5-001",
    dominio: "Automation and Programmability",
    topicId: "m37-05",
    dificuldade: "facil",
    enunciado: "Qual formato de dados usa indentação para representar hierarquia, sem chaves?",
    alternativas: { A: "JSON", B: "XML", C: "YAML", D: "CSV" },
    respostaCorreta: "C",
    justificativa: "YAML usa indentação (espaços) para representar estrutura hierárquica.",
  },
];

export async function seedQuestionsIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data().questionsSeeded) {
    console.log("[seed] Banco de questões já populado, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  questoesExemplo.forEach((q) => {
    const ref = doc(db, "content", "questions", "items", q.id);
    batch.set(ref, q);
  });
  batch.set(metaRef, { questionsSeeded: true, questionsCount: questoesExemplo.length, questionsSeededAt: serverTimestamp() }, { merge: true });

  await batch.commit();
  console.log(`[seed] ✅ ${questoesExemplo.length} questões gravadas`);
  return { seeded: true, count: questoesExemplo.length };
}
