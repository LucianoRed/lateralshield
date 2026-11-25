---
id: LS-OCP-002
titulo: Aplicar NetworkPolicy de negação padrão nos namespaces de aplicação
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.x com OVN-Kubernetes
status: rascunho
---

# LS-OCP-002 — Aplicar NetworkPolicy de negação padrão nos namespaces de aplicação

## Problema

Sem NetworkPolicy, a rede de pods do OpenShift é plana: qualquer pod alcança qualquer outro pod de qualquer namespace. Um invasor que compromete uma aplicação pouco importante consegue falar diretamente com o banco de dados, o cache e as APIs internas de todas as outras.

## Benefício

A invasão de uma aplicação fica restrita ao namespace dela. Bancos de dados, caches e APIs internas das demais aplicações deixam de ser alcançáveis a partir de um pod comprometido, mesmo que não tenham autenticação.

O alcance de um incidente passa a ser uma aplicação, e não o cluster inteiro. Como efeito adicional, as dependências entre aplicações ficam documentadas nas próprias políticas.

## Pré-requisitos

- Permissão de administração nos namespaces alvo.
- Conhecer quais namespaces conversam entre si. Se não souber, comece por um namespace e observe.

## Avaliação

Liste os namespaces de aplicação sem nenhuma NetworkPolicy:

```bash
for ns in $(oc get ns -o jsonpath='{.items[*].metadata.name}'); do
  case "$ns" in openshift*|kube-*|default) continue ;; esac
  [ "$(oc get networkpolicy -n "$ns" --no-headers 2>/dev/null | wc -l)" -eq 0 ] && echo "$ns"
done
```

Todo namespace listado aceita conexões de qualquer pod do cluster.

## Implementação

Aplique em cada namespace de aplicação este conjunto base. Ele bloqueia a entrada por padrão e libera apenas o tráfego do próprio namespace, do roteador de ingress e do monitoramento da plataforma.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ls-negar-entrada-por-padrao
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ls-permitir-mesmo-namespace
spec:
  podSelector: {}
  ingress:
    - from:
        - podSelector: {}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ls-permitir-ingress-openshift
spec:
  podSelector: {}
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              policy-group.network.openshift.io/ingress: ""
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ls-permitir-monitoramento-openshift
spec:
  podSelector: {}
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              network.openshift.io/policy-group: monitoring
```

```bash
oc apply -n <namespace> -f politicas-base.yaml
```

Para cada dependência legítima entre namespaces, adicione uma política específica de permissão, selecionando o namespace de origem por label (`kubernetes.io/metadata.name: <origem>`) e, de preferência, a porta.

Para que namespaces novos já nasçam protegidos, inclua essas políticas no modelo de projeto do cluster (`oc adm create-bootstrap-project-template`).

## Validação

A partir de um pod em **outro** namespace:

```bash
oc exec -n <outro-namespace> <pod> -- curl -s --max-time 5 http://<servico>.<namespace>.svc:8080/
```

Deve esgotar o tempo. A rota pública da aplicação e as chamadas dentro do próprio namespace devem continuar funcionando.

## Reversão

```bash
oc delete networkpolicy ls-negar-entrada-por-padrao -n <namespace>
```

Remover apenas `ls-negar-entrada-por-padrao` devolve o namespace ao comportamento aberto; as políticas de permissão podem permanecer.

## Impacto operacional

- Chamadas entre namespaces que ninguém documentou vão parar. Aplique primeiro em homologação e tenha a reversão à mão.
- Operadores e webhooks de admissão que rodam no namespace precisam receber conexões do plano de controle; verifique antes de aplicar em namespaces com operadores.
- O conjunto base trata apenas a **entrada**. A saída dos pods para a rede dos nós e para os metadados de nuvem é tratada no [LS-OCP-012](LS-OCP-012-adminnetworkpolicy.md), com regras de cluster que o namespace não sobrescreve.

## Detecção

O OVN-Kubernetes pode registrar conexões negadas por NetworkPolicy. Ative por namespace:

```bash
oc annotate namespace <namespace> \
  k8s.ovn.org/acl-logging='{"deny": "alert", "allow": "info"}'
```

Os eventos aparecem nos logs do OVN nos nós. Um pod tentando alcançar namespaces com os quais nunca falou é um sinal direto de reconhecimento interno.

## Referências

- Documentação do OpenShift Container Platform: *Network policy* (About network policy; Defining a default network policy for projects).
- Documentação do OpenShift Container Platform: *Logging for egress firewall and network policy rules*.
