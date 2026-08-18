// seed-content.js
// Popula content/topics/items no primeiro login, direto pelo navegador.
// Estrutura: 53 módulos / 134 lições, espelhando os capítulos do CCNA 200-301
// Official Cert Guide (Volumes 1 e 2, Wendell Odom) — usa apenas os títulos dos
// capítulos (estrutura factual) como nomes de módulo, sem reproduzir texto do livro.
// Só grava se ainda não existir nada lá (verifica um doc marcador em content/meta).

import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

const topics = [
  {
    "id": "m01-01",
    "dominio": "Network Fundamentals",
    "modulo": "Introdução ao Networking TCP/IP",
    "moduloOrder": 1,
    "nome": "Modelo de rede TCP/IP",
    "peso": 20
  },
  {
    "id": "m01-02",
    "dominio": "Network Fundamentals",
    "modulo": "Introdução ao Networking TCP/IP",
    "moduloOrder": 1,
    "nome": "Camada de aplicação e HTTP",
    "peso": 20
  },
  {
    "id": "m01-03",
    "dominio": "Network Fundamentals",
    "modulo": "Introdução ao Networking TCP/IP",
    "moduloOrder": 1,
    "nome": "Camada de transporte: erro e reenvio",
    "peso": 20
  },
  {
    "id": "m01-04",
    "dominio": "Network Fundamentals",
    "modulo": "Introdução ao Networking TCP/IP",
    "moduloOrder": 1,
    "nome": "Camada de rede e roteamento IP",
    "peso": 20
  },
  {
    "id": "m01-05",
    "dominio": "Network Fundamentals",
    "modulo": "Introdução ao Networking TCP/IP",
    "moduloOrder": 1,
    "nome": "Modelo OSI vs TCP/IP",
    "peso": 20
  },
  {
    "id": "m02-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LANs Ethernet",
    "moduloOrder": 2,
    "nome": "Padrões físicos Ethernet",
    "peso": 20
  },
  {
    "id": "m02-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LANs Ethernet",
    "moduloOrder": 2,
    "nome": "Cabeamento UTP e pinagens",
    "peso": 20
  },
  {
    "id": "m02-03",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LANs Ethernet",
    "moduloOrder": 2,
    "nome": "Cabeamento de fibra óptica",
    "peso": 20
  },
  {
    "id": "m02-04",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LANs Ethernet",
    "moduloOrder": 2,
    "nome": "Endereçamento e quadro Ethernet",
    "peso": 20
  },
  {
    "id": "m02-05",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LANs Ethernet",
    "moduloOrder": 2,
    "nome": "Full duplex vs half duplex",
    "peso": 20
  },
  {
    "id": "m03-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de WANs e Roteamento IP",
    "moduloOrder": 3,
    "nome": "Linhas dedicadas (leased lines)",
    "peso": 20
  },
  {
    "id": "m03-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de WANs e Roteamento IP",
    "moduloOrder": 3,
    "nome": "Ethernet como tecnologia WAN",
    "peso": 20
  },
  {
    "id": "m03-03",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de WANs e Roteamento IP",
    "moduloOrder": 3,
    "nome": "Lógica de roteamento IP",
    "peso": 20
  },
  {
    "id": "m03-04",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de WANs e Roteamento IP",
    "moduloOrder": 3,
    "nome": "DNS e ARP",
    "peso": 20
  },
  {
    "id": "m04-01",
    "dominio": "Network Fundamentals",
    "modulo": "Usando a Interface de Linha de Comando",
    "moduloOrder": 4,
    "nome": "Acessando a CLI do switch (console, SSH)",
    "peso": 20
  },
  {
    "id": "m04-02",
    "dominio": "Network Fundamentals",
    "modulo": "Usando a Interface de Linha de Comando",
    "moduloOrder": 4,
    "nome": "Modos usuário e privilegiado",
    "peso": 20
  },
  {
    "id": "m04-03",
    "dominio": "Network Fundamentals",
    "modulo": "Usando a Interface de Linha de Comando",
    "moduloOrder": 4,
    "nome": "Submodos de configuração",
    "peso": 20
  },
  {
    "id": "m04-04",
    "dominio": "Network Fundamentals",
    "modulo": "Usando a Interface de Linha de Comando",
    "moduloOrder": 4,
    "nome": "Salvando e apagando configurações",
    "peso": 20
  },
  {
    "id": "m05-01",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando o Switching Ethernet",
    "moduloOrder": 5,
    "nome": "Lógica de encaminhamento do switch",
    "peso": 20
  },
  {
    "id": "m05-02",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando o Switching Ethernet",
    "moduloOrder": 5,
    "nome": "Aprendizado de endereços MAC",
    "peso": 20
  },
  {
    "id": "m05-03",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando o Switching Ethernet",
    "moduloOrder": 5,
    "nome": "Flooding de unicast desconhecido e broadcast",
    "peso": 20
  },
  {
    "id": "m05-04",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando o Switching Ethernet",
    "moduloOrder": 5,
    "nome": "Tabela de endereços MAC",
    "peso": 20
  },
  {
    "id": "m06-01",
    "dominio": "Network Access",
    "modulo": "Configuração Básica de Gerenciamento do Switch",
    "moduloOrder": 6,
    "nome": "Protegendo o acesso à CLI",
    "peso": 20
  },
  {
    "id": "m06-02",
    "dominio": "Network Access",
    "modulo": "Configuração Básica de Gerenciamento do Switch",
    "moduloOrder": 6,
    "nome": "Configurando SSH",
    "peso": 20
  },
  {
    "id": "m06-03",
    "dominio": "Network Access",
    "modulo": "Configuração Básica de Gerenciamento do Switch",
    "moduloOrder": 6,
    "nome": "Configurando IPv4 no switch (DHCP)",
    "peso": 20
  },
  {
    "id": "m07-01",
    "dominio": "Network Access",
    "modulo": "Configurando e Verificando Interfaces do Switch",
    "moduloOrder": 7,
    "nome": "Autonegociação IEEE",
    "peso": 20
  },
  {
    "id": "m07-02",
    "dominio": "Network Access",
    "modulo": "Configurando e Verificando Interfaces do Switch",
    "moduloOrder": 7,
    "nome": "Configurando velocidade e duplex",
    "peso": 20
  },
  {
    "id": "m07-03",
    "dominio": "Network Access",
    "modulo": "Configurando e Verificando Interfaces do Switch",
    "moduloOrder": 7,
    "nome": "shutdown e no na interface",
    "peso": 20
  },
  {
    "id": "m07-04",
    "dominio": "Network Access",
    "modulo": "Configurando e Verificando Interfaces do Switch",
    "moduloOrder": 7,
    "nome": "Duplex mismatch e problemas de camada 1",
    "peso": 20
  },
  {
    "id": "m08-01",
    "dominio": "Network Access",
    "modulo": "Implementando VLANs Ethernet",
    "moduloOrder": 8,
    "nome": "Criação e atribuição de VLANs",
    "peso": 20
  },
  {
    "id": "m08-02",
    "dominio": "Network Access",
    "modulo": "Implementando VLANs Ethernet",
    "moduloOrder": 8,
    "nome": "Trunking 802.1Q",
    "peso": 20
  },
  {
    "id": "m08-03",
    "dominio": "Network Access",
    "modulo": "Implementando VLANs Ethernet",
    "moduloOrder": 8,
    "nome": "VLAN de voz",
    "peso": 20
  },
  {
    "id": "m08-04",
    "dominio": "Network Access",
    "modulo": "Implementando VLANs Ethernet",
    "moduloOrder": 8,
    "nome": "Troubleshooting de VLAN e trunk",
    "peso": 20
  },
  {
    "id": "m09-01",
    "dominio": "Network Access",
    "modulo": "Conceitos de Spanning Tree Protocol",
    "moduloOrder": 9,
    "nome": "Necessidade do Spanning Tree",
    "peso": 20
  },
  {
    "id": "m09-02",
    "dominio": "Network Access",
    "modulo": "Conceitos de Spanning Tree Protocol",
    "moduloOrder": 9,
    "nome": "Eleição da root bridge",
    "peso": 20
  },
  {
    "id": "m09-03",
    "dominio": "Network Access",
    "modulo": "Conceitos de Spanning Tree Protocol",
    "moduloOrder": 9,
    "nome": "Papéis de porta (root, designated)",
    "peso": 20
  },
  {
    "id": "m09-04",
    "dominio": "Network Access",
    "modulo": "Conceitos de Spanning Tree Protocol",
    "moduloOrder": 9,
    "nome": "RSTP: estados e papel alternate/backup",
    "peso": 20
  },
  {
    "id": "m10-01",
    "dominio": "Network Access",
    "modulo": "Configuração de RSTP e EtherChannel",
    "moduloOrder": 10,
    "nome": "Bridge ID e prioridade do switch",
    "peso": 20
  },
  {
    "id": "m10-02",
    "dominio": "Network Access",
    "modulo": "Configuração de RSTP e EtherChannel",
    "moduloOrder": 10,
    "nome": "PortFast e BPDU Guard",
    "peso": 20
  },
  {
    "id": "m10-03",
    "dominio": "Network Access",
    "modulo": "Configuração de RSTP e EtherChannel",
    "moduloOrder": 10,
    "nome": "Configuração de EtherChannel (LACP/PAgP)",
    "peso": 20
  },
  {
    "id": "m11-01",
    "dominio": "Network Fundamentals",
    "modulo": "Perspectivas sobre Sub-redes IPv4",
    "moduloOrder": 11,
    "nome": "Por que dividir em sub-redes",
    "peso": 20
  },
  {
    "id": "m11-02",
    "dominio": "Network Fundamentals",
    "modulo": "Perspectivas sobre Sub-redes IPv4",
    "moduloOrder": 11,
    "nome": "Estrutura de um endereço IPv4",
    "peso": 20
  },
  {
    "id": "m12-01",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Redes IPv4 Classful",
    "moduloOrder": 12,
    "nome": "Classes de endereço IPv4",
    "peso": 20
  },
  {
    "id": "m12-02",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Redes IPv4 Classful",
    "moduloOrder": 12,
    "nome": "Máscaras padrão por classe",
    "peso": 20
  },
  {
    "id": "m13-01",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Máscaras de Sub-rede",
    "moduloOrder": 13,
    "nome": "Notação CIDR",
    "peso": 20
  },
  {
    "id": "m13-02",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Máscaras de Sub-rede",
    "moduloOrder": 13,
    "nome": "Calculando a máscara a partir dos requisitos",
    "peso": 20
  },
  {
    "id": "m14-01",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Sub-redes Existentes",
    "moduloOrder": 14,
    "nome": "Identificando o endereço de sub-rede",
    "peso": 20
  },
  {
    "id": "m14-02",
    "dominio": "Network Fundamentals",
    "modulo": "Analisando Sub-redes Existentes",
    "moduloOrder": 14,
    "nome": "Endereço de broadcast e faixa utilizável",
    "peso": 20
  },
  {
    "id": "m15-01",
    "dominio": "Network Fundamentals",
    "modulo": "Projeto de Sub-redes (VLSM)",
    "moduloOrder": 15,
    "nome": "VLSM na prática",
    "peso": 20
  },
  {
    "id": "m15-02",
    "dominio": "Network Fundamentals",
    "modulo": "Projeto de Sub-redes (VLSM)",
    "moduloOrder": 15,
    "nome": "Planejando sub-redes para uma topologia",
    "peso": 20
  },
  {
    "id": "m16-01",
    "dominio": "IP Connectivity",
    "modulo": "Operando Roteadores Cisco",
    "moduloOrder": 16,
    "nome": "Componentes de um roteador Cisco",
    "peso": 25
  },
  {
    "id": "m16-02",
    "dominio": "IP Connectivity",
    "modulo": "Operando Roteadores Cisco",
    "moduloOrder": 16,
    "nome": "Interfaces de roteador e status",
    "peso": 25
  },
  {
    "id": "m17-01",
    "dominio": "IP Connectivity",
    "modulo": "Configurando Endereços IPv4 e Rotas Estáticas",
    "moduloOrder": 17,
    "nome": "Configurando IP nas interfaces",
    "peso": 25
  },
  {
    "id": "m17-02",
    "dominio": "IP Connectivity",
    "modulo": "Configurando Endereços IPv4 e Rotas Estáticas",
    "moduloOrder": 17,
    "nome": "Rota estática e rota padrão",
    "peso": 25
  },
  {
    "id": "m17-03",
    "dominio": "IP Connectivity",
    "modulo": "Configurando Endereços IPv4 e Rotas Estáticas",
    "moduloOrder": 17,
    "nome": "Rota estática flutuante",
    "peso": 25
  },
  {
    "id": "m18-01",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento IP na LAN",
    "moduloOrder": 18,
    "nome": "Roteamento inter-VLAN com router-on-a-stick",
    "peso": 25
  },
  {
    "id": "m18-02",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento IP na LAN",
    "moduloOrder": 18,
    "nome": "Roteamento inter-VLAN com SVI",
    "peso": 25
  },
  {
    "id": "m19-01",
    "dominio": "Network Fundamentals",
    "modulo": "Endereçamento IP nos Hosts",
    "moduloOrder": 19,
    "nome": "Configuração estática vs DHCP no host",
    "peso": 20
  },
  {
    "id": "m19-02",
    "dominio": "Network Fundamentals",
    "modulo": "Endereçamento IP nos Hosts",
    "moduloOrder": 19,
    "nome": "Gateway padrão e sub-rede do host",
    "peso": 20
  },
  {
    "id": "m20-01",
    "dominio": "IP Connectivity",
    "modulo": "Troubleshooting de Roteamento IPv4",
    "moduloOrder": 20,
    "nome": "Diagnosticando problemas de rota",
    "peso": 25
  },
  {
    "id": "m20-02",
    "dominio": "IP Connectivity",
    "modulo": "Troubleshooting de Roteamento IPv4",
    "moduloOrder": 20,
    "nome": "Usando ping e traceroute para isolar falhas",
    "peso": 25
  },
  {
    "id": "m21-01",
    "dominio": "IP Connectivity",
    "modulo": "Entendendo os Conceitos do OSPF",
    "moduloOrder": 21,
    "nome": "O que é OSPF e link-state",
    "peso": 25
  },
  {
    "id": "m21-02",
    "dominio": "IP Connectivity",
    "modulo": "Entendendo os Conceitos do OSPF",
    "moduloOrder": 21,
    "nome": "Router ID e área",
    "peso": 25
  },
  {
    "id": "m22-01",
    "dominio": "IP Connectivity",
    "modulo": "Implementando Recursos Básicos do OSPF",
    "moduloOrder": 22,
    "nome": "Comando network e área 0",
    "peso": 25
  },
  {
    "id": "m22-02",
    "dominio": "IP Connectivity",
    "modulo": "Implementando Recursos Básicos do OSPF",
    "moduloOrder": 22,
    "nome": "Verificando vizinhança OSPF",
    "peso": 25
  },
  {
    "id": "m23-01",
    "dominio": "IP Connectivity",
    "modulo": "Recursos Opcionais do OSPF",
    "moduloOrder": 23,
    "nome": "Interface passiva",
    "peso": 25
  },
  {
    "id": "m23-02",
    "dominio": "IP Connectivity",
    "modulo": "Recursos Opcionais do OSPF",
    "moduloOrder": 23,
    "nome": "Rota padrão via OSPF",
    "peso": 25
  },
  {
    "id": "m24-01",
    "dominio": "IP Connectivity",
    "modulo": "Vizinhos OSPF e Seleção de Rota",
    "moduloOrder": 24,
    "nome": "Estados de vizinhança (Down a Full)",
    "peso": 25
  },
  {
    "id": "m24-02",
    "dominio": "IP Connectivity",
    "modulo": "Vizinhos OSPF e Seleção de Rota",
    "moduloOrder": 24,
    "nome": "DR e BDR",
    "peso": 25
  },
  {
    "id": "m24-03",
    "dominio": "IP Connectivity",
    "modulo": "Vizinhos OSPF e Seleção de Rota",
    "moduloOrder": 24,
    "nome": "Métrica de custo OSPF",
    "peso": 25
  },
  {
    "id": "m25-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos do IPv6",
    "moduloOrder": 25,
    "nome": "Motivação e estrutura do IPv6",
    "peso": 20
  },
  {
    "id": "m25-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos do IPv6",
    "moduloOrder": 25,
    "nome": "Tipos de endereço IPv6",
    "peso": 20
  },
  {
    "id": "m26-01",
    "dominio": "Network Fundamentals",
    "modulo": "Endereçamento e Sub-redes IPv6",
    "moduloOrder": 26,
    "nome": "Abreviação de endereços IPv6",
    "peso": 20
  },
  {
    "id": "m26-02",
    "dominio": "Network Fundamentals",
    "modulo": "Endereçamento e Sub-redes IPv6",
    "moduloOrder": 26,
    "nome": "Sub-redes IPv6",
    "peso": 20
  },
  {
    "id": "m27-01",
    "dominio": "IP Connectivity",
    "modulo": "Implementando IPv6 em Roteadores",
    "moduloOrder": 27,
    "nome": "Configurando endereços IPv6 no roteador",
    "peso": 25
  },
  {
    "id": "m27-02",
    "dominio": "IP Connectivity",
    "modulo": "Implementando IPv6 em Roteadores",
    "moduloOrder": 27,
    "nome": "Rota estática IPv6",
    "peso": 25
  },
  {
    "id": "m28-01",
    "dominio": "Network Fundamentals",
    "modulo": "Implementando IPv6 nos Hosts",
    "moduloOrder": 28,
    "nome": "SLAAC",
    "peso": 20
  },
  {
    "id": "m28-02",
    "dominio": "Network Fundamentals",
    "modulo": "Implementando IPv6 nos Hosts",
    "moduloOrder": 28,
    "nome": "DHCPv6",
    "peso": 20
  },
  {
    "id": "m29-01",
    "dominio": "IP Connectivity",
    "modulo": "Implementando Roteamento IPv6",
    "moduloOrder": 29,
    "nome": "OSPFv3 (visão geral)",
    "peso": 25
  },
  {
    "id": "m29-02",
    "dominio": "IP Connectivity",
    "modulo": "Implementando Roteamento IPv6",
    "moduloOrder": 29,
    "nome": "Verificando rotas IPv6",
    "peso": 25
  },
  {
    "id": "m30-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Redes Wireless",
    "moduloOrder": 30,
    "nome": "Topologias wireless (BSS, ESS)",
    "peso": 20
  },
  {
    "id": "m30-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Redes Wireless",
    "moduloOrder": 30,
    "nome": "Bandas e canais de RF",
    "peso": 20
  },
  {
    "id": "m31-01",
    "dominio": "Network Access",
    "modulo": "Arquiteturas Wireless Cisco",
    "moduloOrder": 31,
    "nome": "AP autônomo vs lightweight",
    "peso": 20
  },
  {
    "id": "m31-02",
    "dominio": "Network Access",
    "modulo": "Arquiteturas Wireless Cisco",
    "moduloOrder": 31,
    "nome": "Split-MAC e WLC",
    "peso": 20
  },
  {
    "id": "m31-03",
    "dominio": "Network Access",
    "modulo": "Arquiteturas Wireless Cisco",
    "moduloOrder": 31,
    "nome": "Modos de AP (local, FlexConnect)",
    "peso": 20
  },
  {
    "id": "m32-01",
    "dominio": "Network Access",
    "modulo": "Segurança em Redes Wireless",
    "moduloOrder": 32,
    "nome": "Autenticação, privacidade e integridade",
    "peso": 20
  },
  {
    "id": "m32-02",
    "dominio": "Network Access",
    "modulo": "Segurança em Redes Wireless",
    "moduloOrder": 32,
    "nome": "WPA, WPA2 e WPA3",
    "peso": 20
  },
  {
    "id": "m32-03",
    "dominio": "Network Access",
    "modulo": "Segurança em Redes Wireless",
    "moduloOrder": 32,
    "nome": "802.1X/EAP",
    "peso": 20
  },
  {
    "id": "m33-01",
    "dominio": "Network Access",
    "modulo": "Construindo uma WLAN",
    "moduloOrder": 33,
    "nome": "Conectando e configurando um WLC",
    "peso": 20
  },
  {
    "id": "m33-02",
    "dominio": "Network Access",
    "modulo": "Construindo uma WLAN",
    "moduloOrder": 33,
    "nome": "Criando um WLAN profile e policy tag",
    "peso": 20
  },
  {
    "id": "m34-01",
    "dominio": "Network Fundamentals",
    "modulo": "TCP/IP: Transporte e Aplicações",
    "moduloOrder": 34,
    "nome": "TCP: portas e estabelecimento de conexão",
    "peso": 20
  },
  {
    "id": "m34-02",
    "dominio": "Network Fundamentals",
    "modulo": "TCP/IP: Transporte e Aplicações",
    "moduloOrder": 34,
    "nome": "UDP e diferenças pro TCP",
    "peso": 20
  },
  {
    "id": "m34-03",
    "dominio": "Network Fundamentals",
    "modulo": "TCP/IP: Transporte e Aplicações",
    "moduloOrder": 34,
    "nome": "Controle de fluxo (windowing)",
    "peso": 20
  },
  {
    "id": "m35-01",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IPv4 Básicas",
    "moduloOrder": 35,
    "nome": "ACL padrão numerada",
    "peso": 15
  },
  {
    "id": "m35-02",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IPv4 Básicas",
    "moduloOrder": 35,
    "nome": "Wildcard mask",
    "peso": 15
  },
  {
    "id": "m35-03",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IPv4 Básicas",
    "moduloOrder": 35,
    "nome": "Onde e como aplicar a ACL",
    "peso": 15
  },
  {
    "id": "m36-01",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IP Nomeadas e Estendidas",
    "moduloOrder": 36,
    "nome": "ACL nomeada e edição",
    "peso": 15
  },
  {
    "id": "m36-02",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IP Nomeadas e Estendidas",
    "moduloOrder": 36,
    "nome": "ACL estendida: protocolo, origem, destino, porta",
    "peso": 15
  },
  {
    "id": "m37-01",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IP Aplicadas",
    "moduloOrder": 37,
    "nome": "Cenários práticos de ACL",
    "peso": 15
  },
  {
    "id": "m37-02",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs IP Aplicadas",
    "moduloOrder": 37,
    "nome": "Troubleshooting de ACL",
    "peso": 15
  },
  {
    "id": "m38-01",
    "dominio": "Security Fundamentals",
    "modulo": "Arquiteturas de Segurança",
    "moduloOrder": 38,
    "nome": "Ameaças e vulnerabilidades comuns",
    "peso": 15
  },
  {
    "id": "m38-02",
    "dominio": "Security Fundamentals",
    "modulo": "Arquiteturas de Segurança",
    "moduloOrder": 38,
    "nome": "AAA: autenticação, autorização, accounting",
    "peso": 15
  },
  {
    "id": "m39-01",
    "dominio": "Security Fundamentals",
    "modulo": "Protegendo Dispositivos de Rede",
    "moduloOrder": 39,
    "nome": "Senhas e níveis de privilégio",
    "peso": 15
  },
  {
    "id": "m39-02",
    "dominio": "Security Fundamentals",
    "modulo": "Protegendo Dispositivos de Rede",
    "moduloOrder": 39,
    "nome": "SSH e desativação de serviços inseguros",
    "peso": 15
  },
  {
    "id": "m40-01",
    "dominio": "Security Fundamentals",
    "modulo": "Implementando Port Security",
    "moduloOrder": 40,
    "nome": "Configurando Port Security",
    "peso": 15
  },
  {
    "id": "m40-02",
    "dominio": "Security Fundamentals",
    "modulo": "Implementando Port Security",
    "moduloOrder": 40,
    "nome": "Modos de violação (shutdown, restrict, protect)",
    "peso": 15
  },
  {
    "id": "m41-01",
    "dominio": "Security Fundamentals",
    "modulo": "DHCP Snooping e ARP Inspection",
    "moduloOrder": 41,
    "nome": "DHCP Snooping",
    "peso": 15
  },
  {
    "id": "m41-02",
    "dominio": "Security Fundamentals",
    "modulo": "DHCP Snooping e ARP Inspection",
    "moduloOrder": 41,
    "nome": "Dynamic ARP Inspection (DAI)",
    "peso": 15
  },
  {
    "id": "m42-01",
    "dominio": "IP Services",
    "modulo": "Protocolos de Gerenciamento de Dispositivos",
    "moduloOrder": 42,
    "nome": "Syslog",
    "peso": 10
  },
  {
    "id": "m42-02",
    "dominio": "IP Services",
    "modulo": "Protocolos de Gerenciamento de Dispositivos",
    "moduloOrder": 42,
    "nome": "NTP",
    "peso": 10
  },
  {
    "id": "m42-03",
    "dominio": "IP Services",
    "modulo": "Protocolos de Gerenciamento de Dispositivos",
    "moduloOrder": 42,
    "nome": "CDP e LLDP",
    "peso": 10
  },
  {
    "id": "m43-01",
    "dominio": "IP Services",
    "modulo": "Network Address Translation",
    "moduloOrder": 43,
    "nome": "NAT estático",
    "peso": 10
  },
  {
    "id": "m43-02",
    "dominio": "IP Services",
    "modulo": "Network Address Translation",
    "moduloOrder": 43,
    "nome": "NAT dinâmico",
    "peso": 10
  },
  {
    "id": "m43-03",
    "dominio": "IP Services",
    "modulo": "Network Address Translation",
    "moduloOrder": 43,
    "nome": "PAT (NAT overload)",
    "peso": 10
  },
  {
    "id": "m44-01",
    "dominio": "IP Services",
    "modulo": "Qualidade de Serviço (QoS)",
    "moduloOrder": 44,
    "nome": "Classificação e marcação",
    "peso": 10
  },
  {
    "id": "m44-02",
    "dominio": "IP Services",
    "modulo": "Qualidade de Serviço (QoS)",
    "moduloOrder": 44,
    "nome": "Enfileiramento e policing/shaping",
    "peso": 10
  },
  {
    "id": "m45-01",
    "dominio": "IP Connectivity",
    "modulo": "Protocolos de Redundância de Gateway",
    "moduloOrder": 45,
    "nome": "HSRP",
    "peso": 25
  },
  {
    "id": "m45-02",
    "dominio": "IP Connectivity",
    "modulo": "Protocolos de Redundância de Gateway",
    "moduloOrder": 45,
    "nome": "VRRP e GLBP",
    "peso": 25
  },
  {
    "id": "m46-01",
    "dominio": "IP Services",
    "modulo": "SNMP, FTP e TFTP",
    "moduloOrder": 46,
    "nome": "SNMP: versões e monitoramento",
    "peso": 10
  },
  {
    "id": "m46-02",
    "dominio": "IP Services",
    "modulo": "SNMP, FTP e TFTP",
    "moduloOrder": 46,
    "nome": "Transferência de arquivos com FTP/TFTP",
    "peso": 10
  },
  {
    "id": "m47-01",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de LAN",
    "moduloOrder": 47,
    "nome": "Modelo hierárquico (core, distribution, access)",
    "peso": 20
  },
  {
    "id": "m47-02",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de LAN",
    "moduloOrder": 47,
    "nome": "Arquitetura spine-leaf",
    "peso": 20
  },
  {
    "id": "m48-01",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de WAN",
    "moduloOrder": 48,
    "nome": "Topologias WAN (hub-and-spoke, full mesh)",
    "peso": 20
  },
  {
    "id": "m48-02",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de WAN",
    "moduloOrder": 48,
    "nome": "MPLS e VPN",
    "peso": 20
  },
  {
    "id": "m49-01",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de Nuvem",
    "moduloOrder": 49,
    "nome": "Modelos de serviço (IaaS, PaaS, SaaS)",
    "peso": 20
  },
  {
    "id": "m49-02",
    "dominio": "Network Fundamentals",
    "modulo": "Arquitetura de Nuvem",
    "moduloOrder": 49,
    "nome": "Conectividade com a nuvem",
    "peso": 20
  },
  {
    "id": "m50-01",
    "dominio": "Automation and Programmability",
    "modulo": "Introdução ao Networking Baseado em Controller",
    "moduloOrder": 50,
    "nome": "Plano de controle centralizado (SDN)",
    "peso": 10
  },
  {
    "id": "m50-02",
    "dominio": "Automation and Programmability",
    "modulo": "Introdução ao Networking Baseado em Controller",
    "moduloOrder": 50,
    "nome": "Redes tradicionais vs controller-based",
    "peso": 10
  },
  {
    "id": "m51-01",
    "dominio": "Automation and Programmability",
    "modulo": "Cisco SD-Access",
    "moduloOrder": 51,
    "nome": "Visão geral do SD-Access",
    "peso": 10
  },
  {
    "id": "m51-02",
    "dominio": "Automation and Programmability",
    "modulo": "Cisco SD-Access",
    "moduloOrder": 51,
    "nome": "Fabric e políticas",
    "peso": 10
  },
  {
    "id": "m52-01",
    "dominio": "Automation and Programmability",
    "modulo": "Entendendo REST e JSON",
    "moduloOrder": 52,
    "nome": "Métodos REST (GET, POST, PUT, DELETE)",
    "peso": 10
  },
  {
    "id": "m52-02",
    "dominio": "Automation and Programmability",
    "modulo": "Entendendo REST e JSON",
    "moduloOrder": 52,
    "nome": "Formato de dados JSON",
    "peso": 10
  },
  {
    "id": "m53-01",
    "dominio": "Automation and Programmability",
    "modulo": "Entendendo Ansible e Terraform",
    "moduloOrder": 53,
    "nome": "Automação com Ansible (playbooks)",
    "peso": 10
  },
  {
    "id": "m53-02",
    "dominio": "Automation and Programmability",
    "modulo": "Entendendo Ansible e Terraform",
    "moduloOrder": 53,
    "nome": "Infraestrutura como código com Terraform",
    "peso": 10
  }
];

const modulos = [
  {
    "ordem": 1,
    "nome": "Introdução ao Networking TCP/IP",
    "dominio": "Network Fundamentals",
    "totalLicoes": 5
  },
  {
    "ordem": 2,
    "nome": "Fundamentos de LANs Ethernet",
    "dominio": "Network Fundamentals",
    "totalLicoes": 5
  },
  {
    "ordem": 3,
    "nome": "Fundamentos de WANs e Roteamento IP",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 4,
    "nome": "Usando a Interface de Linha de Comando",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 5,
    "nome": "Analisando o Switching Ethernet",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 6,
    "nome": "Configuração Básica de Gerenciamento do Switch",
    "dominio": "Network Access",
    "totalLicoes": 3
  },
  {
    "ordem": 7,
    "nome": "Configurando e Verificando Interfaces do Switch",
    "dominio": "Network Access",
    "totalLicoes": 4
  },
  {
    "ordem": 8,
    "nome": "Implementando VLANs Ethernet",
    "dominio": "Network Access",
    "totalLicoes": 4
  },
  {
    "ordem": 9,
    "nome": "Conceitos de Spanning Tree Protocol",
    "dominio": "Network Access",
    "totalLicoes": 4
  },
  {
    "ordem": 10,
    "nome": "Configuração de RSTP e EtherChannel",
    "dominio": "Network Access",
    "totalLicoes": 3
  },
  {
    "ordem": 11,
    "nome": "Perspectivas sobre Sub-redes IPv4",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 12,
    "nome": "Analisando Redes IPv4 Classful",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 13,
    "nome": "Analisando Máscaras de Sub-rede",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 14,
    "nome": "Analisando Sub-redes Existentes",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 15,
    "nome": "Projeto de Sub-redes (VLSM)",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 16,
    "nome": "Operando Roteadores Cisco",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 17,
    "nome": "Configurando Endereços IPv4 e Rotas Estáticas",
    "dominio": "IP Connectivity",
    "totalLicoes": 3
  },
  {
    "ordem": 18,
    "nome": "Roteamento IP na LAN",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 19,
    "nome": "Endereçamento IP nos Hosts",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 20,
    "nome": "Troubleshooting de Roteamento IPv4",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 21,
    "nome": "Entendendo os Conceitos do OSPF",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 22,
    "nome": "Implementando Recursos Básicos do OSPF",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 23,
    "nome": "Recursos Opcionais do OSPF",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 24,
    "nome": "Vizinhos OSPF e Seleção de Rota",
    "dominio": "IP Connectivity",
    "totalLicoes": 3
  },
  {
    "ordem": 25,
    "nome": "Fundamentos do IPv6",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 26,
    "nome": "Endereçamento e Sub-redes IPv6",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 27,
    "nome": "Implementando IPv6 em Roteadores",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 28,
    "nome": "Implementando IPv6 nos Hosts",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 29,
    "nome": "Implementando Roteamento IPv6",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 30,
    "nome": "Fundamentos de Redes Wireless",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 31,
    "nome": "Arquiteturas Wireless Cisco",
    "dominio": "Network Access",
    "totalLicoes": 3
  },
  {
    "ordem": 32,
    "nome": "Segurança em Redes Wireless",
    "dominio": "Network Access",
    "totalLicoes": 3
  },
  {
    "ordem": 33,
    "nome": "Construindo uma WLAN",
    "dominio": "Network Access",
    "totalLicoes": 2
  },
  {
    "ordem": 34,
    "nome": "TCP/IP: Transporte e Aplicações",
    "dominio": "Network Fundamentals",
    "totalLicoes": 3
  },
  {
    "ordem": 35,
    "nome": "ACLs IPv4 Básicas",
    "dominio": "Security Fundamentals",
    "totalLicoes": 3
  },
  {
    "ordem": 36,
    "nome": "ACLs IP Nomeadas e Estendidas",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 37,
    "nome": "ACLs IP Aplicadas",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 38,
    "nome": "Arquiteturas de Segurança",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 39,
    "nome": "Protegendo Dispositivos de Rede",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 40,
    "nome": "Implementando Port Security",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 41,
    "nome": "DHCP Snooping e ARP Inspection",
    "dominio": "Security Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 42,
    "nome": "Protocolos de Gerenciamento de Dispositivos",
    "dominio": "IP Services",
    "totalLicoes": 3
  },
  {
    "ordem": 43,
    "nome": "Network Address Translation",
    "dominio": "IP Services",
    "totalLicoes": 3
  },
  {
    "ordem": 44,
    "nome": "Qualidade de Serviço (QoS)",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 45,
    "nome": "Protocolos de Redundância de Gateway",
    "dominio": "IP Connectivity",
    "totalLicoes": 2
  },
  {
    "ordem": 46,
    "nome": "SNMP, FTP e TFTP",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 47,
    "nome": "Arquitetura de LAN",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 48,
    "nome": "Arquitetura de WAN",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 49,
    "nome": "Arquitetura de Nuvem",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 50,
    "nome": "Introdução ao Networking Baseado em Controller",
    "dominio": "Automation and Programmability",
    "totalLicoes": 2
  },
  {
    "ordem": 51,
    "nome": "Cisco SD-Access",
    "dominio": "Automation and Programmability",
    "totalLicoes": 2
  },
  {
    "ordem": 52,
    "nome": "Entendendo REST e JSON",
    "dominio": "Automation and Programmability",
    "totalLicoes": 2
  },
  {
    "ordem": 53,
    "nome": "Entendendo Ansible e Terraform",
    "dominio": "Automation and Programmability",
    "totalLicoes": 2
  }
];

/**
 * Chame esta função logo após o login bem-sucedido (no listener de auth state).
 * Verifica um documento marcador (content/meta) e só grava as lições se ainda
 * não tiverem sido gravadas — não duplica nem sobrescreve progresso em logins futuros.
 */
export async function seedContentIfNeeded() {
  const metaRef = doc(db, "content", "meta");
  const metaSnap = await getDoc(metaRef);

  // Flag "V2" — força a reestruturação mesmo que a v1 (antiga, 37 módulos) já tenha rodado.
  if (metaSnap.exists() && metaSnap.data().topicsSeededV2) {
    console.log("[seed] Conteúdo v2 já populado, pulando.");
    return { seeded: false, reason: "already-seeded" };
  }

  try {
    // Limpa a estrutura antiga (v1) pra não deixar lições órfãs de módulos que não existem mais.
    const antigos = await getDocs(collection(db, "content", "topics", "items"));
    if (!antigos.empty) {
      const deleteBatch = writeBatch(db);
      antigos.docs.forEach((d) => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
      console.log(`[seed] 🗑️ ${antigos.size} lições antigas removidas`);
    }

    const batch = writeBatch(db);

    topics.forEach((topic) => {
      const ref = doc(db, "content", "topics", "items", topic.id);
      batch.set(ref, { ...topic, masteryDefault: 0 });
    });

    batch.set(
      metaRef,
      {
        topicsSeeded: true,
        topicsSeededV2: true,
        topicsCount: topics.length,
        modulosCount: modulos.length,
        seededAt: serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    console.log(`[seed] ✅ ${topics.length} lições (${modulos.length} módulos) gravadas em content/topics/items`);
    return { seeded: true, count: topics.length };
  } catch (err) {
    console.error("[seed] ❌ Falha ao popular conteúdo:", err.message);
    return { seeded: false, error: err.message };
  }
}

/** Retorna o resumo dos módulos (usado pela tela de trilha/roadmap). */
export function getModulosResumo() {
  return modulos;
}
