---
id: LS-OCP-007
titulo: Alertar sobre mudanças em RBAC, SCC e Secrets
tecnologia: openshift
pilar: detectar
impacto: alto
esforco: baixo
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-007 — Alertar sobre mudanças em RBAC, SCC e Secrets

## Problema

Dentro de um cluster, a movimentação lateral quase sempre passa por três tipos de objeto: o invasor lê **Secrets** para obter credenciais, altera **RBAC** para ampliar o próprio acesso ou criar persistência, e usa ou afrouxa uma **SCC** para sair do contêiner em direção ao nó.

Todas essas ações ficam registradas no log de auditoria da API. Mas o log tem milhões de linhas por dia, e sem um filtro ninguém as vê: o registro existe, a detecção não. Ter o log encaminhado ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)) é necessário, mas não suficiente.

## Benefício

As poucas ações que mudam quem pode o quê no cluster deixam de passar despercebidas. Um novo vínculo com `cluster-admin`, uma SCC alterada ou uma listagem de Secrets por uma conta que nunca fez isso chegam à equipe em minutos, e não na investigação feita semanas depois.

São poucas regras, sobre eventos raros em um cluster saudável. O volume de alertas é baixo e cada um deles tem dono e explicação — ou é um incidente.

## Pré-requisitos

- Log de auditoria da API chegando a um destino central fora do cluster ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)).
- Um destino capaz de filtrar campos do evento e notificar alguém.
- Lista das contas que alteram RBAC, SCC e Secrets legitimamente (administradores, ferramenta de entrega contínua, operadores).
- `jq` na estação de administração, para a avaliação.

## Avaliação

Verifique primeiro se existem regras de alerta no destino central para os eventos da tabela da seção *Implementação*. Se o log de auditoria nem chega ao destino, o resultado é **sem detecção**.

Para conhecer a linha de base antes de criar as regras, consulte o log local de um nó de control plane. O comando é somente leitura:

```bash
oc adm node-logs <no-de-control-plane> --path=kube-apiserver/audit.log | jq -c '
  select(.objectRef.apiGroup == "rbac.authorization.k8s.io"
         and (.verb | IN("create", "update", "patch", "delete")))
  | [.requestReceivedTimestamp, .user.username, .verb,
     .objectRef.resource, (.objectRef.namespace // "-"), .objectRef.name, .responseStatus.code]'
```

O resultado mostra quem altera RBAC hoje. Contas inesperadas na lista já são um achado. Repita trocando o filtro pelos demais eventos da tabela para medir o ruído de cada regra.

## Implementação

**1. Criar as regras no destino central.** Os campos abaixo são os do evento de auditoria do Kubernetes, independentes da ferramenta que os recebe.

| Alerta | `objectRef.apiGroup` | `objectRef.resource` | `verb` |
|---|---|---|---|
| Vínculo de papel de cluster criado ou alterado | `rbac.authorization.k8s.io` | `clusterrolebindings` | `create`, `update`, `patch` |
| Papel ou vínculo alterado | `rbac.authorization.k8s.io` | `clusterroles`, `roles`, `rolebindings` | `create`, `update`, `patch`, `delete` |
| SCC criada, alterada ou removida | `security.openshift.io` | `securitycontextconstraints` | `create`, `update`, `patch`, `delete` |
| SCC concedida a uma conta | `rbac.authorization.k8s.io` | `rolebindings`, `clusterrolebindings` com nome iniciado por `system:openshift:scc:` | `create`, `update`, `patch` |
| Secret lido por pessoa ou por conta fora do padrão | vazio (grupo principal) | `secrets` | `get`, `list`, `watch` |
| Listagem de Secrets em todo o cluster | vazio (grupo principal) | `secrets`, sem `objectRef.namespace` | `list` |
| Tentativa negada em qualquer item acima | os mesmos | os mesmos | qualquer, com `responseStatus.code` igual a `403` |

**2. Reduzir o ruído pelo autor, e não pelo recurso.** O campo `user.username` separa a plataforma do restante:

- controladores da plataforma (`system:kube-controller-manager`, `system:apiserver`, `system:node:*`, `system:serviceaccount:openshift-*:*`, `system:serviceaccount:kube-system:*`) leem Secrets e ajustam RBAC o tempo todo. Trate-os em uma regra separada, de severidade baixa, em vez de descartá-los;
- **nunca exclua** `system:admin`, `kube:admin` nem `system:serviceaccount:` de namespaces de aplicação. São exatamente as identidades que um invasor usa;
- contas conhecidas de entrega contínua geram alerta de severidade baixa quando agem nos namespaces que administram, e alta fora deles.

**3. Opcional: registrar o conteúdo das alterações feitas por pessoas.** No perfil `Default`, o evento diz quem alterou qual objeto, mas não o que mudou — não mostra, por exemplo, que o vínculo aponta para `cluster-admin`. É possível registrar o corpo das requisições de escrita apenas para usuários autenticados pelo OAuth:

```bash
oc patch apiserver cluster --type=merge -p '
spec:
  audit:
    profile: Default
    customRules:
      - group: system:authenticated:oauth
        profile: WriteRequestBodies
'
```

Secrets continuam registrados apenas em nível de metadados em qualquer perfil, segundo a documentação. A mudança de perfil reinicia os servidores de API de forma gradual.

## Validação

Em um namespace de teste, gere um evento controlado e confirme que o alerta chega:

```bash
oc create rolebinding ls-teste-alerta --clusterrole=view --user=ls-usuario-de-teste -n <namespace-de-teste>
oc delete rolebinding ls-teste-alerta -n <namespace-de-teste>
```

O alerta deve chegar ao responsável com o autor, o verbo, o namespace e o nome do objeto. Meça o tempo entre o comando e a notificação, e repita o teste depois de cada mudança nas regras.

## Reversão

Desative as regras no destino central. Se o passo 3 foi aplicado:

```bash
oc patch apiserver cluster --type=json -p '[{"op":"remove","path":"/spec/audit/customRules"}]'
```

## Impacto operacional

- Instalação e atualização de operadores, e atualização do cluster, criam e alteram papéis em massa. Espere picos nessas janelas; correlacione com a mudança planejada em vez de silenciar a regra.
- Ferramentas de entrega contínua alteram RBAC e Secrets legitimamente. Sem a classificação do passo 2, a regra vira ruído e passa a ser ignorada.
- O perfil `WriteRequestBodies` aumenta o volume do log e o consumo dos servidores de API. Por isso o exemplo o restringe a usuários do OAuth.
- Alerta sem dono não é detecção: defina quem recebe e o que faz ao receber.

## Detecção

Este controle é a detecção. Os sinais são os eventos da tabela, lidos no destino central. Três padrões merecem severidade máxima:

- vínculo novo com o papel `cluster-admin`, ou criado por uma service account de aplicação;
- concessão das SCCs `privileged` ou `anyuid` fora de uma mudança planejada ([LS-OCP-008](LS-OCP-008-scc-privilegiadas-so-com-justificativa.md));
- uma conta que nunca leu Secrets passando a listá-los, ou sequência de respostas `403` em `secrets` a partir de uma mesma identidade.

Abertura de terminal em pods (`pods` com `objectRef.subresource` igual a `exec`) por pessoas em namespaces de produção é uma extensão natural dessas regras.

Nos servidores RHEL, o equivalente para identidade e `sudo` é o [LS-RHEL-003](../rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

## Referências

- Documentação do OpenShift Container Platform: *Security and compliance* (Viewing audit logs; Filtering audit logs; Configuring the audit log policy with custom rules).
- Documentação do Kubernetes: *Auditing* (estrutura do evento de auditoria).
- Documentação do OpenShift Container Platform: *Authentication and authorization* (Using RBAC to define and apply permissions; Managing security context constraints).
