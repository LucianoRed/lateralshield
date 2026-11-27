---
id: LS-AAP-014
titulo: Eliminar segredos de playbooks e extra_vars
tecnologia: aap
pilar: conter
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior
status: rascunho
---

# LS-AAP-014 — Eliminar segredos de playbooks e extra_vars

## Problema

Senhas, tokens e chaves acabam no lugar errado: no YAML do playbook, em `group_vars`, no campo Extra Variables do job template, em respostas de survey do tipo texto e em `extra_vars` passados na API de lançamento.

Quem pode ler o projeto, o job template ou o histórico do job vê o segredo. O activity stream, os artefatos e os logs de tarefa também repetem o valor quando a tarefa imprime variáveis ou quando alguém liga verbosidade alta. A proteção das credenciais da plataforma ([LS-AAP-009](LS-AAP-009-credenciais-por-finalidade-e-ambiente.md), [LS-AAP-011](LS-AAP-011-credenciais-com-propriedade-central.md)) não ajuda se a mesma senha está em claro ao lado.

Para o invasor que já tem um usuário comum no AAP ou acesso ao repositório do projeto, é o atalho mais barato para o próximo sistema.

## Benefício

O alcance de quem só lê projetos e jobs deixa de incluir senhas. Para usar o segredo, é preciso o papel de **Use** sobre uma credencial — conjunto pequeno, auditável e revogável.

A rotação depois de um incidente volta a ser trocar a credencial no AAP, sem caçar cópias em Git, surveys e lançamentos antigos. Job histórico deixa de ser um arquivo de senhas.

## Pré-requisitos

- Permissão para listar job templates, credenciais e projetos, e para ler os repositórios SCM usados pelos projetos.
- Acordo com os donos da automação: todo segredo encontrado em claro será **trocado**, não apenas movido.
- Tipos de credencial adequados (máquina, nuvem, vault, customizados) para o que os playbooks consomem.

## Avaliação

Os passos mostram **onde** há suspeita, sem despejar o valor em tickets ou chats.

**1. Extra Variables nos job templates** (automation controller / execution). Pela API, ajuste o host (gateway na 2.5 ou superior):

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/job_templates/?page_size=200" \
  | jq -r '
    .results[]
    | select(.extra_vars != null and .extra_vars != "" and .extra_vars != "{}")
    | select(.extra_vars | test("passw|secret|token|api_?key|private_key|login"; "i"))
    | [.id, .name] | @tsv'
```

**2. Surveys.** Liste surveys cujo tipo de resposta não é `password` mas cujo nome ou variável sugere segredo, e surveys que ainda guardam valor padrão.

**3. Repositórios dos projetos.** Nos clones usados pelo controller (ou no SCM), procure padrões em playbooks e vars — sem publicar o trecho completo:

```bash
grep -RIn -E 'password:|passwd:|ansible_password:|api_token:|secret:' \
  --include='*.yml' --include='*.yaml' . | head
```

**4. Saída de jobs.** Em jobs recentes, procure tarefas sem `no_log` que exibem `ansible_password`, tokens ou conteúdo de cofres; e job templates de produção com verbosidade de debug.

Interpretação: cada acerto é candidato. Segredo confirmado em claro no Git, em `extra_vars` ou em log de job deve ser tratado como **exposto**.

## Implementação

**1. Trocar o segredo** no sistema de destino (conta de máquina, API, banco). Mover o valor antigo para uma credencial do AAP não basta: ele continua no histórico do Git e nos jobs já gravados.

**2. Criar ou reutilizar uma credencial no AAP** com o valor novo. Prefira tipos nativos; use credencial customizada quando o playbook espera variáveis de ambiente ou campos específicos. Conceda apenas **Use** aos times que precisam ([LS-AAP-011](LS-AAP-011-credenciais-com-propriedade-central.md)).

**3. Associar a credencial ao job template** (ou ao workflow) e remover o segredo de Extra Variables, de `group_vars` e do playbook. No playbook, consuma o que a credencial injeta (por exemplo variáveis de ambiente ou campos do tipo máquina), como na documentação de *Use automation controller credentials in a playbook*.

**4. Marcar tarefas sensíveis com `no_log: true`.** A documentação de hardening é direta: sem isso, senhas e usuários aparecem no log salvo. `no_log` não esconde saída de debug — mantenha verbosidade baixa em produção.

**5. Surveys.** Campos secretos usam o tipo password da survey; não reutilize survey de texto livre para senha e não deixe valor padrão preenchido.

**6. Limpar o histórico acessível.** Rotacione branches/tags que ainda trazem o segredo no SCM conforme a política do time; aceite que jobs antigos podem continuar trazendo o valor até expirar a retenção — por isso a troca no passo 1 é obrigatória.

## Validação

- A consulta da avaliação não lista os job templates corrigidos.
- O job roda com a credencial associada e sem o segredo em Extra Variables.
- A saída da tarefa sensível aparece como omessa (`no_log`) no output do job.
- Um usuário sem papel sobre a credencial não consegue ler o segredo pelo projeto nem pelo template.

## Reversão

Reassociar variáveis em Extra Variables devolve o problema; só faça em emergência e com segredo **já rotacionado**. A reversão segura é manter a credencial e corrigir o playbook.

## Impacto operacional

- Playbooks que interpolavam senha em `uri`, `command` ou `debug` precisam ser reescritos para credenciais ou lookups seguros.
- Debug em produção continua proibido: `no_log` não cobre `-vvv` nem o modo debug da plataforma.
- Tipos customizados de credencial exigem padronizar nomes de campos entre times, senão cada template inventa um formato.

## Detecção

- No activity stream ([LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md)): alteração de Extra Variables em job templates críticos e criação de credenciais.
- Em revisão de código e de templates: reintrodução de padrões `password:`, `token:` em YAML versionado.
- Jobs com verbosidade alta em inventários de produção.

Encaminhe activity stream e, quando possível, alertas do agregador de log de jobs ao destino central. Segredos que só existem no SCM também dependem da pergunta 19 da [avaliação de processos](../../docs/avaliacao-de-processos.md).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Hardening and compliance* (Protecting sensitive data with `no_log`; Automation use secrets).
- Documentação do Ansible Automation Platform 2.5: *Using automation execution* (Job templates — Extra variables; Managing user credentials — Use automation controller credentials in a playbook).
- Documentação do Ansible: módulo e atributo de tarefa `no_log`.
