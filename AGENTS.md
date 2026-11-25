# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Cursor, Copilot e similares) que trabalham neste repositório a pedido de um colaborador. As regras para pessoas estão em [CONTRIBUTING.md](CONTRIBUTING.md); este arquivo as complementa e não as substitui.

## O projeto em um parágrafo

O LateralShield é um framework aberto de segurança pragmática, **especializado em tecnologias Red Hat**: OpenShift, RHEL, JBoss EAP e Ansible Automation Platform. Reúne controles de alto impacto e baixa complexidade (princípio 80/20) organizados em três pilares — **prevenir, conter, detectar** — com foco em dificultar a movimentação lateral. É uma iniciativa comunitária independente, não um produto oficial nem suportado pela Red Hat.

Antes de escrever qualquer coisa, leia [README.md](README.md), [docs/metodologia.md](docs/metodologia.md) e [docs/modelo-de-ameaca.md](docs/modelo-de-ameaca.md).

## Mapa do repositório

| Caminho | Conteúdo | Observações |
|---|---|---|
| `docs/` | Metodologia, modelo de ameaça, roadmap | Atualize o roadmap quando um candidato virar controle |
| `docs/avaliacao-de-processos.md` | Avaliação básica de pessoas e processos, em 20 perguntas | Não são controles nem medem maturidade |
| `docs/recomendacoes-para-incidentes.md` | Medidas de emergência para incidentes em andamento | Não são controles: sem identificador, status ou validador |
| `docs/guia-de-crise.md` | Checklist da sala de crise, por seção | Diz o que conferir e em que ordem; o "como" fica nas recomendações |
| `catalogo/<tecnologia>/` | Um arquivo Markdown por controle | Segue `catalogo/_MODELO.md` |
| `catalogo/INDICE.md` | Índice do catálogo | **Gerado. Nunca edite à mão** |
| `automacao/playbooks/` | Playbooks `avaliar_*` (somente leitura) e `aplicar_*` | |
| `automacao/roles/` | Uma role por controle aplicável | |
| `scripts/catalogo.py` | Valida controles e gera o índice | Fonte da verdade das regras de metadados |
| `mission-control/` | Painel de avaliação: página, API em PHP e manifesto do OpenShift | Segue `mission-control/README.md` |
| `mission-control/web/data.js`, `mission-control/openshift/mission-control.yaml` | Dados da página e manifesto pronto para `oc apply` | **Gerados por `scripts/mission_control.py`. Nunca edite à mão** |
| `apresentacao/` | Deck HTML de apresentação do projeto | Atualize os números quando o catálogo ou o roadmap mudarem |

## Regras que não se negociam

1. **Foco Red Hat.** Só entram problemas de segurança em tecnologias Red Hat. Ferramentas de terceiros apenas quando necessárias para proteger esses ambientes.
2. **Português brasileiro** em toda a documentação, comentários e mensagens exibidas ao usuário. Comandos, parâmetros e nomes de produto ficam no original.
3. **Sem conteúdo comercial.** Nada de vendas, posicionamento de produto ou comparação comercial.
4. **Sem material ofensivo.** Não escreva exploits, cargas ou passo a passo de ataque. Descreva o risco apenas no nível necessário para justificar e testar a defesa.
5. **Todo controle declara o benefício e tem avaliação, validação e reversão.** Sem essas seções o validador recusa o arquivo.
6. **Não invente fatos técnicos.** Portas, nomes de recursos, versões e sintaxe devem vir da documentação oficial ou de teste real. Se não foi possível confirmar, diga isso explicitamente ao colaborador e no pull request, em vez de escrever com aparência de certeza.
7. **Não promova status.** Controles novos entram como `rascunho`. Só mude para `validado` ou `em-producao` quando o colaborador informar onde e em quais versões testou, e registre isso no controle.
8. **Nenhum dado real.** Use as faixas de documentação (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) e domínios `exemplo.com.br`. Nunca versione inventários, IPs, nomes de host, senhas, chaves ou tokens de ambientes reais.
9. **Não execute nada contra sistemas reais** (playbooks, `oc`, `ssh`, varreduras) sem pedido explícito do colaborador para aquele alvo.

## Como escrever um controle

1. Copie `catalogo/_MODELO.md` para `catalogo/<tecnologia>/<ID>-<descricao-curta>.md`.
2. Use o próximo identificador livre da tecnologia:

   | Tecnologia (`tecnologia:`) | Pasta | Prefixo |
   |---|---|---|
   | `openshift` | `catalogo/openshift/` | `LS-OCP-NNN` |
   | `rhel` | `catalogo/rhel/` | `LS-RHEL-NNN` |
   | `jboss-eap` | `catalogo/jboss-eap/` | `LS-JBOSS-NNN` |
   | `aap` | `catalogo/aap/` | `LS-AAP-NNN` |

3. Preencha o cabeçalho. Valores aceitos: `pilar` (`prevenir`, `conter`, `detectar`), `impacto` (`alto`, `medio`, `baixo`), `esforco` (`baixo`, `medio`, `alto`), `status` (`rascunho`, `validado`, `em-producao`). Sem acentos nos valores.
4. A combinação de impacto e esforço precisa passar no filtro 80/20 da metodologia. Impacto baixo com esforço médio, por exemplo, é recusado.
5. Mantenha as dez seções do modelo, com os mesmos títulos e na mesma ordem.
6. Ao escrever, siga o padrão dos controles existentes:
   - **Problema** explica a exposição em termos de movimentação lateral.
   - **Benefício** diz o que o invasor deixa de conseguir e o que a operação ganha, em termos de resultado e sem exagero. Inclua um diagrama Mermaid de antes e depois quando o controle muda quem pode falar com quem.
   - **Avaliação** usa apenas comandos de leitura e diz como interpretar o resultado.
   - **Implementação** prefere recurso nativo e, quando possível, modo de observação antes do bloqueio.
   - **Impacto operacional** diz honestamente o que pode quebrar.
   - **Detecção** indica o sinal gerado e onde procurá-lo.
7. Regenere o índice e, se o controle estava no roadmap como candidato, atualize `docs/roadmap.md` e a tabela de `docs/modelo-de-ameaca.md`.

Bons controles de referência: [LS-JBOSS-002](catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) pela estrutura e [LS-RHEL-001](catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) pela seção de benefício com diagrama.

## Logs centralizados vêm primeiro

A existência de syslog central é a primeira verificação em qualquer ambiente (ver [docs/metodologia.md](docs/metodologia.md)). Ao escrever um controle de contenção ou detecção, diga na seção **Detecção** qual mensagem ele gera e assuma que ela precisa chegar ao destino central; referencie LS-RHEL-002, LS-OCP-003 ou LS-JBOSS-004 conforme a camada.

## Avaliação básica de processos

[docs/avaliacao-de-processos.md](docs/avaliacao-de-processos.md) reúne perguntas sobre pessoas e processos: resposta a incidentes, segurança e políticas, operação, monitoramento e detecção, e desenvolvimento. Junto com as recomendações para incidentes, é uma das duas áreas em que entra conteúdo que não é específico de tecnologias Red Hat. Ao acrescentar ou alterar uma pergunta:

- mantenha as três colunas: **Pergunta**, **O que conta como "sim"** (uma evidência verificável, não uma opinião) e **Por que importa** (em termos de movimentação lateral, contenção ou detecção);
- mantenha a avaliação básica: antes de acrescentar uma pergunta, veja se ela substitui uma existente. Não crie nota, pontuação nem nível de maturidade;
- cite o controle do catálogo relacionado quando existir, e acrescente à tabela de lacunas um primeiro passo de baixo esforço;
- se a numeração ou o total de perguntas mudar, atualize as referências a números de pergunta na própria página e o total citado em `README.md` e `docs/metodologia.md`;
- não cite produtos comerciais nem ferramentas de terceiros como resposta esperada.

## Recomendações gerais para incidentes

[docs/recomendacoes-para-incidentes.md](docs/recomendacoes-para-incidentes.md) reúne medidas de emergência para incidentes em andamento. Junto com a avaliação básica de processos, é uma das duas áreas em que entram recomendações que não são específicas de tecnologias Red Hat (perímetro de rede, processo de resposta), desde que protejam esses ambientes durante a crise. Ao acrescentar uma recomendação:

- mantenha os quatro blocos: **Quando usar**, **O que fazer**, **Cuidados** e **Como desfazer**;
- diga na tabela de resumo se a medida contém o invasor ou apenas reduz ruído;
- não escreva sintaxe de fabricantes de firewall, WAF ou CDN; cite o controle do catálogo relacionado quando existir;
- atualize o número de recomendações no slide "Incidentes" de `apresentacao/index.html`;
- se a medida for específica de uma tecnologia Red Hat e fizer sentido de forma permanente, ela é um controle e vai para o catálogo.

## Guia de crise

[docs/guia-de-crise.md](docs/guia-de-crise.md) é o checklist da sala de crise, e faz parte da mesma área das recomendações para incidentes. Ele diz **o que conferir e em que ordem**; como aplicar cada medida fica nas recomendações. Ao acrescentar ou alterar um item:

- mantenha as quatro colunas: **#**, **Verificação** (uma pergunta que se responde com um registro), **O que registrar** e **Por que importa**;
- mantenha a numeração contínua entre as seções e atualize a coluna "Itens" da tabela de resumo. O gerador recusa numeração fora de ordem;
- mantenha o guia curto: antes de acrescentar um item, veja se ele substitui um existente;
- não escreva comandos nem sintaxe de fabricante no guia: cite a recomendação ou o controle do catálogo que traz o procedimento;
- uma seção nova entra também na tabela de resumo, com a pergunta central.

## Mission Control

[mission-control/](mission-control/README.md) é o painel que transforma o catálogo e a avaliação de processos em checklist, com relatório em PDF e Excel. Ao mexer nele:

- os dados exibidos vêm do catálogo e dos documentos. Não escreva controle, pergunta, item do guia de crise ou recomendação diretamente na página: altere a fonte e rode `python3 scripts/mission_control.py`;
- rode o mesmo script depois de alterar qualquer arquivo de `mission-control/web/` ou `mission-control/openshift/base.yaml`, para regenerar o manifesto;
- mantenha a aplicação sem dependências externas e sem etapa de build: ela roda na imagem UBI de PHP, com o código em ConfigMaps;
- o nível de proteção da visão geral mede só a cobertura dos **controles** do catálogo, ponderada pela prioridade 80/20, e é apresentado como cobertura, nunca como certificação ou garantia. As perguntas de processo não entram na conta e continuam sem nota, pontuação ou nível de maturidade, na página e no relatório;
- os caminhos da topologia de ataque vêm da tabela "Como o catálogo responde" de `docs/modelo-de-ameaca.md`. Ao acrescentar uma linha a essa tabela, inclua-a também em `TOPO`, no `mission-control/web/index.html`, ou ela aparece só na tabela de caminhos;
- a situação registrada no painel é a do ambiente avaliado e não altera o `status` do controle no catálogo;
- a seção "Sala de crise" mostra o guia de crise e o texto completo das recomendações dentro da página, sem depender de links para o repositório. Mantenha assim: durante um incidente a equipe pode estar sem acesso à internet;
- nunca versione respostas, relatórios, registros de crise ou exportações de um ambiente real.

## Como escrever automação

- Playbooks `avaliar_*` **nunca alteram** o alvo: toda tarefa `command`/`shell` leva `changed_when: false`.
- Roles de aplicação devem ser idempotentes, ter um modo de observação quando o controle permitir e uma reversão acionável por variável (veja `ls_jboss_egress_modo` e `ls_jboss_egress_estado` em `automacao/roles/jboss_egress`).
- Variáveis com prefixo `ls_<role>_`, nomes em português, documentadas em `defaults/main.yml`.
- Use nomes de módulo completos (`ansible.builtin.*`) e valide arquivos gerados antes de instalar (`validate:`), quando existir verificador.
- Recuse configurações perigosas com `assert` (por exemplo, bloquear sem lista de destinos).
- Atualize `automacao/README.md` ao adicionar playbook ou role.

## Verificações obrigatórias antes de concluir

Execute a partir da raiz e só considere o trabalho pronto quando tudo passar:

```bash
python3 scripts/catalogo.py            # valida os controles e regenera catalogo/INDICE.md
python3 scripts/catalogo.py --check    # confirma que o índice está atualizado
python3 scripts/mission_control.py     # regenera os dados e o manifesto do Mission Control
python3 scripts/mission_control.py --check
yamllint .
( cd automacao && ansible-playbook --syntax-check playbooks/*.yml && ansible-lint )
```

São as mesmas verificações do CI (`.github/workflows/validacao.yml`). Elas conferem forma, não correção técnica: passar no lint não significa que o controle funciona. Ao relatar o resultado, separe o que foi verificado por ferramenta do que ainda depende de teste em laboratório.

## Git e pull requests

- Não faça commit, push nem abra pull request sem pedido do colaborador.
- Trabalhe em uma branch, nunca diretamente na `main`.
- Mensagens de commit em português, no imperativo ou descritivas, citando o identificador do controle quando houver (`LS-RHEL-002: filtro de saída no host`).
- Um pull request por controle ou por assunto. Inclua `catalogo/INDICE.md` regenerado no mesmo commit do controle.
- Na descrição do pull request, informe: o que foi testado, em quais versões e topologia, e o que **não** foi testado.

## Quando parar e perguntar

- A mudança altera missão, princípios, escopo tecnológico ou licença.
- O pedido envolve tecnologia fora do escopo atual: proponha abrir uma issue antes.
- O controle exigiria produto comercial de terceiros sem alternativa nativa.
- Você não conseguiu confirmar um fato técnico central do controle.
