// seed-content.js
// Popula content/topics/items no primeiro login, direto pelo navegador.
// Estrutura: 37 módulos / 142 lições cobrindo o blueprint CCNA 200-301 com granularidade
// de lição individual (nomenclatura técnica padrão da indústria — protocolos e conceitos,
// sem reproduzir texto ou descrições de nenhuma plataforma de terceiros).
// Só grava se ainda não existir nada lá (verifica um doc marcador em content/meta).

import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

const topics = [
  {
    "id": "m01-01",
    "dominio": "Network Fundamentals",
    "modulo": "Primeiros Passos",
    "moduloOrder": 1,
    "nome": "Começando com Redes",
    "peso": 20
  },
  {
    "id": "m01-02",
    "dominio": "Network Fundamentals",
    "modulo": "Primeiros Passos",
    "moduloOrder": 1,
    "nome": "Introdução à CLI da Cisco",
    "peso": 20
  },
  {
    "id": "m02-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LAN",
    "moduloOrder": 2,
    "nome": "Introdução a LAN",
    "peso": 20
  },
  {
    "id": "m02-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LAN",
    "moduloOrder": 2,
    "nome": "Endereço MAC",
    "peso": 20
  },
  {
    "id": "m02-03",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de LAN",
    "moduloOrder": 2,
    "nome": "Quadro Ethernet",
    "peso": 20
  },
  {
    "id": "m03-01",
    "dominio": "Network Fundamentals",
    "modulo": "Internos do Switching",
    "moduloOrder": 3,
    "nome": "Como o Switch Aprende Endereços MAC",
    "peso": 20
  },
  {
    "id": "m03-02",
    "dominio": "Network Fundamentals",
    "modulo": "Internos do Switching",
    "moduloOrder": 3,
    "nome": "Address Resolution Protocol (ARP)",
    "peso": 20
  },
  {
    "id": "m04-01",
    "dominio": "Network Fundamentals",
    "modulo": "Modelos e Arquiteturas de Rede",
    "moduloOrder": 4,
    "nome": "O que é um Modelo de Rede?",
    "peso": 20
  },
  {
    "id": "m04-02",
    "dominio": "Network Fundamentals",
    "modulo": "Modelos e Arquiteturas de Rede",
    "moduloOrder": 4,
    "nome": "Modelo OSI",
    "peso": 20
  },
  {
    "id": "m04-03",
    "dominio": "Network Fundamentals",
    "modulo": "Modelos e Arquiteturas de Rede",
    "moduloOrder": 4,
    "nome": "Modelo TCP/IP",
    "peso": 20
  },
  {
    "id": "m05-01",
    "dominio": "Network Fundamentals",
    "modulo": "Cabeamento, Energia e Interfaces",
    "moduloOrder": 5,
    "nome": "Cabeamento de Cobre",
    "peso": 20
  },
  {
    "id": "m05-02",
    "dominio": "Network Fundamentals",
    "modulo": "Cabeamento, Energia e Interfaces",
    "moduloOrder": 5,
    "nome": "Cabeamento de Fibra Óptica",
    "peso": 20
  },
  {
    "id": "m05-03",
    "dominio": "Network Fundamentals",
    "modulo": "Cabeamento, Energia e Interfaces",
    "moduloOrder": 5,
    "nome": "Power over Ethernet (PoE)",
    "peso": 20
  },
  {
    "id": "m05-04",
    "dominio": "Network Fundamentals",
    "modulo": "Cabeamento, Energia e Interfaces",
    "moduloOrder": 5,
    "nome": "Velocidade e Duplex",
    "peso": 20
  },
  {
    "id": "m06-01",
    "dominio": "Network Fundamentals",
    "modulo": "Comunicação de Rede",
    "moduloOrder": 6,
    "nome": "Domínio de Colisão",
    "peso": 20
  },
  {
    "id": "m06-02",
    "dominio": "Network Fundamentals",
    "modulo": "Comunicação de Rede",
    "moduloOrder": 6,
    "nome": "Domínio de Broadcast",
    "peso": 20
  },
  {
    "id": "m07-01",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "O que é uma VLAN?",
    "peso": 20
  },
  {
    "id": "m07-02",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "Lab: Configuração de VLAN",
    "peso": 20
  },
  {
    "id": "m07-03",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "Trunking 802.1Q",
    "peso": 20
  },
  {
    "id": "m07-04",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "Lab: Configuração 802.1Q",
    "peso": 20
  },
  {
    "id": "m07-05",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "Dynamic Trunking Protocol (DTP)",
    "peso": 20
  },
  {
    "id": "m07-06",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "VLAN Nativa no Trunk",
    "peso": 20
  },
  {
    "id": "m07-07",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "Voice VLAN",
    "peso": 20
  },
  {
    "id": "m07-08",
    "dominio": "Network Access",
    "modulo": "VLAN",
    "moduloOrder": 7,
    "nome": "VLAN Trunking Protocol (VTP)",
    "peso": 20
  },
  {
    "id": "m08-01",
    "dominio": "Network Access",
    "modulo": "Roteamento Inter-VLAN",
    "moduloOrder": 8,
    "nome": "Inter-VLAN Routing",
    "peso": 20
  },
  {
    "id": "m08-02",
    "dominio": "Network Access",
    "modulo": "Roteamento Inter-VLAN",
    "moduloOrder": 8,
    "nome": "Router on a Stick",
    "peso": 20
  },
  {
    "id": "m08-03",
    "dominio": "Network Access",
    "modulo": "Roteamento Inter-VLAN",
    "moduloOrder": 8,
    "nome": "Lab: Router on a Stick",
    "peso": 20
  },
  {
    "id": "m08-04",
    "dominio": "Network Access",
    "modulo": "Roteamento Inter-VLAN",
    "moduloOrder": 8,
    "nome": "SVI Inter-VLAN Routing",
    "peso": 20
  },
  {
    "id": "m09-01",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "EtherChannel",
    "peso": 20
  },
  {
    "id": "m09-02",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "EtherChannel Estático",
    "peso": 20
  },
  {
    "id": "m09-03",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "EtherChannel com LACP",
    "peso": 20
  },
  {
    "id": "m09-04",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "EtherChannel com PAgP",
    "peso": 20
  },
  {
    "id": "m09-05",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "EtherChannel de Camada 3",
    "peso": 20
  },
  {
    "id": "m09-06",
    "dominio": "Network Access",
    "modulo": "EtherChannel",
    "moduloOrder": 9,
    "nome": "Lab: Configuração de EtherChannel",
    "peso": 20
  },
  {
    "id": "m10-01",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Spanning Tree Protocol",
    "peso": 20
  },
  {
    "id": "m10-02",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Como o STP Funciona",
    "peso": 20
  },
  {
    "id": "m10-03",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Lab: Configuração de STP",
    "peso": 20
  },
  {
    "id": "m10-04",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Papéis de Porta no STP",
    "peso": 20
  },
  {
    "id": "m10-05",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Timers e Estados de Porta STP",
    "peso": 20
  },
  {
    "id": "m10-06",
    "dominio": "Network Access",
    "modulo": "Fundamentos de STP",
    "moduloOrder": 10,
    "nome": "Rapid STP (RSTP)",
    "peso": 20
  },
  {
    "id": "m11-01",
    "dominio": "Network Access",
    "modulo": "Segurança no STP",
    "moduloOrder": 11,
    "nome": "PortFast",
    "peso": 20
  },
  {
    "id": "m11-02",
    "dominio": "Network Access",
    "modulo": "Segurança no STP",
    "moduloOrder": 11,
    "nome": "BPDU Guard",
    "peso": 20
  },
  {
    "id": "m11-03",
    "dominio": "Network Access",
    "modulo": "Segurança no STP",
    "moduloOrder": 11,
    "nome": "BPDU Filter",
    "peso": 20
  },
  {
    "id": "m11-04",
    "dominio": "Network Access",
    "modulo": "Segurança no STP",
    "moduloOrder": 11,
    "nome": "Root Guard",
    "peso": 20
  },
  {
    "id": "m11-05",
    "dominio": "Network Access",
    "modulo": "Segurança no STP",
    "moduloOrder": 11,
    "nome": "Loop Guard",
    "peso": 20
  },
  {
    "id": "m12-01",
    "dominio": "Network Fundamentals",
    "modulo": "Sub-redes IPv4",
    "moduloOrder": 12,
    "nome": "O que é Sub-redes?",
    "peso": 20
  },
  {
    "id": "m12-02",
    "dominio": "Network Fundamentals",
    "modulo": "Sub-redes IPv4",
    "moduloOrder": 12,
    "nome": "CIDR",
    "peso": 20
  },
  {
    "id": "m12-03",
    "dominio": "Network Fundamentals",
    "modulo": "Sub-redes IPv4",
    "moduloOrder": 12,
    "nome": "VLSM",
    "peso": 20
  },
  {
    "id": "m12-04",
    "dominio": "Network Fundamentals",
    "modulo": "Sub-redes IPv4",
    "moduloOrder": 12,
    "nome": "Endereçamento Privado IPv4 (RFC1918)",
    "peso": 20
  },
  {
    "id": "m13-01",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "Cabeçalho do Pacote IPv4",
    "peso": 25
  },
  {
    "id": "m13-02",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "Tabela de Roteamento",
    "peso": 25
  },
  {
    "id": "m13-03",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "O Ciclo de Vida de um Pacote",
    "peso": 25
  },
  {
    "id": "m13-04",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "Distância Administrativa",
    "peso": 25
  },
  {
    "id": "m13-05",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "Longest Prefix Match",
    "peso": 25
  },
  {
    "id": "m13-06",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de Roteamento",
    "moduloOrder": 13,
    "nome": "Equal Cost Multi-Path (ECMP)",
    "peso": 25
  },
  {
    "id": "m14-01",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento Estático",
    "moduloOrder": 14,
    "nome": "Rota Estática",
    "peso": 25
  },
  {
    "id": "m14-02",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento Estático",
    "moduloOrder": 14,
    "nome": "Rota Estática Padrão",
    "peso": 25
  },
  {
    "id": "m14-03",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento Estático",
    "moduloOrder": 14,
    "nome": "Rota Estática Flutuante",
    "peso": 25
  },
  {
    "id": "m14-04",
    "dominio": "IP Connectivity",
    "modulo": "Roteamento Estático",
    "moduloOrder": 14,
    "nome": "Sumarização de Rotas",
    "peso": 25
  },
  {
    "id": "m15-01",
    "dominio": "IP Connectivity",
    "modulo": "Redundância de Gateway (FHRP)",
    "moduloOrder": 15,
    "nome": "Introdução ao FHRP",
    "peso": 25
  },
  {
    "id": "m15-02",
    "dominio": "IP Connectivity",
    "modulo": "Redundância de Gateway (FHRP)",
    "moduloOrder": 15,
    "nome": "HSRP",
    "peso": 25
  },
  {
    "id": "m15-03",
    "dominio": "IP Connectivity",
    "modulo": "Redundância de Gateway (FHRP)",
    "moduloOrder": 15,
    "nome": "Lab: Configuração de HSRP",
    "peso": 25
  },
  {
    "id": "m15-04",
    "dominio": "IP Connectivity",
    "modulo": "Redundância de Gateway (FHRP)",
    "moduloOrder": 15,
    "nome": "VRRP",
    "peso": 25
  },
  {
    "id": "m15-05",
    "dominio": "IP Connectivity",
    "modulo": "Redundância de Gateway (FHRP)",
    "moduloOrder": 15,
    "nome": "GLBP",
    "peso": 25
  },
  {
    "id": "m16-01",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de OSPF",
    "moduloOrder": 16,
    "nome": "O que é OSPF?",
    "peso": 25
  },
  {
    "id": "m16-02",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de OSPF",
    "moduloOrder": 16,
    "nome": "Lab: Configuração Básica de OSPF",
    "peso": 25
  },
  {
    "id": "m16-03",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de OSPF",
    "moduloOrder": 16,
    "nome": "OSPF Router ID",
    "peso": 25
  },
  {
    "id": "m16-04",
    "dominio": "IP Connectivity",
    "modulo": "Fundamentos de OSPF",
    "moduloOrder": 16,
    "nome": "Estados de Vizinhança OSPF",
    "peso": 25
  },
  {
    "id": "m17-01",
    "dominio": "IP Connectivity",
    "modulo": "Operações do OSPF",
    "moduloOrder": 17,
    "nome": "OSPF DR e BDR",
    "peso": 25
  },
  {
    "id": "m17-02",
    "dominio": "IP Connectivity",
    "modulo": "Operações do OSPF",
    "moduloOrder": 17,
    "nome": "OSPF Interface Passiva",
    "peso": 25
  },
  {
    "id": "m17-03",
    "dominio": "IP Connectivity",
    "modulo": "Operações do OSPF",
    "moduloOrder": 17,
    "nome": "Rota Padrão no OSPF",
    "peso": 25
  },
  {
    "id": "m17-04",
    "dominio": "IP Connectivity",
    "modulo": "Operações do OSPF",
    "moduloOrder": 17,
    "nome": "Métrica de Custo OSPF",
    "peso": 25
  },
  {
    "id": "m18-01",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "Introdução ao IPv6",
    "peso": 20
  },
  {
    "id": "m18-02",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "Tipos de Endereço IPv6",
    "peso": 20
  },
  {
    "id": "m18-03",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "Rota Estática IPv6",
    "peso": 20
  },
  {
    "id": "m18-04",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "IPv6 Neighbor Discovery (NDP)",
    "peso": 20
  },
  {
    "id": "m18-05",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "EUI-64 em IPv6",
    "peso": 20
  },
  {
    "id": "m18-06",
    "dominio": "Network Fundamentals",
    "modulo": "Visão Geral de IPv6",
    "moduloOrder": 18,
    "nome": "IPv6 SLAAC",
    "peso": 20
  },
  {
    "id": "m19-01",
    "dominio": "IP Services",
    "modulo": "DNS",
    "moduloOrder": 19,
    "nome": "DNS",
    "peso": 10
  },
  {
    "id": "m19-02",
    "dominio": "IP Services",
    "modulo": "DNS",
    "moduloOrder": 19,
    "nome": "Lab: Configuração de DNS",
    "peso": 10
  },
  {
    "id": "m20-01",
    "dominio": "IP Services",
    "modulo": "DHCP",
    "moduloOrder": 20,
    "nome": "DHCP",
    "peso": 10
  },
  {
    "id": "m20-02",
    "dominio": "IP Services",
    "modulo": "DHCP",
    "moduloOrder": 20,
    "nome": "Lab: Configuração de DHCP",
    "peso": 10
  },
  {
    "id": "m20-03",
    "dominio": "IP Services",
    "modulo": "DHCP",
    "moduloOrder": 20,
    "nome": "DHCP Relay Agent",
    "peso": 10
  },
  {
    "id": "m21-01",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "Por que o NAT foi Criado?",
    "peso": 10
  },
  {
    "id": "m21-02",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "NAT Estático",
    "peso": 10
  },
  {
    "id": "m21-03",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "Lab: NAT Estático",
    "peso": 10
  },
  {
    "id": "m21-04",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "NAT Dinâmico",
    "peso": 10
  },
  {
    "id": "m21-05",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "Lab: NAT Dinâmico",
    "peso": 10
  },
  {
    "id": "m21-06",
    "dominio": "IP Services",
    "modulo": "NAT",
    "moduloOrder": 21,
    "nome": "NAT Overload (PAT)",
    "peso": 10
  },
  {
    "id": "m22-01",
    "dominio": "IP Services",
    "modulo": "VRF",
    "moduloOrder": 22,
    "nome": "Virtual Routing and Forwarding (VRF)",
    "peso": 10
  },
  {
    "id": "m23-01",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs",
    "moduloOrder": 23,
    "nome": "Como as ACLs Funcionam",
    "peso": 15
  },
  {
    "id": "m23-02",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs",
    "moduloOrder": 23,
    "nome": "ACL Padrão",
    "peso": 15
  },
  {
    "id": "m23-03",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs",
    "moduloOrder": 23,
    "nome": "ACL Estendida",
    "peso": 15
  },
  {
    "id": "m23-04",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs",
    "moduloOrder": 23,
    "nome": "ACL Nomeada",
    "peso": 15
  },
  {
    "id": "m23-05",
    "dominio": "Security Fundamentals",
    "modulo": "ACLs",
    "moduloOrder": 23,
    "nome": "Lab: Configuração de ACL",
    "peso": 15
  },
  {
    "id": "m24-01",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Acesso ao Dispositivo",
    "moduloOrder": 24,
    "nome": "Configuração de SSH",
    "peso": 15
  },
  {
    "id": "m24-02",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Acesso ao Dispositivo",
    "moduloOrder": 24,
    "nome": "AAA",
    "peso": 15
  },
  {
    "id": "m24-03",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Acesso ao Dispositivo",
    "moduloOrder": 24,
    "nome": "RADIUS",
    "peso": 15
  },
  {
    "id": "m24-04",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Acesso ao Dispositivo",
    "moduloOrder": 24,
    "nome": "TACACS+",
    "peso": 15
  },
  {
    "id": "m25-01",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "Port Security",
    "peso": 15
  },
  {
    "id": "m25-02",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "Modo de Violação do Port Security",
    "peso": 15
  },
  {
    "id": "m25-03",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "DHCP Snooping",
    "peso": 15
  },
  {
    "id": "m25-04",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "Lab: Configuração de DHCP Snooping",
    "peso": 15
  },
  {
    "id": "m25-05",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "Dynamic ARP Inspection (DAI)",
    "peso": 15
  },
  {
    "id": "m25-06",
    "dominio": "Security Fundamentals",
    "modulo": "Segurança de Camada 2",
    "moduloOrder": 25,
    "nome": "Lab: Configuração de DAI",
    "peso": 15
  },
  {
    "id": "m26-01",
    "dominio": "IP Services",
    "modulo": "Protocolos de Descoberta",
    "moduloOrder": 26,
    "nome": "LLDP",
    "peso": 10
  },
  {
    "id": "m26-02",
    "dominio": "IP Services",
    "modulo": "Protocolos de Descoberta",
    "moduloOrder": 26,
    "nome": "CDP",
    "peso": 10
  },
  {
    "id": "m27-01",
    "dominio": "IP Services",
    "modulo": "Monitoramento e Tempo",
    "moduloOrder": 27,
    "nome": "Syslog",
    "peso": 10
  },
  {
    "id": "m27-02",
    "dominio": "IP Services",
    "modulo": "Monitoramento e Tempo",
    "moduloOrder": 27,
    "nome": "NTP",
    "peso": 10
  },
  {
    "id": "m27-03",
    "dominio": "IP Services",
    "modulo": "Monitoramento e Tempo",
    "moduloOrder": 27,
    "nome": "Lab: Configuração de NTP",
    "peso": 10
  },
  {
    "id": "m28-01",
    "dominio": "IP Services",
    "modulo": "SNMP",
    "moduloOrder": 28,
    "nome": "Introdução ao SNMP",
    "peso": 10
  },
  {
    "id": "m28-02",
    "dominio": "IP Services",
    "modulo": "SNMP",
    "moduloOrder": 28,
    "nome": "SNMPv2",
    "peso": 10
  },
  {
    "id": "m28-03",
    "dominio": "IP Services",
    "modulo": "SNMP",
    "moduloOrder": 28,
    "nome": "SNMPv3",
    "peso": 10
  },
  {
    "id": "m29-01",
    "dominio": "IP Services",
    "modulo": "Gerenciamento de Dispositivos",
    "moduloOrder": 29,
    "nome": "Running Config e Startup Config",
    "peso": 10
  },
  {
    "id": "m29-02",
    "dominio": "IP Services",
    "modulo": "Gerenciamento de Dispositivos",
    "moduloOrder": 29,
    "nome": "FTP vs TFTP",
    "peso": 10
  },
  {
    "id": "m30-01",
    "dominio": "IP Services",
    "modulo": "Fundamentos de QoS",
    "moduloOrder": 30,
    "nome": "O que é Qualidade de Serviço?",
    "peso": 10
  },
  {
    "id": "m30-02",
    "dominio": "IP Services",
    "modulo": "Fundamentos de QoS",
    "moduloOrder": 30,
    "nome": "Tipos de Tráfego",
    "peso": 10
  },
  {
    "id": "m31-01",
    "dominio": "IP Services",
    "modulo": "Mecanismos de QoS",
    "moduloOrder": 31,
    "nome": "Classificação e Marcação",
    "peso": 10
  },
  {
    "id": "m31-02",
    "dominio": "IP Services",
    "modulo": "Mecanismos de QoS",
    "moduloOrder": 31,
    "nome": "Trust Boundaries",
    "peso": 10
  },
  {
    "id": "m31-03",
    "dominio": "IP Services",
    "modulo": "Mecanismos de QoS",
    "moduloOrder": 31,
    "nome": "Enfileiramento e Escalonamento",
    "peso": 10
  },
  {
    "id": "m31-04",
    "dominio": "IP Services",
    "modulo": "Mecanismos de QoS",
    "moduloOrder": 31,
    "nome": "Prevenção de Congestionamento",
    "peso": 10
  },
  {
    "id": "m31-05",
    "dominio": "IP Services",
    "modulo": "Mecanismos de QoS",
    "moduloOrder": 31,
    "nome": "Shaping e Policing",
    "peso": 10
  },
  {
    "id": "m32-01",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Wireless",
    "moduloOrder": 32,
    "nome": "Introdução a Redes Wireless",
    "peso": 20
  },
  {
    "id": "m32-02",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Wireless",
    "moduloOrder": 32,
    "nome": "Componentes de uma WLAN",
    "peso": 20
  },
  {
    "id": "m32-03",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Wireless",
    "moduloOrder": 32,
    "nome": "Wireless vs Redes Cabeadas",
    "peso": 20
  },
  {
    "id": "m32-04",
    "dominio": "Network Fundamentals",
    "modulo": "Fundamentos de Wireless",
    "moduloOrder": 32,
    "nome": "Service Set 802.11",
    "peso": 20
  },
  {
    "id": "m33-01",
    "dominio": "Network Fundamentals",
    "modulo": "RF e Quadros 802.11",
    "moduloOrder": 33,
    "nome": "Faixas de Frequência e Canais Não Sobrepostos",
    "peso": 20
  },
  {
    "id": "m33-02",
    "dominio": "Network Fundamentals",
    "modulo": "RF e Quadros 802.11",
    "moduloOrder": 33,
    "nome": "Quadros 802.11",
    "peso": 20
  },
  {
    "id": "m34-01",
    "dominio": "Network Access",
    "modulo": "Arquitetura Wireless Cisco",
    "moduloOrder": 34,
    "nome": "Arquitetura de Rede Wireless Cisco",
    "peso": 20
  },
  {
    "id": "m34-02",
    "dominio": "Network Access",
    "modulo": "Arquitetura Wireless Cisco",
    "moduloOrder": 34,
    "nome": "Modos de AP Lightweight Cisco",
    "peso": 20
  },
  {
    "id": "m34-03",
    "dominio": "Network Access",
    "modulo": "Arquitetura Wireless Cisco",
    "moduloOrder": 34,
    "nome": "Modelos de Implantação do WLC",
    "peso": 20
  },
  {
    "id": "m35-01",
    "dominio": "Network Access",
    "modulo": "Segurança Wireless",
    "moduloOrder": 35,
    "nome": "Fundamentos de Segurança Wireless",
    "peso": 20
  },
  {
    "id": "m35-02",
    "dominio": "Network Access",
    "modulo": "Segurança Wireless",
    "moduloOrder": 35,
    "nome": "Protocolos de Segurança Wireless",
    "peso": 20
  },
  {
    "id": "m36-01",
    "dominio": "Network Fundamentals",
    "modulo": "Design de Rede",
    "moduloOrder": 36,
    "nome": "O que é uma WAN?",
    "peso": 20
  },
  {
    "id": "m36-02",
    "dominio": "Network Fundamentals",
    "modulo": "Design de Rede",
    "moduloOrder": 36,
    "nome": "Arquitetura Three-Tier Cisco",
    "peso": 20
  },
  {
    "id": "m36-03",
    "dominio": "Network Fundamentals",
    "modulo": "Design de Rede",
    "moduloOrder": 36,
    "nome": "Arquitetura Collapsed Core",
    "peso": 20
  },
  {
    "id": "m36-04",
    "dominio": "Network Fundamentals",
    "modulo": "Design de Rede",
    "moduloOrder": 36,
    "nome": "Arquitetura Spine-Leaf",
    "peso": 20
  },
  {
    "id": "m37-01",
    "dominio": "Automation and Programmability",
    "modulo": "Automação e Programabilidade",
    "moduloOrder": 37,
    "nome": "Software Defined Networking (SDN)",
    "peso": 10
  },
  {
    "id": "m37-02",
    "dominio": "Automation and Programmability",
    "modulo": "Automação e Programabilidade",
    "moduloOrder": 37,
    "nome": "REST API",
    "peso": 10
  },
  {
    "id": "m37-03",
    "dominio": "Automation and Programmability",
    "modulo": "Automação e Programabilidade",
    "moduloOrder": 37,
    "nome": "Ansible",
    "peso": 10
  },
  {
    "id": "m37-04",
    "dominio": "Automation and Programmability",
    "modulo": "Automação e Programabilidade",
    "moduloOrder": 37,
    "nome": "Terraform",
    "peso": 10
  },
  {
    "id": "m37-05",
    "dominio": "Automation and Programmability",
    "modulo": "Automação e Programabilidade",
    "moduloOrder": 37,
    "nome": "JSON",
    "peso": 10
  }
];

const modulos = [
  {
    "ordem": 1,
    "nome": "Primeiros Passos",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 2,
    "nome": "Fundamentos de LAN",
    "dominio": "Network Fundamentals",
    "totalLicoes": 3
  },
  {
    "ordem": 3,
    "nome": "Internos do Switching",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 4,
    "nome": "Modelos e Arquiteturas de Rede",
    "dominio": "Network Fundamentals",
    "totalLicoes": 3
  },
  {
    "ordem": 5,
    "nome": "Cabeamento, Energia e Interfaces",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 6,
    "nome": "Comunicação de Rede",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 7,
    "nome": "VLAN",
    "dominio": "Network Access",
    "totalLicoes": 8
  },
  {
    "ordem": 8,
    "nome": "Roteamento Inter-VLAN",
    "dominio": "Network Access",
    "totalLicoes": 4
  },
  {
    "ordem": 9,
    "nome": "EtherChannel",
    "dominio": "Network Access",
    "totalLicoes": 6
  },
  {
    "ordem": 10,
    "nome": "Fundamentos de STP",
    "dominio": "Network Access",
    "totalLicoes": 6
  },
  {
    "ordem": 11,
    "nome": "Segurança no STP",
    "dominio": "Network Access",
    "totalLicoes": 5
  },
  {
    "ordem": 12,
    "nome": "Sub-redes IPv4",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 13,
    "nome": "Fundamentos de Roteamento",
    "dominio": "IP Connectivity",
    "totalLicoes": 6
  },
  {
    "ordem": 14,
    "nome": "Roteamento Estático",
    "dominio": "IP Connectivity",
    "totalLicoes": 4
  },
  {
    "ordem": 15,
    "nome": "Redundância de Gateway (FHRP)",
    "dominio": "IP Connectivity",
    "totalLicoes": 5
  },
  {
    "ordem": 16,
    "nome": "Fundamentos de OSPF",
    "dominio": "IP Connectivity",
    "totalLicoes": 4
  },
  {
    "ordem": 17,
    "nome": "Operações do OSPF",
    "dominio": "IP Connectivity",
    "totalLicoes": 4
  },
  {
    "ordem": 18,
    "nome": "Visão Geral de IPv6",
    "dominio": "Network Fundamentals",
    "totalLicoes": 6
  },
  {
    "ordem": 19,
    "nome": "DNS",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 20,
    "nome": "DHCP",
    "dominio": "IP Services",
    "totalLicoes": 3
  },
  {
    "ordem": 21,
    "nome": "NAT",
    "dominio": "IP Services",
    "totalLicoes": 6
  },
  {
    "ordem": 22,
    "nome": "VRF",
    "dominio": "IP Services",
    "totalLicoes": 1
  },
  {
    "ordem": 23,
    "nome": "ACLs",
    "dominio": "Security Fundamentals",
    "totalLicoes": 5
  },
  {
    "ordem": 24,
    "nome": "Segurança de Acesso ao Dispositivo",
    "dominio": "Security Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 25,
    "nome": "Segurança de Camada 2",
    "dominio": "Security Fundamentals",
    "totalLicoes": 6
  },
  {
    "ordem": 26,
    "nome": "Protocolos de Descoberta",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 27,
    "nome": "Monitoramento e Tempo",
    "dominio": "IP Services",
    "totalLicoes": 3
  },
  {
    "ordem": 28,
    "nome": "SNMP",
    "dominio": "IP Services",
    "totalLicoes": 3
  },
  {
    "ordem": 29,
    "nome": "Gerenciamento de Dispositivos",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 30,
    "nome": "Fundamentos de QoS",
    "dominio": "IP Services",
    "totalLicoes": 2
  },
  {
    "ordem": 31,
    "nome": "Mecanismos de QoS",
    "dominio": "IP Services",
    "totalLicoes": 5
  },
  {
    "ordem": 32,
    "nome": "Fundamentos de Wireless",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 33,
    "nome": "RF e Quadros 802.11",
    "dominio": "Network Fundamentals",
    "totalLicoes": 2
  },
  {
    "ordem": 34,
    "nome": "Arquitetura Wireless Cisco",
    "dominio": "Network Access",
    "totalLicoes": 3
  },
  {
    "ordem": 35,
    "nome": "Segurança Wireless",
    "dominio": "Network Access",
    "totalLicoes": 2
  },
  {
    "ordem": 36,
    "nome": "Design de Rede",
    "dominio": "Network Fundamentals",
    "totalLicoes": 4
  },
  {
    "ordem": 37,
    "nome": "Automação e Programabilidade",
    "dominio": "Automation and Programmability",
    "totalLicoes": 5
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

  if (metaSnap.exists() && metaSnap.data().topicsSeeded) {
    console.log("[seed] Conteúdo já populado, pulando.");
    return { seeded: false, reason: "already-seeded" };
  }

  try {
    const batch = writeBatch(db);

    topics.forEach((topic) => {
      const ref = doc(db, "content", "topics", "items", topic.id);
      batch.set(ref, { ...topic, masteryDefault: 0 });
    });

    batch.set(metaRef, {
      topicsSeeded: true,
      topicsCount: topics.length,
      modulosCount: modulos.length,
      seededAt: serverTimestamp(),
    });

    await batch.commit();
    console.log(`[seed] ✅ ${topics.length} lições (${modulos.length} módulos) gravadas em content/topics/items`);
    return { seeded: true, count: topics.length };
  } catch (err) {
    console.error("[seed] ❌ Falha ao popular conteúdo:", err.message);
    return { seeded: false, error: err.message };
  }
}

/** Retorna o resumo dos 37 módulos (usado pela tela de trilha/roadmap). */
export function getModulosResumo() {
  return modulos;
}
