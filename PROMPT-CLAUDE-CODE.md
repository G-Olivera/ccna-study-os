# Handoff: Lab Real no CCNA Study OS

Cole este arquivo inteiro no Claude Code, aberto na raiz do repositório `ccna-study-os`, junto com o `lab-real.patch`.

---

## Contexto

Quero aprender CCNA na prática, com laboratório real. Não posso instalar Docker nem WSL no PC (é da empresa) e quero usar de qualquer lugar, inclusive pelo celular.

A solução escolhida tem duas partes:

- **Execução na nuvem:** uma VM grátis na **Oracle Cloud** (Always Free, Ampere ARM, região São Paulo; a conta já está criada). Nela roda um **agente Node.js** que usa **Containerlab** para subir equipamentos reais:
  - **FRRouting** no lugar dos roteadores;
  - **Linux** para switches (bridge) e PCs.
- **Controle pelo app:** o app (GitHub Pages + Firebase) controla o agente por HTTPS. A autenticação usa o **ID token do Firebase com MFA**, conferido no agente via JWKS do Google. Por isso não há senha nova.

O app **nunca envia YAML nem comandos**, apenas a topologia desenhada no módulo Topologia. Quem decide imagens, binds e comandos é o agente.

## Tarefa 1: aplicar o patch

O patch foi gerado sobre o commit `b4d25549b1c03e87815403f371426cd723a583f9` (último commit da `main` em 06/10/2026).

```powershell
git checkout main
git pull
git checkout -b lab-real
git am --3way lab-real.patch
```

Se o `git am` falhar porque a `main` andou, resolva os conflitos preservando as duas mudanças. Os pontos de contato com código existente são pequenos:

- `js/topology.js`: novas funções `aoRenderizarTopologia`, `avisarRender` e `obterTopologiaAtual`, mais duas chamadas a `avisarRender()` no fim de `renderDispositivos` e de `renderConexoes`.
- `js/app.js`: o `import("./topology.js")` da seção topologia agora encadeia `import("./lab-real.js")` e `initLabReal()`.
- `index.html`:
  - botão `#topo-btn-lab-real` na toolbar;
  - modais `#lab-real-modal` e `#lab-console-modal`;
  - CSP com `https://*.sslip.io wss://*.sslip.io` em `connect-src`.
- `service-worker.js`: `CACHE_NAME` passou para `v60` e entraram `js/lab-real.js` e `js/lab-config.js`.
- `css/styles.css`: bloco `/* ---------- LAB REAL ---------- */` no final.
- `eslint.config.js`: ignora `lab-agent/node_modules` e usa globals de Node em `lab-agent/**`.

Depois rode `npm run lint`. Não pode haver erros; os warnings antigos já existiam. Em seguida, commit e push da branch.

## O que o patch contém

### App (frontend, vanilla JS, sem build)

| Arquivo | Função |
|---|---|
| `js/lab-config.js` | `LAB_AGENT_URL`, o endereço do agente. Fica vazio até a VM estar pronta. |
| `js/lab-real.js` | Painel do Lab Real: subir/derrubar, status dos nós e interfaces, ping, console xterm.js via WebSocket, status pintado no canvas e cola IOS→FRR. Com `LAB_AGENT_URL` vazio, mostra as instruções e o UID do Firebase com botão de copiar. |
| `js/vendor/xterm/` | xterm.js 6.0.0 + addon-fit 0.11.0 (ESM, local por causa do CSP; licença MIT incluída). |

### Agente (`lab-agent/`, Node 20+, ESM)

| Arquivo | Função |
|---|---|
| `src/config.js` | Variáveis de ambiente (`ALLOWED_UIDS`, `REQUIRE_MFA`, `ALLOWED_ORIGINS`, `MAX_LABS`, `MAX_NODES`, imagens). |
| `src/auth.js` | Valida o ID token do Firebase com `jose` (iss/aud do projeto `ccna-study-os`), exige UID permitido e MFA (`firebase.sign_in_second_factor`). |
| `src/topologia-para-clab.js` | Converte a topologia do app em lab do Containerlab. Detalhes abaixo. |
| `src/labs.js` | deploy/destroy via `containerlab` (execFile, sem shell), status via dockerode (labels `containerlab` e `clab-node-name`), operstate das `ethN` e ping. |
| `src/console.js` | WebSocket `/console`: o token vai na 1ª mensagem; abre exec com TTY (`vtysh` ou shell); trata resize e confere a Origin. |
| `src/server.js` | Express com CORS restrito. Rotas: `GET /saude`, `POST /labs`, `GET/DELETE /labs/:lab`, `POST /labs/:lab/ping`. |
| `setup.sh` | Instala Docker, Containerlab, Node 22, Caddy (HTTPS automático em `<ip>.sslip.io`), abre 80/443 no iptables da imagem Oracle, cria o usuário `labagent`, o serviço systemd e baixa as imagens. |
| `README.md` | Passo a passo da VM na Oracle. |

Regras de conversão em `src/topologia-para-clab.js`:

- **Tipos de equipamento:**
  - router, switchL3 e firewall → FRR (`quay.io/frrouting/frr:10.2.1`), com a pasta `frr/<nó>` montada em `/etc/frr`;
  - switchL2 → bridge Linux;
  - pc, laptop, server e ap → host `ghcr.io/hellt/network-multitool`;
  - cloud → recusado, com aviso.
- **Interfaces:** cada interface vira `eth(N)`, onde N é a posição dela na lista de interfaces do app mais 1. Nomes desconhecidos (ex.: "NIC") pegam o menor `ethN` livre.
- **IPs:** a pré-configuração de IP nos roteadores é opcional. PCs usam `ip`/`mascara`/`gateway` das propriedades.
- **Configs salvas:** o `frr.conf` salvo com `write memory` é preservado entre deploys, a menos que a opção `resetar` esteja marcada.
- **Nome do lab:** `ccna-<topologiaId em minúsculas, só [a-z0-9], até 16 caracteres>`. A mesma regra existe em `js/lab-real.js` (`nomeDoLab`) e as duas têm que continuar iguais.

## O que já foi testado

- `node --check` em todos os arquivos do agente.
- `npm run lint`: 0 erros.
- Conversão topologia → clab, com casos de roteadores, switch, PC, cloud e interface "NIC".
- Servidor: `/saude` responde, CORS libera só `https://g-olivera.github.io`, e chamadas sem token ou com token inválido recebem 401.

O que **não** foi testado: um deploy real do Containerlab (o ambiente de testes não tinha Docker) e a UI no navegador com login real.

## Tarefa 2: depois do push (eu faço manualmente)

1. Criar a VM: Ubuntu 24.04, `VM.Standard.A1.Flex`, 4 OCPUs / 24 GB, sub-rede pública.
2. Na Security List, liberar TCP 80 e 443.
3. No Cloud Shell da Oracle: `ssh` na VM, `git clone` do repo e `sudo bash ccna-study-os/lab-agent/setup.sh <MEU_UID>`. O UID aparece no painel ▶ Lab real.
4. Colocar o endereço `https://…sslip.io` em `js/lab-config.js` e fazer push.

## Próximas fases (não fazer agora, só ter em mente)

1. VLAN/trunk real no switch, com bridge `vlan_filtering` mapeando VLAN de acesso e trunk pelas propriedades do switch.
2. Verificação automática por lab (checks de ping, `show ip ospf neighbor` em FULL etc.) ligada à Trilha e às conquistas.
3. Templates de lab CCNA prontos (estático, OSPF, inter-VLAN, NAT, ACL, DHCP) e o lab VXLAN/EVPN como bônus.

## Regras do projeto para manter

- Vanilla JS com ES modules, sem framework e sem build step.
- Design tokens CSS e interface calma, sem sobrecarga visual (o módulo Topologia já teve que ser simplificado uma vez).
- Segurança importa: nada de YAML/comandos livres vindos do app, e CSP restrito.
- Antes de features grandes, analise e proponha antes de codar.
