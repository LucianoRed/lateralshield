---
id: LS-OCP-009
titulo: Executar contêineres sem root e sem hostNetwork, hostPath e hostPorts
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.11 ou superior
status: rascunho
---

# LS-OCP-009 — Executar contêineres sem root e sem hostNetwork, hostPath e hostPorts

## Problema

O isolamento de um contêiner depende do que o pod pede ao nó. Quatro pedidos desfazem esse isolamento:

- **root** no contêiner: qualquer falha de isolamento passa a valer root no nó;
- **`hostNetwork`**: o pod usa a rede do nó. Alcança serviços que só escutam na rede dos nós e em `localhost`, e fica fora do alcance das NetworkPolicies ([LS-OCP-002](LS-OCP-002-networkpolicy-negacao-padrao.md));
- **`hostPath`**: o pod monta diretórios do nó, onde estão credenciais do kubelet, sockets do runtime e dados de outros pods;
- **`hostPort`** (e `hostPID`, `hostIPC`): o pod ocupa portas e enxerga processos do nó.

Um invasor que compromete um pod com qualquer um desses pedidos não precisa de técnica de fuga: o caminho para o nó, e dele para os demais workloads, já foi aberto pela própria configuração.

## Benefício

O comprometimento de uma aplicação fica restrito ao contêiner e à rede de pods, onde os demais controles atuam. O invasor não tem root, não lê o sistema de arquivos do nó e não alcança serviços que escutam apenas na rede dos nós.

Com a admissão de segurança de pods em modo `enforce`, o cluster passa a recusar manifestos que peçam esses acessos nos namespaces de aplicação — a regra deixa de depender de revisão manual.

## Pré-requisitos

- Permissão de administração do cluster e dos namespaces alvo.
- Contato com os responsáveis pelos workloads que hoje pedem acesso ao host.
- `jq` na estação de administração.

## Avaliação

**1. Pods de aplicação que pedem acesso ao host ou root explícito:**

```bash
oc get pods -A -o json | jq -r '
  .items[]
  | select(.metadata.namespace | test("^(openshift.*|kube-.*|default)$") | not)
  | . as $p
  | [ (if .spec.hostNetwork then "hostNetwork" else empty end),
      (if .spec.hostPID then "hostPID" else empty end),
      (if .spec.hostIPC then "hostIPC" else empty end),
      (if any(.spec.volumes[]?; .hostPath != null) then "hostPath" else empty end),
      (if any(.spec.containers[].ports[]?; .hostPort != null) then "hostPort" else empty end),
      (if any(.spec.containers[]; .securityContext.privileged == true) then "privileged" else empty end),
      (if any(.spec.containers[];
              (.securityContext.runAsUser // $p.spec.securityContext.runAsUser) == 0)
       then "runAsUser=0" else empty end) ]
  | select(length > 0)
  | "\($p.metadata.namespace)/\($p.metadata.name)\t\(join(","))"'
```

**2. Perfil de segurança de pods aplicado a cada namespace:**

```bash
oc get namespaces -L pod-security.kubernetes.io/enforce \
  -L pod-security.kubernetes.io/audit -L pod-security.kubernetes.io/warn
```

Como interpretar:

- Cada pod listado no passo 1 tem um caminho direto para o nó. Sem justificativa registrada, é um achado.
- Um contêiner pode rodar como root **sem** declarar `runAsUser: 0`: basta ser admitido pela SCC `anyuid` e a imagem ter root como usuário padrão. Esses casos aparecem na avaliação de [LS-OCP-008](LS-OCP-008-scc-privilegiadas-so-com-justificativa.md).
- Namespace de aplicação com `enforce` em `privileged`, ou sem o rótulo: o cluster aceita ali qualquer pedido que as SCCs permitirem.

## Implementação

**1. Observar.** O OpenShift mantém os rótulos `audit` e `warn` de cada namespace sincronizados com as permissões de SCC das service accounts. Para ver o que falharia no perfil mais rígido, sem bloquear nada, fixe os dois rótulos em `restricted`:

```bash
oc label namespace <namespace> --overwrite \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

A partir daí, cada criação de pod fora do perfil devolve um aviso a quem executou o comando e grava uma anotação de violação no log de auditoria da API. Alterar um rótulo à mão desliga a sincronização automática daquele rótulo.

**2. Corrigir os workloads.** Para a maioria das aplicações, basta não pedir nada e declarar o contexto de segurança que o perfil `restricted` exige:

```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
```

Não fixe `runAsUser`: deixe a SCC atribuir um UID da faixa do namespace. Substitua `hostPath` por volumes persistentes, `hostPort` por um Service e `hostNetwork` pela rede de pods. Imagens que exigem root precisam ser ajustadas para aceitar um UID arbitrário.

**3. Bloquear.** Quando os avisos pararem:

```bash
oc label namespace <namespace> --overwrite pod-security.kubernetes.io/enforce=restricted
```

Para que os namespaces novos já nasçam assim, inclua o rótulo no modelo de projeto do cluster.

**4. Isolar as exceções.** Workloads que precisam legitimamente de acesso ao host ficam em namespaces próprios, com service account dedicada e a SCC mínima necessária ([LS-OCP-008](LS-OCP-008-scc-privilegiadas-so-com-justificativa.md)), e não misturados às aplicações.

## Validação

- A avaliação do passo 1 não lista mais pods nos namespaces tratados.
- Em um namespace com `enforce=restricted`, a tentativa de criar um pod com `hostNetwork: true` é recusada pela API com erro de violação do perfil. Faça o teste com `--dry-run=server`, que valida a admissão sem criar o pod:

```bash
oc apply -n <namespace> --dry-run=server -f pod-de-teste-com-hostnetwork.yaml
```

- A aplicação continua funcionando depois de um `oc rollout restart`.

## Reversão

```bash
oc label namespace <namespace> pod-security.kubernetes.io/enforce-
oc label namespace <namespace> --overwrite security.openshift.io/scc.podSecurityLabelSync=true
```

O primeiro comando remove o bloqueio. O segundo devolve os rótulos `audit` e `warn` ao controle da sincronização automática.

## Impacto operacional

- Com `enforce`, pods fora do perfil deixam de ser criados — inclusive em um reinício ou escalonamento de um workload que já rodava. Só bloqueie depois de um período sem avisos.
- Ajustar imagens para rodar sem root pode exigir mudança de porta (abaixo de 1024), de permissões de diretório e de scripts de inicialização.
- Agentes de infraestrutura (rede, armazenamento, coleta de logs, monitoramento de nó) precisam de acesso ao host. Mantenha-os nos namespaces da plataforma ou em namespaces de exceção; não aplique `enforce=restricted` neles.
- O perfil imposto por padrão e o comportamento da sincronização de rótulos mudaram entre versões do OpenShift. Confira o capítulo de admissão de segurança de pods da versão em uso.

## Detecção

- **Violação do perfil.** Com o rótulo `audit`, a API anota no evento de auditoria a violação de cada pod fora do perfil (anotação `pod-security.kubernetes.io/audit-violations`). O alerta `PodSecurityViolation` da plataforma indica que há violações, mas não diz qual workload; a identificação é feita no log de auditoria, que precisa estar no destino central ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)).
- **Tentativa recusada.** Com `enforce`, a criação negada aparece no log de auditoria com resposta `403`. Uma service account de aplicação tentando criar pod com `hostPath` ou `hostNetwork` é um sinal direto de tentativa de fuga.
- **Mudança de rótulo.** Alteração dos rótulos `pod-security.kubernetes.io/*` em um namespace desfaz o controle; inclua-a nas regras de [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Understanding and managing pod security admission; Managing security context constraints).
- Documentação do Kubernetes: *Pod Security Standards* e *Pod Security Admission*.
- Documentação do OpenShift Container Platform: *Images* (Creating images — Support arbitrary user IDs).
