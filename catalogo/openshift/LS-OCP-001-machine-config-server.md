---
id: LS-OCP-001
titulo: Restringir o acesso ao Machine Config Server
tecnologia: openshift
pilar: conter
impacto: alto
esforco: baixo
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-001 — Restringir o acesso ao Machine Config Server

## Problema

O Machine Config Server (MCS) roda nos nós de plano de controle e atende nas portas **22623/TCP e 22624/TCP**, normalmente atrás do endereço `api-int`. Ele entrega a configuração Ignition a máquinas que estão entrando no cluster e, por isso, **não exige autenticação**: uma máquina nova ainda não tem identidade.

Quem alcança essa porta recebe a configuração completa de um nó, o que tipicamente inclui o pull secret do cluster, o kubeconfig de bootstrap do kubelet, certificados de CA internos e todo arquivo distribuído por MachineConfig.

A rede de pods já é bloqueada pelo plugin de rede do OpenShift. O risco está em **qualquer outro host que alcance a rede dos nós ou o balanceador do `api-int`**: um servidor legado na mesma sub-rede, uma VPN, uma rede corporativa roteada. Para um invasor nesse ponto, o MCS é uma fonte de credenciais sem custo.

## Benefício

O pull secret, o kubeconfig de bootstrap e os arquivos de configuração dos nós deixam de estar disponíveis para qualquer host da rede interna. Um invasor que comprometa um servidor vizinho ao cluster perde uma fonte de credenciais que hoje não exige nenhum esforço, e o cluster deixa de ser alcançável a partir de um incidente que começou fora dele.

O custo é uma regra de firewall em duas portas que só são usadas quando um nó é adicionado.

## Pré-requisitos

- Saber o CIDR da rede de máquinas (`oc get cm cluster-config-v1 -n kube-system -o yaml`, campo `machineNetwork`).
- Saber como o `api-int` é publicado: balanceador externo, balanceador de nuvem ou VIP nos próprios nós (instalações on-premise com keepalived).
- Acesso de administração ao balanceador ou firewall de rede.

## Avaliação

A partir de um host que **não** é nó do cluster — repita de cada rede relevante (servidores, estações, VPN):

```bash
curl -sk -o /dev/null -w '%{http_code}\n' --max-time 5 \
  -H 'Accept: application/vnd.coreos.ignition+json;version=3.2.0' \
  https://api-int.<cluster>.<dominio>:22623/config/worker
```

- `200`: o MCS está acessível dessa origem. **Exposto.**
- Tempo esgotado ou conexão recusada: a origem está bloqueada.

Teste também o IP de cada nó de plano de controle diretamente, pois o balanceador pode estar protegido e os nós não.

Verifique ainda se há segredos em MachineConfigs, pois eles são servidos pelo MCS:

```bash
oc get machineconfig -o name
oc get machineconfig <nome> -o yaml   # procure senhas, chaves e tokens em arquivos e units
```

## Implementação

Aplique na ordem. As duas primeiras medidas resolvem a maior parte dos casos.

**1. Filtrar no balanceador ou firewall de rede.** Permita 22623/TCP e 22624/TCP **somente a partir do CIDR da rede de máquinas**. Nenhuma outra rede precisa dessas portas. Em nuvem, ajuste o security group ou a regra de firewall do balanceador interno.

**2. Manter a rede de máquinas exclusiva.** Não coloque outros servidores na mesma sub-rede dos nós. O filtro por origem não distingue um nó de um servidor legado vizinho.

**3. Filtrar nos próprios nós** (opcional, quando os nós são alcançáveis diretamente sem passar pelo balanceador). Use o Ingress Node Firewall Operator nos nós de plano de controle:

```yaml
apiVersion: ingressnodefirewall.openshift.io/v1alpha1
kind: IngressNodeFirewall
metadata:
  name: ls-ocp-001-mcs
spec:
  interfaces:
    - br-ex
  nodeSelector:
    matchLabels:
      node-role.kubernetes.io/master: ""
  ingress:
    - sourceCIDRs:
        - 192.0.2.0/24        # rede de máquinas (e o balanceador, se ele fizer NAT de origem)
      rules:
        - order: 10
          protocolConfig:
            protocol: TCP
            tcp:
              ports: "22623-22624"
          action: Allow
    - sourceCIDRs:
        - 0.0.0.0/0
      rules:
        - order: 10
          protocolConfig:
            protocol: TCP
            tcp:
              ports: "22623-22624"
          action: Deny
```

Confirme o nome da interface (`br-ex` é o padrão com OVN-Kubernetes) e os CIDRs antes de aplicar. Se o balanceador faz NAT de origem, o nó enxerga o IP do balanceador e não o do cliente; nesse caso o filtro efetivo é o do balanceador (passo 1).

**4. Tirar segredos de MachineConfigs.** Nada que seja sensível deve ser distribuído por MachineConfig.

## Validação

- Repita o `curl` da avaliação a partir das redes bloqueadas: deve falhar.
- Repita a partir de um host na rede de máquinas: deve retornar `200`.
- Adicione um nó de teste (ou escale um MachineSet) e confirme que ele entra no cluster. É a única operação que depende do MCS.

## Reversão

- Balanceador/firewall: remova a regra de origem.
- Nós: `oc delete ingressnodefirewall ls-ocp-001-mcs`.

## Impacto operacional

- Nós existentes não usam o MCS depois de instalados; o risco se concentra na **adição de nós**. Se novos nós vierem de outra sub-rede, inclua-a na regra de permissão.
- Regra errada no Ingress Node Firewall pode isolar nós. Limite a regra às portas 22623-22624 e teste em cluster não produtivo.

## Detecção

- Os pods `machine-config-server` registram cada requisição com o endereço de origem:
  `oc logs -n openshift-machine-config-operator -l k8s-app=machine-config-server --tail=200`
  Requisições fora de janelas de adição de nós, ou de endereços que não são nós, merecem investigação.
- Logs do balanceador para as portas 22623/22624.
- CSRs pendentes inesperados (`oc get csr`): podem indicar uso do kubeconfig de bootstrap para tentar registrar um nó falso. Não aprove CSRs sem conferir a origem.

Se houver suspeita de que o conteúdo foi obtido por terceiros, trate o pull secret e qualquer segredo presente em MachineConfigs como comprometidos e faça a rotação.

## Referências

- Documentação do OpenShift Container Platform: *Machine Config Operator* e requisitos de rede/portas da instalação.
- Documentação do OpenShift Container Platform: *Ingress Node Firewall Operator*.
