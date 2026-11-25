---
id: LS-OCP-006
titulo: Enviar o log de auditoria da API para fora do cluster
tecnologia: openshift
pilar: detectar
impacto: alto
esforco: baixo
versoes: OpenShift 4.x com o operador Red Hat OpenShift Logging 5.x ou 6.x
status: rascunho
---

# LS-OCP-006 — Enviar o log de auditoria da API para fora do cluster

## Problema

Tudo o que acontece no OpenShift passa pela API: quem leu um Secret, quem criou um vínculo de `cluster-admin`, quem abriu um terminal em um pod. O log de auditoria registra cada uma dessas requisições, mas por padrão ele fica apenas nos nós de control plane, em arquivos locais com rotação, e não é enviado a lugar nenhum.

Isso deixa duas lacunas. Ninguém olha esse log no dia a dia, então a movimentação do invasor dentro do cluster não gera alerta. E quem chega a administrador do cluster ou a um nó de control plane tem os registros ao alcance, junto com tudo o mais. Na investigação, a pergunta "o que essa conta fez?" fica sem resposta.

## Benefício

Cada requisição à API passa a ter uma cópia fora do cluster, em um destino que o invasor não controla. Depois de um incidente, é possível reconstruir o que uma conta ou um token comprometido fez: quais Secrets leu, o que criou, em quais pods entrou.

Os alertas de [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md) passam a ter de onde sair. Sem este controle, mudanças em RBAC, SCC e Secrets acontecem em silêncio.

## Pré-requisitos

- Um destino central de logs fora do cluster, alcançável a partir dos nós (o mesmo de [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md) e [LS-OCP-003](LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) serve).
- O operador Red Hat OpenShift Logging instalado. Se ainda não estiver, a instalação pelo OperatorHub faz parte do trabalho.
- Permissão de administração do cluster.
- `jq` na estação de administração.

## Avaliação

```bash
oc get apiserver cluster -o jsonpath='{.spec.audit.profile}{"\n"}'

for api in observability.openshift.io logging.openshift.io; do
  oc get "clusterlogforwarders.$api" -A -o json 2>/dev/null | jq -r '
    .items[] | "\(.metadata.namespace)/\(.metadata.name)\t"
    + ([.spec.pipelines[]? | select((.inputRefs // []) | index("audit")) | .outputRefs[]?] | join(","))'
done
```

- Perfil `None`: a API não registra nada. **Sem auditoria.** Vazio ou `Default` é o padrão e registra os metadados de cada requisição.
- Nenhum `ClusterLogForwarder` listado, ou segunda coluna vazia: o log de auditoria não sai dos nós de control plane. **Sem detecção.**
- Saída listada: confira o tipo e o endereço (`oc get clusterlogforwarder <nome> -n <namespace> -o yaml`). Se o único destino for o armazenamento de logs do próprio cluster, o registro continua ao alcance de quem comprometer o cluster.

O grupo de API do `ClusterLogForwarder` é `observability.openshift.io` no Logging 6.x e `logging.openshift.io` no Logging 5.x; o laço acima consulta os dois.

Para confirmar que o log existe localmente, sem alterar nada:

```bash
oc adm node-logs --role=master --path=kube-apiserver/
```

## Implementação

O exemplo usa a sintaxe do Logging 6.x. No Logging 5.x o recurso tem outro `apiVersion` e os campos da saída syslog são organizados de outra forma; siga o guia da versão instalada.

**1. Criar a service account do coletor e dar a permissão de leitura da auditoria.** Faça isso **antes** de citar `audit` em um pipeline: a documentação avisa que, sem a permissão, o operador remove o coletor inteiro e a coleta de todos os logs para.

```bash
oc create sa ls-coletor-auditoria -n openshift-logging
oc adm policy add-cluster-role-to-user collect-audit-logs \
  system:serviceaccount:openshift-logging:ls-coletor-auditoria
```

**2. Criar o encaminhamento.**

```yaml
apiVersion: observability.openshift.io/v1
kind: ClusterLogForwarder
metadata:
  name: ls-auditoria
  namespace: openshift-logging
spec:
  serviceAccount:
    name: ls-coletor-auditoria
  outputs:
    - name: syslog-central
      type: syslog
      syslog:
        url: tcp://192.0.2.50:514
        rfc: RFC5424
  pipelines:
    - name: auditoria-para-syslog
      inputRefs:
        - audit
      outputRefs:
        - syslog-central
```

```bash
oc apply -f ls-auditoria.yaml
```

Se o cluster já tem um `ClusterLogForwarder`, acrescente a saída e o pipeline a ele em vez de criar outro, e dê a permissão do passo 1 à service account que ele já usa.

A entrada `audit` reúne a auditoria da API do Kubernetes, da API do OpenShift, do `auditd` dos nós e do OVN. Quando a rede até o destino não for confiável, use `tls://` na URL e configure os certificados na saída.

**3. Manter o perfil de auditoria.** Não use o perfil `None`. O perfil `Default` é suficiente para este controle; a escolha de perfis mais detalhados é tratada em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

## Validação

```bash
oc get pods -n openshift-logging                 # os pods do coletor devem estar Running
oc create namespace ls-teste-auditoria && oc delete namespace ls-teste-auditoria
```

Procure `ls-teste-auditoria` no destino central. Os eventos de criação e remoção devem aparecer em poucos segundos, com o usuário que os executou no campo `user.username`.

## Reversão

```bash
oc delete clusterlogforwarder ls-auditoria -n openshift-logging
```

Se o pipeline foi acrescentado a um `ClusterLogForwarder` existente, remova apenas o pipeline e a saída. O log local nos nós de control plane não é afetado.

## Impacto operacional

- O log de auditoria é volumoso: cresce com o número de nós, operadores e requisições. Dimensione o destino e defina a retenção antes de ligar; acompanhe o volume nos primeiros dias.
- O coletor roda em todos os nós e consome CPU e memória, inclusive nos de control plane.
- Se o operador de logging ainda não estiver instalado, o esforço deixa de ser o de um único recurso: há instalação, atualização e monitoramento de um operador a mais.
- Com `tcp://` o conteúdo trafega em claro, e o log de auditoria traz nomes de usuários, namespaces e objetos. Prefira TLS fora de redes administrativas.
- Destino indisponível: o comportamento de fila e descarte depende da versão e do ajuste da saída. Verifique-o na documentação da versão em uso e monitore o destino.

## Detecção

Este controle é a base da detecção no plano de controle. Sinais próprios que merecem alerta no destino central:

- **Silêncio.** Um cluster que para de enviar auditoria pode estar com falha, mas também é o que acontece quando alguém desliga o encaminhamento.
- **Mudança no próprio encaminhamento:** alteração ou remoção de `clusterlogforwarders`, e remoção do vínculo com `collect-audit-logs`.
- **Mudança no perfil de auditoria:** alteração do recurso `apiservers` (`config.openshift.io`), em especial para `None`.

Os demais alertas construídos sobre este log estão em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

## Referências

- Documentação do OpenShift Container Platform: *Security and compliance* (Viewing audit logs; Configuring the audit log policy).
- Documentação do Red Hat OpenShift Logging 6.x: *Configuring logging* (Configuring log forwarding; Forwarding logs by using the syslog protocol; permissão `collect-audit-logs`).
- Documentação do OpenShift Container Platform 4.x, Logging 5.x: *Log collection and forwarding* (Forwarding logs using the syslog protocol).
