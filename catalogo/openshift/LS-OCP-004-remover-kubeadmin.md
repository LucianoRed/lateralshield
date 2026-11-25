---
id: LS-OCP-004
titulo: Remover o usuário kubeadmin
tecnologia: openshift
pilar: prevenir
impacto: alto
esforco: baixo
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-004 — Remover o usuário kubeadmin

## Problema

A instalação do OpenShift cria o usuário `kubeadmin`, com o papel `cluster-admin` e uma senha gerada uma única vez, gravada no diretório de instalação (`auth/kubeadmin-password`). É uma conta local e compartilhada: não passa pelo provedor de identidade, não tem segundo fator e não identifica a pessoa que a usou.

Essa senha costuma sobreviver por anos em diretórios de instalação, wikis, chamados e cofres pessoais. Para um invasor que já está na rede, encontrar esse arquivo em uma estação ou em um servidor de apoio é o caminho mais curto até o plano de controle: um único texto dá controle total do cluster e de tudo o que roda nele.

## Benefício

A senha de instalação deixa de valer. Cópias antigas do arquivo `kubeadmin-password`, onde quer que estejam, passam a não servir para nada.

Todo acesso administrativo ao cluster passa pelo provedor de identidade, com as proteções que ele oferece (segundo fator, bloqueio, desligamento de quem saiu da empresa), e fica registrado no log de auditoria com o nome de uma pessoa, e não de uma conta genérica.

## Pré-requisitos

- Pelo menos um provedor de identidade configurado no OAuth do cluster e testado.
- Pelo menos um usuário nominal com o papel `cluster-admin`, com login já testado. Veja [LS-OCP-005](LS-OCP-005-restringir-cluster-admin.md).
- Um caminho de emergência definido para o caso de indisponibilidade do provedor de identidade (ver *Reversão*).
- `jq` na estação de administração, para o comando de avaliação.

## Avaliação

```bash
oc get secret kubeadmin -n kube-system --ignore-not-found -o name
oc get oauth cluster -o jsonpath='{range .spec.identityProviders[*]}{.name}{"\t"}{.type}{"\n"}{end}'
oc get clusterrolebindings -o json | jq -r '
  .items[] | select(.roleRef.name == "cluster-admin") | .subjects[]? | "\(.kind)\t\(.name)"' | sort -u
```

- O primeiro comando retorna `secret/kubeadmin`: o usuário de instalação ainda existe. **Exposto.**
- O segundo não lista nenhum provedor de identidade: o `kubeadmin` é a única forma de entrar. Configure o provedor antes de qualquer outra coisa.
- O terceiro precisa mostrar ao menos um usuário ou grupo nominal além de `system:masters`, `system:cluster-admins` e `system:admin`, que são vínculos padrão da plataforma.

Procure também cópias do arquivo `auth/kubeadmin-password` no host de onde a instalação foi feita, em repositórios e em documentação interna.

## Implementação

**1. Confirmar o acesso nominal.** Em uma sessão nova, entre com o usuário do provedor de identidade que recebeu `cluster-admin` e confirme:

```bash
oc whoami
oc auth can-i '*' '*' --all-namespaces      # deve responder "yes"
```

Não avance enquanto esse teste não passar. A documentação oficial é explícita: remover o `kubeadmin` antes de existir outro `cluster-admin` obriga a reinstalar o cluster.

**2. Guardar o acesso de emergência.** O arquivo `auth/kubeconfig` gerado pela instalação autentica como `system:admin` por certificado de cliente e não depende do OAuth nem do provedor de identidade. Guarde-o em cofre, com acesso restrito e registrado, e remova as demais cópias.

**3. Remover o usuário.**

```bash
oc delete secrets kubeadmin -n kube-system
```

**4. Eliminar as cópias da senha.** Apague o arquivo `kubeadmin-password` do diretório de instalação e das cópias encontradas na avaliação.

## Validação

```bash
oc get secret kubeadmin -n kube-system        # deve responder NotFound
oc login -u kubeadmin https://api.cluster.exemplo.com.br:6443   # deve falhar na autenticação
```

O login pelo provedor de identidade, no console e no `oc`, deve continuar funcionando.

## Reversão

**Não há reversão.** A documentação oficial informa que o comando não pode ser desfeito. Por isso o controle exige, como pré-requisito, um `cluster-admin` nominal testado.

O que substitui o `kubeadmin` em uma emergência (provedor de identidade fora do ar, por exemplo) é o `kubeconfig` da instalação guardado no passo 2. Uma alternativa é manter um segundo provedor de identidade do tipo `htpasswd`, nativo do OpenShift, com uma única conta nominal de emergência e senha em cofre.

## Impacto operacional

- Se o provedor de identidade ficar indisponível e não houver caminho de emergência, ninguém entra no cluster. Teste o caminho de emergência antes de remover o `kubeadmin`, e repita o teste periodicamente.
- Automação e scripts que usam a senha do `kubeadmin` param. Substitua por service accounts com papéis mínimos ([LS-OCP-010](LS-OCP-010-service-account-dedicada-por-workload.md)).
- O `kubeconfig` de instalação passa a ser a credencial mais sensível do cluster: não expira no curto prazo e não é revogado pela saída de uma pessoa da equipe. Trate-o como credencial de cofre.

## Detecção

No log de auditoria da API ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)), o `kubeadmin` aparece como `user.username` igual a `kube:admin`. Dois sinais merecem alerta no destino central:

- **Antes da remoção:** qualquer requisição de `kube:admin`. Mostra quem ainda depende da conta.
- **Depois da remoção:** criação de um Secret chamado `kubeadmin` em `kube-system`, ou qualquer requisição de `system:admin` fora de uma emergência declarada.

As regras de alerta estão descritas em [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md).

## Referências

- Documentação do OpenShift Container Platform: *Authentication and authorization* (Removing the kubeadmin user).
- Documentação do OpenShift Container Platform: *Authentication and authorization* (Understanding identity provider configuration; Configuring an htpasswd identity provider).
- Documentação do OpenShift Container Platform: *Security and compliance* (Viewing audit logs).
