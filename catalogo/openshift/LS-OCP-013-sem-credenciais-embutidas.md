---
id: LS-OCP-013
titulo: Eliminar credenciais embutidas em manifestos, imagens e variáveis
tecnologia: openshift
pilar: conter
impacto: alto
esforco: medio
versoes: OpenShift 4.x
status: rascunho
---

# LS-OCP-013 — Eliminar credenciais embutidas em manifestos, imagens e variáveis

## Problema

Senhas, tokens e chaves acabam em lugares que não foram feitos para guardá-los: no campo `value` de uma variável de ambiente do Deployment, em um ConfigMap, em uma camada da imagem, no repositório Git que guarda os manifestos.

Nesses lugares a credencial fica visível para muito mais gente do que um Secret. Quem tem o papel `view` no namespace lê Deployments e ConfigMaps. Quem consegue baixar a imagem lê suas camadas e variáveis. Quem clona o repositório recebe todo o histórico, inclusive as senhas "já removidas". Restringir o acesso a Secrets ([LS-OCP-011](LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md)) não adianta se a mesma senha está em claro ao lado.

Para o invasor, é a forma mais barata de obter credenciais para o próximo sistema: não exige privilégio, só leitura.

## Benefício

O acesso de leitura a um namespace, a um registry ou a um repositório deixa de entregar credenciais. Para obter a senha do banco de dados, o invasor passa a precisar de permissão explícita sobre o Secret — um conjunto pequeno de identidades, controlado e auditado.

A operação ganha um lugar único para cada credencial. Trocar uma senha passa a ser alterar um Secret, sem reconstruir imagem nem editar manifestos, e a rotação depois de um incidente fica viável.

## Pré-requisitos

- Permissão de leitura nos namespaces alvo e acesso de leitura aos repositórios de manifestos.
- `jq` e `podman` na estação de administração.
- Acordo com os responsáveis pelas aplicações: toda credencial encontrada em claro terá de ser **trocada**, e não apenas movida.

## Avaliação

Os comandos mostram apenas **onde** há suspeita, sem exibir os valores.

**1. Variáveis de ambiente com valor literal e nome de credencial:**

```bash
oc get deployments,statefulsets,daemonsets,cronjobs -A -o json | jq -r '
  .items[]
  | select(.metadata.namespace | test("^(openshift.*|kube-.*|default)$") | not)
  | . as $w
  | [.. | objects | select(has("containers")) | .containers[], (.initContainers // [])[]]
  | .[] | .name as $c | .env[]?
  | select(.value != null and .value != ""
           and (.name | test("PASS|PWD|SECRET|TOKEN|CREDENTIAL|API_?KEY|PRIVATE"; "i")))
  | "\($w.kind)\t\($w.metadata.namespace)/\($w.metadata.name)\t\($c)\t\(.name)"' | sort -u
```

**2. ConfigMaps com chaves ou conteúdo que parecem credenciais:**

```bash
oc get configmaps -A -o json | jq -r '
  .items[]
  | select(.metadata.namespace | test("^(openshift.*|kube-.*|default)$") | not)
  | . as $cm | (.data // {}) | to_entries[]
  | select((.key + "\n" + .value)
           | test("passw(or)?d\\s*[=:]|secret\\s*[=:]|token\\s*[=:]|BEGIN [A-Z ]*PRIVATE KEY"; "i"))
  | "\($cm.metadata.namespace)/\($cm.metadata.name)\t\(.key)"' | sort -u
```

**3. Imagens.** Para as imagens construídas internamente, liste os nomes das variáveis definidas e os comandos de construção:

```bash
podman image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' <imagem> | cut -d= -f1
podman history --no-trunc --format '{{.CreatedBy}}' <imagem> | grep -iE 'pass|secret|token|key' | cut -c1-120
```

**4. Repositórios.** Procure nos manifestos versionados, inclusive no histórico, objetos `kind: Secret` com dados e os mesmos padrões de nome dos passos 1 e 2.

Como interpretar: cada linha é um candidato, e não uma confirmação — há falsos positivos (por exemplo, uma variável que guarda o caminho de um arquivo de senha). Toda credencial confirmada em claro deve ser considerada **exposta**: não há como saber quem já a leu.

## Implementação

**1. Trocar a credencial.** Gere uma nova no sistema de destino (banco de dados, API, registry). Mover a senha antiga para um Secret não resolve: ela continua no histórico do Git, em camadas de imagem e em cópias de manifestos.

**2. Guardar a nova credencial em um Secret,** criado a partir de arquivo, para que o valor não fique no histórico do shell nem em manifestos:

```bash
oc create secret generic <aplicacao>-banco -n <namespace> \
  --from-file=usuario=./usuario.txt --from-file=senha=./senha.txt
```

**3. Referenciar o Secret no workload.** Prefira volume a variável de ambiente: variáveis aparecem em despejos de diagnóstico e são herdadas por processos filhos.

```yaml
spec:
  template:
    spec:
      containers:
        - name: <aplicacao>
          volumeMounts:
            - name: credenciais-do-banco
              mountPath: /etc/credenciais/banco
              readOnly: true
      volumes:
        - name: credenciais-do-banco
          secret:
            secretName: <aplicacao>-banco
```

Quando a aplicação só aceita variável, use `valueFrom.secretKeyRef` em vez de `value`.

**4. Limpar as imagens.** Reconstrua sem credenciais em `ENV`, `ARG` ou arquivos copiados. Credenciais necessárias apenas durante a construção (repositórios de dependências, por exemplo) devem entrar como segredo de construção, que não fica gravado nas camadas, e não como argumento.

**5. Limpar os repositórios.** Não versione objetos Secret com dados em claro. Remova as credenciais dos manifestos; como o histórico as mantém, a troca do passo 1 é o que de fato encerra a exposição.

**6. Restringir quem lê os Secrets** ([LS-OCP-011](LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md)). Em ambientes que já têm um cofre externo, o Secrets Store CSI Driver Operator, de disponibilidade geral a partir do OpenShift 4.18, monta as credenciais direto do cofre no pod.

## Validação

- A avaliação, repetida, não lista mais as ocorrências tratadas.
- A aplicação inicia e autentica no destino com a credencial nova (`oc rollout status deployment/<aplicacao> -n <namespace>` e os logs da aplicação).
- A credencial antiga **não** funciona mais no sistema de destino. Este é o teste que importa.

## Reversão

Volte o workload à revisão anterior:

```bash
oc rollout undo deployment/<aplicacao> -n <namespace>
```

Se a credencial antiga já foi desativada no destino, a revisão anterior não vai autenticar. Mantenha a credencial antiga ativa apenas durante a janela de troca, e só a desative depois da validação.

## Impacto operacional

- A troca de credencial exige coordenação com o dono do sistema de destino e, em geral, um reinício da aplicação.
- Um Secret montado como volume é atualizado no pod quando muda, mas a maioria das aplicações só lê o arquivo ao iniciar: planeje o reinício. Secret injetado como variável só muda com a recriação do pod.
- Scripts de inicialização que montam a configuração a partir de variáveis precisam ser ajustados para ler arquivos.
- Um Secret não é criptografia: o conteúdo é codificado em base64. A proteção vem do RBAC e da separação por namespace; sem [LS-OCP-011](LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md), o ganho deste controle é parcial.
- A busca por padrões de nome não encontra tudo. Credenciais dentro de URLs de conexão, de arquivos de propriedades ou com nomes fora do padrão escapam; a revisão com quem conhece a aplicação continua necessária.

## Detecção

Este controle gera pouco sinal próprio; o que ele faz é tornar úteis os sinais dos demais. Com as credenciais apenas em Secrets, a leitura delas passa a ficar registrada no log de auditoria da API ([LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md)) e coberta pelos alertas de [LS-OCP-007](LS-OCP-007-alertas-de-rbac-scc-e-secrets.md) — o que não acontece quando a senha está em um Deployment ou ConfigMap, cuja leitura é rotina.

Dois sinais complementares:

- **Regressão.** Rode a avaliação periodicamente e no pipeline de entrega; uma ocorrência nova é um achado a tratar antes de chegar à produção.
- **Uso da credencial antiga.** Depois da troca, tentativas de autenticação com a credencial desativada, registradas no sistema de destino, indicam que alguém a havia copiado.

## Referências

- Documentação do OpenShift Container Platform: *Nodes* (Providing sensitive data to pods by using secrets).
- Documentação do OpenShift Container Platform: *Builds* (Using build volumes; Input secrets and config maps).
- Documentação do OpenShift Container Platform: *Storage* (Secrets Store CSI driver).
- Documentação do Kubernetes: *Secrets* e *Good practices for Kubernetes Secrets*.
- `podman-image-inspect(1)` e `podman-history(1)`.
