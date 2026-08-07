// seed-flashcards.js
// Popula content/flashcards/items — mesmo padrão de seed das outras coleções.
// Formato: { id, topicId, categoria, front, back }
// front/back alimentam o SRS (srs-engine.js cria os cards do usuário a partir daqui).

import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

const flashcards = [
  // IPv4
  { id: "fc-ipv4-01", topicId: "m12-01", categoria: "IPv4", front: "Quantos hosts utilizáveis tem uma rede /28?", back: "14 hosts utilizáveis (2^4 - 2)." },
  { id: "fc-ipv4-02", topicId: "m12-02", categoria: "IPv4", front: "Qual a máscara em CIDR equivalente a 255.255.255.192?", back: "/26" },
  { id: "fc-ipv4-03", topicId: "m12-04", categoria: "IPv4", front: "Faixa de endereços privados classe A?", back: "10.0.0.0 – 10.255.255.255" },

  // IPv6
  { id: "fc-ipv6-01", topicId: "m18-02", categoria: "IPv6", front: "Qual o prefixo padrão de uma rede IPv6 link-local?", back: "fe80::/10" },
  { id: "fc-ipv6-02", topicId: "m18-01", categoria: "IPv6", front: "Como se abrevia 2001:0db8:0000:0000:0000:0000:0000:0001?", back: "2001:db8::1" },

  // VLAN
  { id: "fc-vlan-01", topicId: "m07-01", categoria: "VLAN", front: "Qual comando cria a VLAN 20 com nome TI?", back: "vlan 20 / name TI" },
  { id: "fc-vlan-02", topicId: "m07-03", categoria: "VLAN", front: "Qual protocolo faz o encapsulamento de trunk padrão da indústria?", back: "802.1Q" },
  { id: "fc-vlan-03", topicId: "m07-06", categoria: "VLAN", front: "O que é a VLAN nativa em um trunk 802.1Q?", back: "A VLAN cujo tráfego trafega sem tag no trunk." },

  // STP
  { id: "fc-stp-01", topicId: "m10-01", categoria: "STP", front: "Qual switch é eleito Root Bridge?", back: "O de menor Bridge ID (prioridade + MAC)." },
  { id: "fc-stp-02", topicId: "m10-05", categoria: "STP", front: "Quais os estados de porta no RSTP?", back: "Discarding, Learning, Forwarding." },
  { id: "fc-stp-03", topicId: "m11-02", categoria: "STP", front: "O que é BPDU Guard?", back: "Recurso que desativa a porta se receber uma BPDU em porta de acesso (PortFast)." },

  // OSPF
  { id: "fc-ospf-01", topicId: "m16-02", categoria: "OSPF", front: "Qual o comando para anunciar uma rede na área 0 do OSPF?", back: "network <rede> <wildcard> area 0" },
  { id: "fc-ospf-02", topicId: "m17-04", categoria: "OSPF", front: "Qual métrica o OSPF usa por padrão?", back: "Custo, baseado na largura de banda da interface (referência 100 Mbps)." },
  { id: "fc-ospf-03", topicId: "m16-04", categoria: "OSPF", front: "Quais os estados de vizinhança do OSPF até Full?", back: "Down → Init → 2-Way → ExStart → Exchange → Loading → Full." },

  // ACL
  { id: "fc-acl-01", topicId: "m23-01", categoria: "ACL", front: "Qual a diferença entre ACL padrão e estendida?", back: "Padrão filtra só por IP de origem; estendida filtra origem, destino, protocolo e porta." },
  { id: "fc-acl-02", topicId: "m23-01", categoria: "ACL", front: "O que acontece se uma ACL não tiver nenhuma regra correspondente?", back: "É negado implicitamente (deny any implícito no final)." },
  { id: "fc-acl-03", topicId: "m23-03", categoria: "ACL", front: "Onde aplicar uma ACL estendida, mais perto da origem ou do destino?", back: "O mais perto possível da origem." },

  // NAT
  { id: "fc-nat-01", topicId: "m21-06", categoria: "NAT", front: "O que é PAT?", back: "Port Address Translation — vários IPs privados compartilham 1 IP público usando portas diferentes." },
  { id: "fc-nat-02", topicId: "m21-04", categoria: "NAT", front: "Qual comando marca uma interface como 'dentro' no NAT?", back: "ip nat inside" },

  // DHCP
  { id: "fc-dhcp-01", topicId: "m20-01", categoria: "DHCP", front: "Quais as 4 fases do processo DHCP?", back: "Discover, Offer, Request, Ack (DORA)." },
  { id: "fc-dhcp-02", topicId: "m20-03", categoria: "DHCP", front: "Pra que serve o DHCP Relay?", back: "Encaminhar requisições DHCP entre sub-redes diferentes, até um servidor DHCP remoto." },

  // Wireless
  { id: "fc-wifi-01", topicId: "m34-02", categoria: "Wireless", front: "Qual a diferença entre AP autônomo e AP lightweight?", back: "Autônomo funciona sozinho; lightweight depende de um WLC (Wireless LAN Controller)." },
  { id: "fc-wifi-02", topicId: "m34-01", categoria: "Wireless", front: "O que é roaming em redes wireless?", back: "Cliente muda de AP sem perder a conexão, mantendo a sessão ativa." },

  // Automation
  { id: "fc-auto-01", topicId: "m37-05", categoria: "Automation", front: "Qual formato de dados usa indentação (sem chaves) para estruturar dados?", back: "YAML" },
  { id: "fc-auto-02", topicId: "m37-02", categoria: "Automation", front: "Quais os métodos HTTP mais usados em REST APIs?", back: "GET, POST, PUT, DELETE." },
  { id: "fc-auto-03", topicId: "m37-01", categoria: "Automation", front: "O que caracteriza uma arquitetura controller-based (SDN)?", back: "Plano de controle centralizado num controller, separado do plano de dados dos switches/roteadores." },

  // Security
  { id: "fc-sec-01", topicId: "m25-03", categoria: "Security", front: "O que é DHCP Snooping?", back: "Recurso de segurança de camada 2 que bloqueia servidores DHCP não autorizados na rede." },
  { id: "fc-sec-02", topicId: "m25-01", categoria: "Security", front: "O que é Port Security?", back: "Limita/controla quais MAC addresses podem usar uma porta de switch." },
  { id: "fc-sec-03", topicId: "m35-02", categoria: "Security", front: "Qual a principal melhoria do WPA3 sobre o WPA2?", back: "Uso do SAE (Simultaneous Authentication of Equals), mais resistente a ataques offline de dicionário." },
  { id: "fc-sec-04", topicId: "m24-02", categoria: "Security", front: "O que significa AAA em segurança de rede?", back: "Authentication, Authorization, Accounting." },
];

export async function seedFlashcardsIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data().flashcardsSeeded) {
    console.log("[seed] Flashcards já populados, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  flashcards.forEach((fc) => {
    const ref = doc(db, "content", "flashcards", "items", fc.id);
    batch.set(ref, fc);
  });
  batch.set(metaRef, { flashcardsSeeded: true, flashcardsCount: flashcards.length, flashcardsSeededAt: serverTimestamp() }, { merge: true });

  await batch.commit();
  console.log(`[seed] ✅ ${flashcards.length} flashcards gravados`);
  return { seeded: true, count: flashcards.length };
}
