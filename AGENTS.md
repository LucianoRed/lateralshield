# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Cursor, Copilot e similares) que trabalham neste repositório a pedido de um colaborador. As regras para pessoas estão em [CONTRIBUTING.md](CONTRIBUTING.md); este arquivo as complementa e não as substitui.

## O projeto em um parágrafo

O LateralShield é um framework aberto de segurança pragmática, **especializado em tecnologias Red Hat**: OpenShift, RHEL, JBoss EAP e Ansible Automation Platform. Reúne controles de alto impacto e baixa complexidade (princípio 80/20) organizados em três pilares — **prevenir, conter, detectar** — com foco em dificultar a movimentação lateral. É uma iniciativa comunitária independente, não um produto oficial nem suportado pela Red Hat.

Antes de escrever qualquer coisa, leia [README.md](README.md), [docs/metodologia.md](docs/metodologia.md) e [docs/modelo-de-ameaca.md](docs/modelo-de-ameaca.md).

## Mapa do repositório

| Caminho | Conteúdo | Observações |
|---|---|---|
| `docs/` | Metodologia, modelo de ameaça, roadmap | Atualize o roadmap quando um candidato virar controle |
| `catalogo/<tecnologia>/` | Um arquivo Markdown por controle | Segue `catalogo/_MODELO.md` |
| `catalogo/INDICE.md` | Índice do catálogo | **Gerado. Nunca edite à mão** |
| `automacao/playbooks/` | Playbooks `avaliar_*` (somente leitura) e `aplicar_*` | |
| `automacao/roles/` | Uma role por controle aplicável | |
| `scripts/catalogo.py` | Valida controles e gera o índice | Fonte da verdade das regras de metadados |
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
