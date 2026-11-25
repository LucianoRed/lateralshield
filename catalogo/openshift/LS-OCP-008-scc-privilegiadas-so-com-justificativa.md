---
id: LS-OCP-008
titulo: Reservar as SCCs privileged e anyuid a workloads justificados
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.11 ou superior
status: rascunho
---

# LS-OCP-008 — Reservar as SCCs privileged e anyuid a workloads justificados

## Problema

As Security Context Constraints (SCCs) decidem o que um pod pode pedir ao nó. Por padrão, um workload comum é admitido pela `restricted-v2`: sem root, sem capacidades, sem acesso ao host. O problema começa quando uma aplicação não sobe e alguém resolve com `oc adm policy add-scc-to-user anyuid` ou, pior, `privileged`.

Essas concessões raramente são revistas. Com `anyuid`, o contêiner roda como root. Com `privileged`, o contêiner tem acesso ao nó: dispositivos, sistema de arquivos e processos do host. Para o invasor que compromete um pod assim, a fuga do contêiner deixa de ser um problema difícil, e o nó — com os Secrets e tokens de todos os outros pods que rodam nele — vira o próximo passo.

## Benefício

A invasão de uma aplicação comum fica presa ao contêiner. Sem SCC privilegiada, o invasor não tem root, não monta diretórios do host e não enxerga os processos do nó: o caminho do pod para o nó deixa de existir para a grande maioria dos workloads.

A operação passa a ter uma lista curta de exceções, cada uma com dono e motivo. Qualquer nova concessão de SCC privilegiada vira um evento que merece alerta, em vez de um ajuste rotineiro.

## Pré-requisitos

- Permissão de administração do cluster.
- Contato com os responsáveis pelos workloads que hoje usam SCCs privilegiadas.
- `jq` na estação de administração.

## Avaliação

**1. Quais pods de aplicação rodam fora da SCC restrita.** A anotação `openshift.io/scc` de cada pod informa a SCC que o admitiu:

```bash
oc get pods -A -o json | jq -r '
  .items[]
  | select(.metadata.namespace | test("^(openshift.*|kube-.*|default)$") | not)
  | [.metadata.namespace, .metadata.name, .spec.serviceAccountName,
     (.metadata.annotations["openshift.io/scc"] // "-")] | @tsv' \
  | grep -Ev '[[:space:]]restricted(-v2)?$'
```

**2. Quem pode usar as SCCs privilegiadas.**

```bash
oc adm policy who-can use scc privileged
oc adm policy who-can use scc anyuid
oc get scc privileged anyuid hostaccess hostnetwork hostmount-anyuid \
  -o custom-columns='SCC:.metadata.name,USUARIOS:.users,GRUPOS:.groups'
oc get rolebindings,clusterrolebindings -A -o wide | grep 'system:openshift:scc:'
```

Como interpretar:

- Cada pod listado no passo 1 é uma exceção. Sem um motivo conhecido, é um achado.
- Service accounts chamadas `default` com SCC privilegiada dão o privilégio a **todos** os pods do namespace que não declaram outra conta. Veja [LS-OCP-010](LS-OCP-010-service-account-dedicada-por-workload.md).
- Grupos amplos (`system:authenticated`, `system:serviceaccounts`) com `use` em `anyuid` ou `privileged` anulam a proteção para o cluster inteiro.
- Confira a sintaxe de `who-can` com `oc adm policy who-can --help` na versão do cliente em uso.

## Implementação

**1. Classificar cada exceção** com o responsável: precisa mesmo, não precisa mais, ou precisa de menos.

**2. Corrigir o que não precisa.** A maior parte dos pedidos de `anyuid` vem de imagens que assumem um usuário fixo ou gravam em diretórios do root. A correção é na imagem: aceitar um UID arbitrário e dar permissão de escrita ao grupo `0` nos diretórios usados. Para saber qual SCC um manifesto exigiria, sem criar nada:

```bash
oc adm policy scc-subject-review -f deployment.yaml
```

**3. Remover a concessão.**

```bash
oc adm policy remove-scc-from-user anyuid -z <service-account> -n <namespace>
oc rollout restart deployment/<nome> -n <namespace>
```

**4. Para quem precisa de menos que `privileged`,** crie uma SCC própria com apenas o que o workload usa (uma capacidade, um tipo de volume) e conceda-a a uma service account dedicada. Não edite as SCCs padrão: a documentação avisa que alterações nelas podem quebrar componentes da plataforma e são desfeitas em atualizações.

**5. Fixar a SCC esperada.** Nas versões que suportam a anotação `openshift.io/required-scc`, declare-a no modelo de pod do workload. Assim ele não é admitido por uma SCC mais permissiva apenas porque ela ficou disponível:

```yaml
spec:
  template:
    metadata:
      annotations:
        openshift.io/required-scc: restricted-v2
```

**6. Registrar as exceções que ficam,** com dono, motivo e data de revisão — por exemplo, em uma anotação no próprio `RoleBinding`.

## Validação

```bash
oc get pod <pod> -n <namespace> -o jsonpath='{.metadata.annotations.openshift\.io/scc}{"\n"}'
```

Deve responder `restricted-v2` (ou a SCC sob medida criada no passo 4), e a aplicação deve continuar funcionando: verifique a rota, os logs e a escrita em volumes. A avaliação, repetida, deve listar apenas as exceções registradas.

## Reversão

```bash
oc adm policy add-scc-to-user anyuid -z <service-account> -n <namespace>
oc rollout restart deployment/<nome> -n <namespace>
```

Se a anotação `openshift.io/required-scc` foi usada, remova-a do modelo de pod; não a altere em um pod já em execução.

## Impacto operacional

- Pods que dependiam da SCC removida não sobem depois do reinício: ficam em erro de admissão ou falham ao gravar em disco. Faça primeiro em homologação e tenha a reversão à mão.
- Corrigir imagens de terceiros pode não ser possível. Nesses casos a exceção permanece, registrada e isolada em service account e namespace próprios.
- Agentes de infraestrutura (coleta de logs, monitoramento de nó, armazenamento, rede) precisam legitimamente de acesso ao host. O objetivo não é zerar o uso de `privileged`, e sim limitá-lo ao que tem justificativa.
- Um pod criado diretamente por um administrador do cluster pode ser admitido com uma SCC mais permissiva do que a do mesmo pod criado por um controlador, porque as permissões de quem cria também contam. Teste sempre pelo Deployment.

## Detecção

No log de auditoria da API ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)), alerte para:

- criação de vínculos com nome iniciado por `system:openshift:scc:`, que é como `oc adm policy add-scc-to-user` concede uma SCC;
- criação ou alteração de `securitycontextconstraints`.

Os filtros estão em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md). Repita a avaliação periodicamente e compare com a lista de exceções: um pod novo fora da `restricted-v2` sem registro é o sinal a investigar. O que o pod pede em seu manifesto é tratado em [LS-OCP-009](LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md).

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Managing security context constraints; Default security context constraints; Configuring a workload to require a specific SCC).
- Documentação do OpenShift Container Platform: *Images* (Creating images — Support arbitrary user IDs).
- Documentação do OpenShift Container Platform: *CLI tools* (`oc adm policy scc-subject-review`, `oc adm policy scc-review`, `oc adm policy who-can`).
