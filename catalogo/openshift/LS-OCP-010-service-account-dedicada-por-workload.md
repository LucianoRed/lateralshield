---
id: LS-OCP-010
titulo: Usar uma service account dedicada por workload, com papéis mínimos
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-010 — Usar uma service account dedicada por workload, com papéis mínimos

## Problema

Todo pod roda com uma service account, e o token dessa conta é montado dentro do contêiner por padrão. Quando o manifesto não declara nenhuma, o pod usa a conta `default` do namespace — a mesma para todos os workloads que também não declararam.

O resultado é uma identidade compartilhada. Qualquer papel dado à `default` para atender uma aplicação (ler Secrets, criar pods, usar uma SCC privilegiada) passa a valer para todas as outras do namespace. O invasor que compromete o workload menos importante lê o token em um arquivo e herda as permissões concedidas ao mais privilegiado, sem precisar explorar mais nada.

## Benefício

O token obtido em um pod invadido passa a valer apenas o que aquele workload precisa — na maioria dos casos, nada, porque a maior parte das aplicações não fala com a API do cluster.

A operação ganha rastreabilidade: no log de auditoria, cada requisição à API aponta para um workload específico, e não para uma conta `default` usada por dez aplicações. Revogar o acesso de uma aplicação deixa de afetar as vizinhas.

## Pré-requisitos

- Permissão de administração nos namespaces alvo.
- Saber, para cada workload, se ele chama a API do cluster e para quê. Se ninguém souber, o log de auditoria ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)) responde.
- `jq` na estação de administração.

## Avaliação

**1. Pods de aplicação usando a conta `default`:**

```bash
oc get pods -A -o json | jq -r '
  .items[]
  | select(.metadata.namespace | test("^(openshift.*|kube-.*|default)$") | not)
  | select(.spec.serviceAccountName == "default")
  | "\(.metadata.namespace)\t\(.metadata.name)"'
```

**2. Papéis concedidos a contas `default` e a grupos de service accounts:**

```bash
oc get rolebindings,clusterrolebindings -A -o json | jq -r '
  .items[]
  | select(any(.subjects[]?;
        (.kind == "ServiceAccount" and .name == "default")
        or (.kind == "Group" and (.name | startswith("system:serviceaccounts")))))
  | "\(.kind)\t\(.metadata.namespace // "-")\t\(.metadata.name)\t\(.roleRef.name)"'
```

**3. O que uma conta específica consegue fazer:**

```bash
oc auth can-i --list --as=system:serviceaccount:<namespace>:<conta> -n <namespace>
```

Como interpretar:

- Pods com a conta `default` compartilham identidade. Isoladamente é uma fraqueza; somado a qualquer vínculo listado no passo 2, é **exposição**.
- Vínculos para `default` com papéis como `edit`, `admin` ou `cluster-admin`, ou com SCCs (`system:openshift:scc:*`), valem para todos os pods do namespace.
- Vínculos para os grupos `system:serviceaccounts` ou `system:serviceaccounts:<namespace>` valem para todas as contas, atuais e futuras. Os vínculos padrão `system:image-pullers`, `system:image-builders` e `system:deployers` de cada projeto são da plataforma.
- No passo 3, uma aplicação que não usa a API deveria listar apenas as permissões básicas de descoberta.

## Implementação

**1. Criar a conta e associá-la ao workload.**

```bash
oc create serviceaccount <aplicacao> -n <namespace>
oc set serviceaccount deployment/<aplicacao> <aplicacao> -n <namespace>
```

**2. Não montar o token onde ele não é usado.** Para aplicações que não chamam a API, desligue a montagem na conta ou no modelo de pod. Quando os dois declaram o campo, vale o do pod:

```bash
oc patch serviceaccount <aplicacao> -n <namespace> -p '{"automountServiceAccountToken": false}'
```

Vale fazer o mesmo na conta `default` de cada namespace de aplicação, para que um pod sem conta declarada não receba token.

**3. Dar o papel mínimo a quem precisa da API.** Um `Role` no namespace, com os recursos e verbos realmente usados:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: <aplicacao>-leitura-de-configmaps
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: <aplicacao>-leitura-de-configmaps
subjects:
  - kind: ServiceAccount
    name: <aplicacao>
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: <aplicacao>-leitura-de-configmaps
```

Prefira `Role` a `ClusterRole`, e vínculo local a vínculo de cluster. Para acesso a Secrets, veja [LS-OCP-011](LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md).

**4. Remover os papéis da conta `default`,** depois que todos os workloads do namespace tiverem conta própria:

```bash
oc adm policy remove-role-from-user <papel> -z default -n <namespace>
```

## Validação

```bash
oc get deployment <aplicacao> -n <namespace> -o jsonpath='{.spec.template.spec.serviceAccountName}{"\n"}'
oc auth can-i list secrets --as=system:serviceaccount:<namespace>:<aplicacao> -n <namespace>   # deve responder "no"
oc auth can-i get configmaps --as=system:serviceaccount:<namespace>:<aplicacao> -n <namespace> # "yes" só se concedido
```

Nos pods com a montagem desligada, o diretório `/var/run/secrets/kubernetes.io/serviceaccount` não deve existir. A aplicação deve continuar funcionando depois do reinício.

## Reversão

```bash
oc set serviceaccount deployment/<aplicacao> default -n <namespace>
oc patch serviceaccount <aplicacao> -n <namespace> -p '{"automountServiceAccountToken": true}'
```

Se um papel removido da conta `default` fazia falta, devolva-o à conta **dedicada** do workload que precisa dele, e não à `default`.

## Impacto operacional

- Trocar a service account recria os pods do workload.
- Aplicações que usam a API sem que ninguém saiba (descoberta de pares em cluster, eleição de líder, leitura de ConfigMaps) começam a receber `403` ou falham ao iniciar sem o token. Faça em homologação primeiro e acompanhe os logs.
- Bibliotecas e agentes injetados no pod (malha de serviços, observabilidade) podem depender do token montado. Verifique antes de desligar a montagem.
- Segredos de pull de imagem ligados à conta `default` precisam ser ligados à nova conta (`oc secrets link <conta> <secret> --for=pull`).
- SCCs concedidas à conta `default` deixam de valer para o workload migrado. É o efeito desejado; se o workload precisa da SCC, conceda-a à conta dedicada ([LS-OCP-008](LS-OCP-008-scc-privilegiadas-so-com-justificativa.md)).

## Detecção

Com uma identidade por workload, o log de auditoria da API ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)) passa a mostrar qual aplicação fez cada requisição. Alerte, no destino central, para:

- requisições à API feitas por contas de workloads que não deveriam usá-la;
- respostas `403` em sequência para uma mesma `system:serviceaccount:<namespace>:<conta>`: é o padrão de alguém testando o que um token roubado permite;
- novos vínculos de papel para contas `default` ou para os grupos `system:serviceaccounts*` ([LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md)).

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Understanding and creating service accounts; Using service accounts in applications; Using RBAC to define and apply permissions).
- Documentação do Kubernetes: *Configure Service Accounts for Pods* (campo `automountServiceAccountToken`).
- Documentação do OpenShift Container Platform: *CLI tools* (`oc set serviceaccount`, `oc auth can-i`).
