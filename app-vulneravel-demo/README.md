# App vulnerável de demonstração

> ⚠ **Aplicação deliberadamente vulnerável.** Ela existe só como **alvo de teste**, para medir o quanto a defesa de um ambiente contém um componente invadido. As falhas são propositais.
>
> **Não use em produção. Não exponha à internet. Não coloque dados reais.** Rode apenas em um cluster ou projeto de **laboratório isolado e descartável**.

Esta pasta **não faz parte do catálogo** do LateralShield. O catálogo reúne controles de defesa; aqui está o oposto: uma aplicação web frágil de propósito, com um banco de dados, para servir de alvo. A ideia é simples: instale a aplicação, aponte uma ferramenta de teste de intrusão para ela e observe, com os controles do catálogo aplicados, até onde o ataque consegue ir.

A aplicação é um "Portal Interno" fictício: login, notas, uma busca, ferramentas de rede e download de arquivos. Os usuários, e-mails e endereços são fictícios (faixas de documentação e domínio `exemplo.com.br`).

## O que serve para demonstrar

A aplicação é o **ponto de entrada** do [modelo de ameaça](../docs/modelo-de-ameaca.md): um componente que o invasor compromete e a partir do qual tenta se mover. Com ela instalada, dá para mostrar na prática o efeito dos controles, entre outros:

| A partir da aplicação comprometida, o invasor tenta… | Controle que contém |
|---|---|
| Falar com outros pods e namespaces do cluster | [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md), [LS-OCP-012](../catalogo/openshift/LS-OCP-012-adminnetworkpolicy.md) |
| Sair para a internet ou alcançar serviços internos e metadados | [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md) (saída), [LS-OCP-001](../catalogo/openshift/LS-OCP-001-machine-config-server.md) |
| Usar o token da service account montado no pod | [LS-OCP-010](../catalogo/openshift/LS-OCP-010-service-account-dedicada-por-workload.md) |
| Ler Secrets e credenciais além do necessário | [LS-OCP-011](../catalogo/openshift/LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md), [LS-OCP-013](../catalogo/openshift/LS-OCP-013-sem-credenciais-embutidas.md) |
| Escapar para o nó, com root ou acesso ao host | [LS-OCP-008](../catalogo/openshift/LS-OCP-008-scc-privilegiadas-so-com-justificativa.md), [LS-OCP-009](../catalogo/openshift/LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md) |
| Agir sem deixar rastro | [LS-OCP-003](../catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md), [LS-OCP-006](../catalogo/openshift/LS-OCP-006-auditoria-da-api-fora-do-cluster.md) |

Classes de vulnerabilidade presentes na aplicação, para você saber o que a defesa precisa conter: autenticação fraca (`admin`/`admin`, senhas em texto claro), injeção de SQL, injeção de comando no sistema, requisição forjada pelo servidor (SSRF), travessia de caminho na leitura de arquivos, referência direta a objeto e escalonamento de privilégio, XSS e vazamento de configuração. Este README **não traz passo a passo de ataque**: a ferramenta de teste encontra os caminhos.

## Instalação no OpenShift

```bash
oc new-project app-vulneravel-demo
oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/app-vulneravel-demo/openshift/app-vulneravel-demo.yaml
oc rollout status deploy/app-vulneravel-web -n app-vulneravel-demo
```

Ou, a partir de uma cópia do repositório, troque o endereço por `app-vulneravel-demo/openshift/app-vulneravel-demo.yaml`.

O manifesto cria, no projeto `app-vulneravel-demo`, a aplicação (na imagem `ubi9/php-82`, **sem etapa de build**: o código chega por um ConfigMap) e um banco MySQL (`rhel9/mysql-80`) com volume de 1 Gi.

**De propósito, o manifesto não publica uma rota.** Uma aplicação vulnerável com endereço na internet é um convite. Para alcançá-la a partir da sua máquina, use um encaminhamento de porta:

```bash
oc port-forward -n app-vulneravel-demo deploy/app-vulneravel-web 8080:8080
# abra http://127.0.0.1:8080
```

Se a ferramenta de ataque roda dentro do cluster, aponte-a para o serviço `app-vulneravel-web.app-vulneravel-demo.svc:8080`. Só crie uma `Route` se o cluster inteiro estiver isolado e você souber o que está fazendo.

Pré-requisitos: permissão para criar projetos (`oc new-project`), uma StorageClass padrão e acesso do cluster a `registry.redhat.io` e `registry.access.redhat.com`.

## Acesso

Usuário `admin`, senha `admin`. Também existem os usuários comuns `ana` e `bruno`, para demonstrar ataques a partir de uma conta sem privilégio. Tudo isso é fictício e propositalmente fraco.

## Demonstrar a contenção

A instalação acima é a linha de base **sem defesa**: rede plana e token da service account montado. Para mostrar a diferença, aplique os controles e repita o teste.

1. **Rede.** As políticas do LateralShield, já prontas para este projeto:

   ```bash
   oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/app-vulneravel-demo/openshift/contencao.yaml
   ```

   Elas seguem o [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md): negam a entrada por padrão e limitam a saída da aplicação ao banco e ao DNS, o que contém a requisição forjada (SSRF) e a saída para a internet. O encaminhamento de porta continua funcionando, porque não passa pela rede de pods. A política de saída exige um provedor de rede que a suporte, como o OVN-Kubernetes padrão do OpenShift.

2. **Token da service account e reforço do contêiner** ([LS-OCP-009](../catalogo/openshift/LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md), [LS-OCP-010](../catalogo/openshift/LS-OCP-010-service-account-dedicada-por-workload.md)):

   ```bash
   oc patch deploy/app-vulneravel-web -n app-vulneravel-demo --type=merge \
     -p '{"spec":{"template":{"spec":{"automountServiceAccountToken":false}}}}'
   ```

Para voltar à linha de base, remova a contenção (`oc delete -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/app-vulneravel-demo/openshift/contencao.yaml`) e desfaça o patch (`automountServiceAccountToken: true`).

## Executar em um contêiner

Fora do OpenShift, em um host isolado:

```bash
podman build -t app-vulneravel-demo app-vulneravel-demo/
podman run -d --name app-vulneravel-demo -p 127.0.0.1:8080:8080 app-vulneravel-demo
```

Nessa forma os dados ficam em um arquivo SQLite dentro do contêiner. Publique a porta apenas em `127.0.0.1`, nunca em todas as interfaces.

## Remoção

```bash
oc delete project app-vulneravel-demo
```

Remova o projeto assim que terminar o exercício. A aplicação é descartável: não guarde nada dela.

## Manutenção

O manifesto `openshift/app-vulneravel-demo.yaml` é **gerado** e não deve ser editado à mão:

```bash
python3 scripts/app_vulneravel.py           # regenera o manifesto a partir de web/ e base.yaml
python3 scripts/app_vulneravel.py --check    # falha se estiver desatualizado (usado no CI)
```

| Arquivo | Papel |
|---|---|
| `web/index.php` | Páginas e roteamento. As falhas estão marcadas com "VULNERÁVEL DE PROPÓSITO" |
| `web/lib.php` | Conexão com o banco, dados de exemplo e layout |
| `web/.htaccess` | Encaminha tudo para o `index.php` |
| `openshift/base.yaml` | Secret, MySQL, Deployment e Service, sem contenção |
| `openshift/contencao.yaml` | Políticas de rede do LateralShield, aplicadas por cima para a demonstração |
| `Containerfile` | Imagem única, para uso fora do OpenShift |

Para desenvolver sem contêiner: `cd app-vulneravel-demo/web && php -S 127.0.0.1:8080 index.php` (usa SQLite em um arquivo temporário).

## Estado

A aplicação foi conferida no servidor PHP local com SQLite e no Chrome: as falhas respondem como esperado e as páginas funcionam. **O manifesto ainda não foi aplicado em um cluster OpenShift**, e a contenção (rotas, NetworkPolicies, token da service account, imagem `rhel9/mysql-80`) depende de teste em laboratório.
