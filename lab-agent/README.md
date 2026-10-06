# Lab Real — agente na Oracle Cloud

Roda equipamentos de verdade (FRRouting + Linux) para as topologias do módulo **Topologia** do CCNA Study OS. Nada é instalado no seu PC: tudo fica numa VM grátis da Oracle, e você usa pelo app de qualquer lugar.

```
App (GitHub Pages)  ──HTTPS + token do Firebase──▶  Caddy  ▶  agente (Node)  ▶  Containerlab  ▶  containers
```

## 1. Criar a VM (Oracle Cloud Always Free)

1. Home → **Criar uma instância de VM**.
2. **Nome:** `ccna-lab`.
3. **Imagem e shape → Editar:**
   - Imagem: **Canonical Ubuntu 24.04**
   - Shape: **Ampere → VM.Standard.A1.Flex**, **4 OCPUs e 24 GB** (limite grátis)
   - Se aparecer *Out of capacity*: tente outro *Availability Domain*, ou 2 OCPUs / 12 GB, ou tente de novo mais tarde.
4. **Rede:** criar nova VCN + **sub-rede pública**, com **Atribuir endereço IPv4 público** marcado.
5. **Chaves SSH:** *Gerar par de chaves* → **Salvar chave privada** (guarde o arquivo `.key`).
6. **Criar.** Anote o **IP público** quando ficar *Running*.

## 2. Liberar HTTPS na rede da Oracle

Instância → *Sub-rede* → *Security Lists* → *Default Security List* → **Adicionar regras de entrada**:

| Origem | Protocolo | Porta destino |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

(A porta 80 só é usada para emitir o certificado HTTPS.)

## 3. Instalar tudo (pelo navegador, sem instalar nada no PC)

1. No console da Oracle, abra o **Cloud Shell** (ícone `>_` no topo).
2. Menu do Cloud Shell → **Upload** → envie a chave `.key`.
3. Conecte e rode o setup. Troque `<IP>` pelo IP público e `<UID>` pelo UID que aparece no app em **Topologia → ▶ Lab real**:

```bash
chmod 600 ssh-key-*.key
ssh -i ssh-key-*.key ubuntu@<IP>

# já dentro da VM:
git clone https://github.com/G-Olivera/ccna-study-os
sudo bash ccna-study-os/lab-agent/setup.sh <UID>
```

No final o script mostra algo como `https://150-230-10-20.sslip.io`. Abra `…/saude` no navegador; tem que aparecer `{"ok":true,...}`.

## 4. Ligar o app ao agente

Em `js/lab-config.js`:

```js
export const LAB_AGENT_URL = "https://150-230-10-20.sslip.io";
```

Commit + push. O GitHub Pages publica, e o botão **▶ Lab real** passa a funcionar.

## Como usar

1. Desenhe (ou abra um template) na Topologia e **Salve**.
2. **▶ Lab real → Subir lab.** Na primeira vez leva cerca de 1 minuto.
3. Os nós ficam com anel verde e os links mudam de cor conforme up/down.
4. **Console (vtysh)** abre a CLI real do roteador. **Terminal** abre o shell do PC.
5. Configure, salve com `write memory` e teste com o **Ping** do painel.
6. **Derrubar** desliga o lab. As configs salvas voltam na próxima vez que você subir.

### Equivalência dos equipamentos

| No desenho | No lab real |
|---|---|
| Router, Switch L3, Firewall | FRRouting (OSPF, BGP, RIP, EIGRP, estática, VRRP) |
| Switch L2 | Bridge Linux (switch L2 simples; VLAN fica para a próxima fase) |
| PC, Laptop, Server, AP | Host Linux (IP/gateway vêm das propriedades do PC) |
| Cloud | não suportado (fica de fora, com aviso) |

As interfaces viram `eth1`, `eth2`… na ordem da lista de interfaces do equipamento no app. O painel mostra o mapa, por exemplo `G0/0 = eth1`.

## Segurança

- Só aceita **ID tokens do Firebase** do projeto `ccna-study-os`, do(s) UID(s) em `ALLOWED_UIDS` e, por padrão, **com MFA** (`REQUIRE_MFA=true`).
- O app nunca manda YAML nem comandos de deploy: só a topologia. As imagens e os comandos de setup são definidos no agente (`src/topologia-para-clab.js`).
- O agente escuta apenas em `127.0.0.1`. Só o Caddy (HTTPS) fica exposto.
- Limites: `MAX_LABS=3` labs simultâneos e `MAX_NODES=16` nós por lab.

Configuração em `/etc/lab-agent.env`. Depois de editar, rode `sudo systemctl restart lab-agent`.

## Manutenção

```bash
journalctl -u lab-agent -f                  # logs do agente
sudo containerlab inspect --all             # labs no ar
cd ccna-study-os && git pull && sudo bash lab-agent/setup.sh   # atualizar o agente
```
