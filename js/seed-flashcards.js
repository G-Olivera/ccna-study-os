// seed-flashcards.js
// Popula content/flashcards/items — mesmo padrão de seed das outras coleções.
// Formato: { id, topicId, categoria, front, back }
// front/back alimentam o SRS (srs-engine.js cria os cards do usuário a partir daqui).

import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const flashcards = [
  // IPv4
  { id: "fc-ipv4-01", topicId: "m13-02", categoria: "IPv4", front: "Quantos hosts utilizáveis tem uma rede /28?", back: "14 hosts utilizáveis (2^4 - 2)." },
  { id: "fc-ipv4-02", topicId: "m13-01", categoria: "IPv4", front: "Qual a máscara em CIDR equivalente a 255.255.255.192?", back: "/26" },
  { id: "fc-ipv4-03", topicId: "m12-01", categoria: "IPv4", front: "Faixa de endereços privados classe A?", back: "10.0.0.0 – 10.255.255.255" },

  // IPv6
  { id: "fc-ipv6-01", topicId: "m25-02", categoria: "IPv6", front: "Qual o prefixo padrão de uma rede IPv6 link-local?", back: "fe80::/10" },
  { id: "fc-ipv6-02", topicId: "m26-01", categoria: "IPv6", front: "Como se abrevia 2001:0db8:0000:0000:0000:0000:0000:0001?", back: "2001:db8::1" },

  // VLAN
  { id: "fc-vlan-01", topicId: "m08-01", categoria: "VLAN", front: "Qual comando cria a VLAN 20 com nome TI?", back: "vlan 20 / name TI" },
  { id: "fc-vlan-02", topicId: "m08-02", categoria: "VLAN", front: "Qual protocolo faz o encapsulamento de trunk padrão da indústria?", back: "802.1Q" },
  { id: "fc-vlan-03", topicId: "m08-04", categoria: "VLAN", front: "O que é a VLAN nativa em um trunk 802.1Q?", back: "A VLAN cujo tráfego trafega sem tag no trunk." },

  // STP
  { id: "fc-stp-01", topicId: "m09-02", categoria: "STP", front: "Qual switch é eleito Root Bridge?", back: "O de menor Bridge ID (prioridade + MAC)." },
  { id: "fc-stp-02", topicId: "m09-04", categoria: "STP", front: "Quais os estados de porta no RSTP?", back: "Discarding, Learning, Forwarding." },
  { id: "fc-stp-03", topicId: "m10-02", categoria: "STP", front: "O que é BPDU Guard?", back: "Recurso que desativa a porta se receber uma BPDU em porta de acesso (PortFast)." },

  // OSPF
  { id: "fc-ospf-01", topicId: "m22-01", categoria: "OSPF", front: "Qual o comando para anunciar uma rede na área 0 do OSPF?", back: "network <rede> <wildcard> area 0" },
  { id: "fc-ospf-02", topicId: "m24-03", categoria: "OSPF", front: "Qual métrica o OSPF usa por padrão?", back: "Custo, baseado na largura de banda da interface (referência 100 Mbps)." },
  { id: "fc-ospf-03", topicId: "m24-01", categoria: "OSPF", front: "Quais os estados de vizinhança do OSPF até Full?", back: "Down → Init → 2-Way → ExStart → Exchange → Loading → Full." },

  // ACL
  { id: "fc-acl-01", topicId: "m35-01", categoria: "ACL", front: "Qual a diferença entre ACL padrão e estendida?", back: "Padrão filtra só por IP de origem; estendida filtra origem, destino, protocolo e porta." },
  { id: "fc-acl-02", topicId: "m36-02", categoria: "ACL", front: "O que acontece se uma ACL não tiver nenhuma regra correspondente?", back: "É negado implicitamente (deny any implícito no final)." },
  { id: "fc-acl-03", topicId: "m35-03", categoria: "ACL", front: "Onde aplicar uma ACL estendida, mais perto da origem ou do destino?", back: "O mais perto possível da origem." },

  // NAT
  { id: "fc-nat-01", topicId: "m43-03", categoria: "NAT", front: "O que é PAT?", back: "Port Address Translation — vários IPs privados compartilham 1 IP público usando portas diferentes." },
  { id: "fc-nat-02", topicId: "m43-01", categoria: "NAT", front: "Qual comando marca uma interface como 'dentro' no NAT?", back: "ip nat inside" },

  // DHCP
  { id: "fc-dhcp-01", topicId: "m19-01", categoria: "DHCP", front: "Quais as 4 fases do processo DHCP?", back: "Discover, Offer, Request, Ack (DORA)." },
  { id: "fc-dhcp-02", topicId: "m19-01", categoria: "DHCP", front: "Pra que serve o DHCP Relay?", back: "Encaminhar requisições DHCP entre sub-redes diferentes, até um servidor DHCP remoto." },

  // Wireless
  { id: "fc-wifi-01", topicId: "m31-01", categoria: "Wireless", front: "Qual a diferença entre AP autônomo e AP lightweight?", back: "Autônomo funciona sozinho; lightweight depende de um WLC (Wireless LAN Controller)." },
  { id: "fc-wifi-02", topicId: "m31-02", categoria: "Wireless", front: "O que é roaming em redes wireless?", back: "Cliente muda de AP sem perder a conexão, mantendo a sessão ativa." },

  // Automation
  { id: "fc-auto-01", topicId: "m53-01", categoria: "Automation", front: "Qual formato de dados usa indentação (sem chaves) para estruturar dados?", back: "YAML" },
  { id: "fc-auto-02", topicId: "m52-01", categoria: "Automation", front: "Quais os métodos HTTP mais usados em REST APIs?", back: "GET, POST, PUT, DELETE." },
  { id: "fc-auto-03", topicId: "m50-01", categoria: "Automation", front: "O que caracteriza uma arquitetura controller-based (SDN)?", back: "Plano de controle centralizado num controller, separado do plano de dados dos switches/roteadores." },

  // Security
  { id: "fc-sec-01", topicId: "m41-01", categoria: "Security", front: "O que é DHCP Snooping?", back: "Recurso de segurança de camada 2 que bloqueia servidores DHCP não autorizados na rede." },
  { id: "fc-sec-02", topicId: "m40-01", categoria: "Security", front: "O que é Port Security?", back: "Limita/controla quais MAC addresses podem usar uma porta de switch." },
  { id: "fc-sec-03", topicId: "m32-02", categoria: "Security", front: "Qual a principal melhoria do WPA3 sobre o WPA2?", back: "Uso do SAE (Simultaneous Authentication of Equals), mais resistente a ataques offline de dicionário." },
  { id: "fc-sec-04", topicId: "m38-02", categoria: "Security", front: "O que significa AAA em segurança de rede?", back: "Authentication, Authorization, Accounting." },

  // Binário / Hexadecimal
  { id: "fc-bin-01", topicId: "m11-01", categoria: "Binário", front: "Qual o valor decimal de 11000000 em binário?", back: "192" },
  { id: "fc-bin-02", topicId: "m11-02", categoria: "Binário", front: "Quantos bits tem um endereço IPv6?", back: "128 bits (contra 32 bits do IPv4)." },

  // ARP e ICMP
  { id: "fc-arp-01", topicId: "m01-04", categoria: "ARP", front: "Para que serve o ARP?", back: "Descobrir o endereço MAC associado a um endereço IP conhecido na mesma rede local." },
  { id: "fc-icmp-01", topicId: "m20-02", categoria: "ICMP", front: "Qual comando usa ICMP pra mostrar o caminho até um destino, hop por hop?", back: "traceroute (ou tracert no Windows)." },

  // TCP
  { id: "fc-tcp-01", topicId: "m34-01", categoria: "TCP", front: "Como se chama o processo de 3 passos que estabelece uma conexão TCP?", back: "Three-way handshake: SYN, SYN-ACK, ACK." },

  // Segurança de porta e DHCP Snooping
  { id: "fc-portsec-01", topicId: "m40-02", categoria: "Security", front: "No Port Security, qual modo de violação descarta o tráfego mas NÃO desliga a porta?", back: "Restrict — descarta o tráfego e gera log, sem colocar a porta em err-disabled." },
  { id: "fc-dhcpsnoop-01", topicId: "m41-01", categoria: "Security", front: "No DHCP Snooping, o que é uma porta 'trusted'?", back: "Porta que pode enviar respostas DHCP (normalmente onde está o servidor DHCP real ou o uplink)." },

  // Wireless avançado
  { id: "fc-wlc-01", topicId: "m31-02", categoria: "Wireless", front: "Qual protocolo o AP lightweight usa pra se comunicar com o WLC?", back: "CAPWAP (Control and Provisioning of Wireless Access Points)." },
  { id: "fc-wlan-01", topicId: "m33-01", categoria: "Wireless", front: "O que é uma Policy Tag num WLC IOS-XE?", back: "Mapeia o perfil de WLAN ao perfil de política, aplicado aos APs." },

  // VPN / IPsec
  { id: "fc-vpn-01", topicId: "m48-02", categoria: "VPN", front: "O que o IPsec garante no tráfego entre dois pontos?", back: "Confidencialidade, integridade e autenticação dos pacotes IP." },
  { id: "fc-vpn-02", topicId: "m48-02", categoria: "VPN", front: "Qual a diferença entre VPN site-to-site e VPN de acesso remoto?", back: "Site-to-site conecta redes inteiras entre si; acesso remoto conecta um usuário individual a uma rede." },

  // QoS
  { id: "fc-qos-01", topicId: "m44-01", categoria: "QoS", front: "Qual tipo de tráfego é mais sensível a atraso e variação (jitter): voz ou dados?", back: "Voz — é o mais sensível a atraso, jitter e perda de pacotes." },
  { id: "fc-qos-02", topicId: "m44-02", categoria: "QoS", front: "Qual a diferença entre shaping e policing?", back: "Shaping enfileira o tráfego excedente pra enviar depois; policing simplesmente descarta o excedente." },

  // Gerenciamento (CDP/LLDP/Syslog/NTP)
  { id: "fc-cdp-01", topicId: "m42-03", categoria: "Gerenciamento", front: "Qual protocolo de descoberta é proprietário da Cisco, e qual é o padrão aberto equivalente?", back: "CDP é proprietário Cisco; LLDP é o padrão aberto (IEEE 802.1AB)." },
  { id: "fc-ntp-01", topicId: "m42-02", categoria: "Gerenciamento", front: "Pra que serve o NTP?", back: "Sincronizar o relógio dos dispositivos de rede com um horário confiável." },

  // Automação
  { id: "fc-config-mgmt-01", topicId: "m53-01", categoria: "Automation", front: "Ansible usa arquitetura agentless ou precisa de agente instalado no dispositivo gerenciado?", back: "Agentless — não precisa instalar nada no dispositivo gerenciado, usa SSH." },
  { id: "fc-nat64-01", topicId: "m43-01", categoria: "NAT", front: "Pra que serve o NAT64?", back: "Traduz endereços entre uma rede IPv6-only e uma rede IPv4, permitindo comunicação entre elas." },
];

export async function seedFlashcardsIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists() && metaSnap.data().flashcardsSeededV3) {
    console.log("[seed] Flashcards já populados, pulando.");
    return { seeded: false };
  }

  const batch = writeBatch(db);
  flashcards.forEach((fc) => {
    const ref = doc(db, "content", "flashcards", "items", fc.id);
    batch.set(ref, fc);
  });
  batch.set(metaRef, { flashcardsSeededV3: true, flashcardsCount: flashcards.length, flashcardsSeededV3At: serverTimestamp() }, { merge: true });

  await batch.commit();
  console.log(`[seed] ✅ ${flashcards.length} flashcards gravados`);
  return { seeded: true, count: flashcards.length };
}
