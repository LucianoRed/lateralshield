---
id: LS-OCP-011
titulo: Restringir o acesso a Secrets com RBAC
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-011 — Restringir o acesso a Secrets com RBAC

## Problema

Os Secrets de um namespace guardam o que o invasor procura para dar o próximo passo: senhas de banco de dados, chaves de API, certificados, credenciais de registries e tokens de outras contas. O conteúdo é apenas codificado em base64; quem tem permissão de leitura na API tem a credencial.

E essa permissão é mais comum do que parece. Os papéis padrão `admin` e `edit` leem todos os Secrets do namespace, e costumam ser dados a todos os desenvolvedores, a pipelines e a service accounts de aplicação. Um papel de cluster com leitura de Secrets vale para todos os namespaces de uma vez. Para o invasor que obtém um desses tokens, uma única chamada de listagem entrega as credenciais de todos os sistemas com os quais as aplicações falam.

## Benefício

A invasão de uma aplicação ou de uma conta comum deixa de render as credenciais das demais. Cada workload alcança apenas os Secrets de que precisa, e a maior parte das pessoas trabalha sem ler nenhum.

O número de identidades capazes de ler Secrets passa a ser pequeno e conhecido. Uma leitura fora desse conjunto — ou uma tentativa negada — vira um sinal claro, em vez de se perder no tráfego normal da API.

## Pré-requisitos

- Permissão de administração do cluster e dos namespaces alvo.
- Saber quais pessoas e ferramentas precisam, de fato, ler ou alterar Secrets.
- `jq` na estação de administração.

## Avaliação

**1. Quem lê Secrets em um namespace, e em todos:**

```bash
oc adm policy who-can get secrets -n <namespace>
oc adm policy who-can list secrets -n <namespace>
oc adm policy who-can list secrets --all-namespaces
```

**2. Papéis de cluster que dão leitura de Secrets:**

```bash
oc get clusterroles -o json | jq -r '
  .items[]
  | select(any(.rules[]?;
        ((.apiGroups // []) | (index("") != null or index("*") != null))
        and ((.resources // []) | (index("secrets") != null or index("*") != null))
        and ((.verbs // []) | (index("get") != null or index("list") != null
                               or index("watch") != null or index("*") != null))))
  | .metadata.name'
```

**3. Service accounts de aplicação com leitura de Secrets:**

```bash
oc auth can-i list secrets --as=system:serviceaccount:<namespace>:<conta> -n <namespace>
```

Como interpretar:

- No passo 1, grupos amplos (todos os desenvolvedores, `system:authenticated`, `system:serviceaccounts`) com leitura de Secrets são **exposição**. A consulta com `--all-namespaces` deveria listar apenas administradores do cluster e contas da plataforma. Confira as opções de `who-can` com `oc adm policy who-can --help` na versão do cliente em uso.
- No passo 2, a lista inclui papéis da plataforma. O que importa é cruzá-la com os vínculos: quais desses papéis estão ligados a pessoas, grupos e contas de aplicação.
- No passo 3, a resposta esperada para uma aplicação comum é `no`. Um pod não precisa de permissão na API para usar um Secret montado como volume ou injetado como variável.

## Implementação

**1. Tirar a leitura de quem só consulta.** O papel padrão `view` não dá acesso a Secrets. Para pessoas que acompanham a aplicação sem alterá-la, troque `edit` ou `admin` por `view`:

```bash
oc adm policy add-role-to-user view <usuario> -n <namespace>
oc adm policy remove-role-from-user edit <usuario> -n <namespace>
```

**2. Tirar a leitura das service accounts de aplicação.** Remova `edit`, `admin` e papéis equivalentes das contas dos workloads ([LS-OCP-010](LS-OCP-010-service-account-dedicada-por-workload.md)). A aplicação continua recebendo os próprios Secrets por volume ou variável, que são montados pelo kubelet e não dependem do RBAC da conta.

**3. Quando a aplicação precisa ler um Secret pela API,** conceda apenas `get` e apenas nos nomes necessários:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: <aplicacao>-ler-secret
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["<nome-do-secret>"]
    verbs: ["get"]
```

Não inclua `list` nem `watch`: uma listagem devolve o conteúdo de todos os Secrets do namespace, e `resourceNames` não a restringe na prática.

**4. Separar por namespace o que tem sensibilidade diferente.** O RBAC do namespace é a fronteira. Secrets de produção e de homologação, ou de aplicações de times diferentes, não devem compartilhar namespace.

**5. Rever os vínculos de cluster.** Substitua vínculos de cluster com leitura de Secrets por vínculos locais nos namespaces necessários. Papéis com `*` em recursos merecem a mesma revisão ([LS-OCP-005](LS-OCP-005-restringir-cluster-admin.md)).

Como complemento, a criptografia do etcd protege os Secrets em backups e discos do control plane. Ela não substitui o RBAC: quem lê pela API recebe o conteúdo em claro.

## Validação

```bash
oc auth can-i get secrets --as=<usuario> -n <namespace>                                  # "no" para quem só consulta
oc auth can-i list secrets --as=system:serviceaccount:<namespace>:<conta> -n <namespace> # "no"
oc auth can-i get secret/<nome-do-secret> --as=system:serviceaccount:<namespace>:<conta> -n <namespace>  # "yes" só se concedido
```

A aplicação deve continuar iniciando e autenticando em seus destinos depois de um `oc rollout restart`. Os pipelines de entrega devem continuar concluindo.

## Reversão

```bash
oc adm policy add-role-to-user edit <usuario> -n <namespace>
```

Para uma service account, use `-z <conta>` no lugar do usuário. Para um `Role` criado no passo 3, `oc delete role <aplicacao>-ler-secret -n <namespace>`.

## Impacto operacional

- Desenvolvedores que consultavam senhas direto no cluster deixam de conseguir. Defina o caminho oficial para obter credenciais de ambientes não produtivos.
- Pipelines e ferramentas de entrega contínua que criam ou atualizam Secrets precisam manter a permissão — de escrita, nos namespaces que administram. Leitura e escrita são verbos separados; conceda apenas o que a ferramenta usa.
- Operadores e controladores que observam Secrets (certificados, integração com cofres) precisam de `list` e `watch`. São exceções legítimas; registre-as.
- Quem pode criar pods em um namespace consegue montar qualquer Secret dele em um pod próprio. Restringir a leitura pela API reduz o caminho mais fácil, mas a fronteira real continua sendo o namespace (passo 4).

## Detecção

Leituras de Secrets ficam no log de auditoria da API, em nível de metadados: quem, quando, qual Secret, com qual resultado. Com o log no destino central ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)), alerte para:

- `list` de `secrets` por pessoas ou por contas de aplicação, em especial sem namespace (todo o cluster);
- respostas `403` em `secrets`: depois deste controle, uma conta de aplicação tentando ler Secrets é comportamento anômalo;
- novos papéis ou vínculos que concedam leitura de Secrets.

Os filtros estão em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Using RBAC to define and apply permissions; Default cluster roles).
- Documentação do OpenShift Container Platform: *Nodes* (Providing sensitive data to pods by using secrets).
- Documentação do Kubernetes: *Using RBAC Authorization* (Referring to resources; `resourceNames`) e *Good practices for Kubernetes Secrets*.
- Documentação do OpenShift Container Platform: *Security and compliance* (Encrypting etcd data).
