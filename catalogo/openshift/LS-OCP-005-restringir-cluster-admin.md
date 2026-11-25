---
id: LS-OCP-005
titulo: Restringir o papel cluster-admin a poucas contas nominais
tecnologia: openshift
pilar: prevenir
impacto: alto
esforco: baixo
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-005 — Restringir o papel cluster-admin a poucas contas nominais

## Problema

O papel `cluster-admin` permite qualquer ação em qualquer projeto: ler todos os Secrets, executar comandos em qualquer pod, criar workloads privilegiados nos nós e alterar a própria configuração de segurança do cluster. Com o tempo, ele se acumula: é concedido "temporariamente" a desenvolvedores, a contas de integração, a service accounts de ferramentas e a grupos inteiros do diretório.

Cada conta com `cluster-admin` é um atalho para o invasor. Basta comprometer uma delas — uma estação, um token em um pipeline, uma senha reutilizada — para que a movimentação lateral termine ali mesmo, com o cluster inteiro sob controle.

## Benefício

O número de credenciais capazes de entregar o cluster inteiro cai de dezenas para um punhado conhecido. A invasão de uma conta comum, de um pipeline ou de uma ferramenta passa a render apenas o que aquela conta precisa para trabalhar.

A operação ganha uma lista curta e auditável de quem administra o cluster. Qualquer novo vínculo com `cluster-admin` deixa de ser rotina e vira um evento que merece alerta.

## Pré-requisitos

- Permissão de administração do cluster.
- Provedor de identidade configurado, de preferência com grupos sincronizados.
- Lista, acordada com os responsáveis, de quem de fato administra o cluster.
- `jq` na estação de administração.

## Avaliação

Liste todos os sujeitos vinculados ao papel `cluster-admin` em todo o cluster:

```bash
oc get clusterrolebindings -o json | jq -r '
  .items[] | select(.roleRef.name == "cluster-admin")
  | .metadata.name as $vinculo
  | .subjects[]? | "\($vinculo)\t\(.kind)\t\(.namespace // "-")\t\(.name)"'
```

Para cada grupo listado, veja quem são os membros:

```bash
oc get groups
```

Como interpretar:

- `system:masters`, `system:cluster-admins` e `system:admin` são vínculos padrão da plataforma.
- **Usuários** listados individualmente: confirme um a um se administram o cluster hoje.
- **Grupos**: o risco é o tamanho do grupo. Um grupo amplo do diretório com `cluster-admin` equivale a dar o papel a todos os seus membros.
- **Service accounts** fora dos namespaces `openshift-*` e `kube-*`: quase sempre são ferramentas (pipelines, GitOps, backup) que receberam mais do que precisam. O token de cada uma vale o cluster inteiro.
- `kube:admin` ainda existente: veja [LS-OCP-004](LS-OCP-004-remover-kubeadmin.md).

Um vínculo local (`RoleBinding`) com o papel `cluster-admin` dá administração total apenas daquele namespace, e não do cluster. Ainda assim, vale revisar:

```bash
oc get rolebindings -A -o json | jq -r '
  .items[] | select(.roleRef.name == "cluster-admin")
  | "\(.metadata.namespace)\t\(.metadata.name)\t\([.subjects[]?.name] | join(","))"'
```

## Implementação

**1. Concentrar o papel em um grupo nominal.** Em vez de vínculos por usuário, use um único grupo pequeno, de preferência sincronizado a partir do provedor de identidade:

```bash
oc adm groups new ls-administradores-do-cluster
oc adm groups add-users ls-administradores-do-cluster <usuario1> <usuario2>
oc adm policy add-cluster-role-to-group cluster-admin ls-administradores-do-cluster
```

Confirme, em uma sessão nova, que um membro do grupo administra o cluster (`oc auth can-i '*' '*' --all-namespaces`).

**2. Remover os vínculos que sobram, um por vez.** Antes de cada remoção, combine com o dono da conta qual papel menor atende ao trabalho: `admin` ou `edit` no namespace, `view` ou `cluster-reader` para consulta.

```bash
oc adm policy add-role-to-user admin <usuario> -n <namespace>            # o papel que substitui
oc adm policy remove-cluster-role-from-user cluster-admin <usuario>
oc adm policy remove-cluster-role-from-group cluster-admin <grupo>
```

**3. Tratar as service accounts.** Para cada ferramenta com `cluster-admin`, crie um `ClusterRole` ou `Role` com apenas os recursos e verbos que ela usa e substitua o vínculo. Veja [LS-OCP-010](LS-OCP-010-service-account-dedicada-por-workload.md).

```bash
oc adm policy remove-cluster-role-from-user cluster-admin -z <service-account> -n <namespace>
```

**4. Registrar a lista.** Guarde a saída da avaliação como linha de base. A revisão periódica consiste em rodar a avaliação e comparar.

## Validação

- A avaliação mostra apenas os vínculos padrão da plataforma e o grupo de administradores.
- Uma conta que perdeu o papel responde `no` a `oc auth can-i '*' '*' --all-namespaces` e continua conseguindo fazer o trabalho do dia a dia no seu namespace.
- As ferramentas que tiveram o papel reduzido continuam executando (pipeline, sincronização, backup).

## Reversão

```bash
oc adm policy add-cluster-role-to-user cluster-admin <usuario>
```

Para uma service account, acrescente `-z <service-account> -n <namespace>` no lugar do usuário. Se a remoção quebrou uma ferramenta, devolva o papel, levante quais permissões ela usa e tente de novo com um papel sob medida.

## Impacto operacional

- Pessoas acostumadas a fazer tudo com `cluster-admin` vão encontrar negações. Tenha um caminho rápido para pedir acesso e um papel de consulta amplo (`cluster-reader`) para diagnóstico.
- Ferramentas que receberam `cluster-admin` "para funcionar" raramente documentam o mínimo necessário. Levantar as permissões reais dá trabalho; faça primeiro em homologação.
- Alguns operadores instalados pelo OLM criam vínculos amplos para as próprias service accounts. Não os remova à mão: o operador recria o vínculo ou para de funcionar. Registre-os como exceção conhecida.
- O papel `cluster-admin` não é o único caminho para o controle total. Papéis com `*` em recursos e verbos, ou com os verbos `escalate`, `bind` e `impersonate`, merecem a mesma revisão.

## Detecção

Com o log de auditoria da API fora do cluster ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)), alerte para criação ou alteração de `clusterrolebindings` e para mudanças de membros no grupo de administradores (recurso `groups`, grupo de API `user.openshift.io`). Os filtros estão em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

Depois deste controle, um novo vínculo com `cluster-admin` fora de uma mudança planejada é um sinal de alta qualidade: ou é um desvio de processo, ou é alguém estabelecendo persistência.

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Using RBAC to define and apply permissions; Default cluster roles; Cluster role bindings).
- Documentação do OpenShift Container Platform: *Authentication and authorization* (Syncing LDAP groups).
- Documentação do OpenShift Container Platform: *CLI tools* (referência dos comandos `oc adm policy` e `oc adm groups`).
