// book-map.js
// Ponte entre a trilha de estudos e os livros da Biblioteca.
//
// A trilha do app foi montada capítulo a capítulo espelhando o
// "CCNA 200-301 Official Cert Guide" (Wendell Odom, Cisco Press, 2ª edição):
//   módulos 1–29  -> Volume 1, capítulos 1–29
//   módulos 30–53 -> Volume 2, capítulos 1–24
//
// Aqui guardamos só os TÍTULOS dos capítulos (dado factual de referência, como
// uma citação "ver capítulo X") — nenhum conteúdo dos livros é reproduzido.

export const CAPITULOS_VOL1 = [
  null, // posição 0 não usada — capítulos começam em 1
  "Introduction to TCP/IP Networking",
  "Fundamentals of Ethernet LANs",
  "Fundamentals of WANs and IP Routing",
  "Using the Command-Line Interface",
  "Analyzing Ethernet LAN Switching",
  "Configuring Basic Switch Management",
  "Configuring and Verifying Switch Interfaces",
  "Implementing Ethernet Virtual LANs",
  "Spanning Tree Protocol Concepts",
  "RSTP and EtherChannel Configuration",
  "Perspectives on IPv4 Subnetting",
  "Analyzing Classful IPv4 Networks",
  "Analyzing Subnet Masks",
  "Analyzing Existing Subnets",
  "Subnet Design",
  "Operating Cisco Routers",
  "Configuring IPv4 Addresses and Static Routes",
  "IP Routing in the LAN",
  "IP Addressing on Hosts",
  "Troubleshooting IPv4 Routing",
  "Understanding OSPF Concepts",
  "Implementing Basic OSPF Features",
  "Implementing Optional OSPF Features",
  "OSPF Neighbors and Route Selection",
  "Fundamentals of IP Version 6",
  "IPv6 Addressing and Subnetting",
  "Implementing IPv6 Addressing on Routers",
  "Implementing IPv6 Addressing on Hosts",
  "Implementing IPv6 Routing",
];

export const CAPITULOS_VOL2 = [
  null,
  "Fundamentals of Wireless Networks",
  "Analyzing Cisco Wireless Architectures",
  "Securing Wireless Networks",
  "Building a Wireless LAN",
  "Introduction to TCP/IP Transport and Applications",
  "Basic IPv4 Access Control Lists",
  "Named and Extended IP ACLs",
  "Applied IP ACLs",
  "Security Architectures",
  "Securing Network Devices",
  "Implementing Switch Port Security",
  "DHCP Snooping and ARP Inspection",
  "Device Management Protocols",
  "Network Address Translation",
  "Quality of Service (QoS)",
  "First Hop Redundancy Protocols",
  "SNMP, FTP, and TFTP",
  "LAN Architecture",
  "WAN Architecture",
  "Cloud Architecture",
  "Introduction to Controller-Based Networking",
  "Cisco Software-Defined Access (Cisco SD-Access)",
  "Understanding REST and JSON",
  "Understanding Ansible and Terraform",
];

const ULTIMO_MODULO_VOL1 = 29;

/**
 * Dado o número de ordem de um módulo (1..53), devolve o capítulo do livro:
 *   { vol: 1|2, cap: number, titulo: string }  ou  null se fora do intervalo.
 */
export function capituloDaLicao(moduloOrder) {
  const n = Number(moduloOrder);
  if (!Number.isInteger(n) || n < 1) return null;

  if (n <= ULTIMO_MODULO_VOL1) {
    return { vol: 1, cap: n, titulo: CAPITULOS_VOL1[n] || null };
  }
  const cap = n - ULTIMO_MODULO_VOL1;
  if (cap > CAPITULOS_VOL2.length - 1) return null;
  return { vol: 2, cap, titulo: CAPITULOS_VOL2[cap] || null };
}

/**
 * Procura, na lista de livros da Biblioteca, o que corresponde ao volume pedido.
 * Heurística simples pelo título/campo volume ("Vol 1", "Volume 2", "Vol.1"...).
 * Retorna o objeto do livro ou null.
 */
export function acharLivroDoVolume(vol, livros) {
  const rx = vol === 1 ? /(vol|volume)\.?\s*1\b/i : /(vol|volume)\.?\s*2\b/i;
  return (livros || []).find((l) => rx.test(`${l.titulo || ""} ${l.volume || ""}`)) || null;
}

/** Total de capítulos técnicos mapeados por volume (pra montar a grade de progresso). */
export const TOTAL_CAPITULOS = { 1: CAPITULOS_VOL1.length - 1, 2: CAPITULOS_VOL2.length - 1 };
