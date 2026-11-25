# Mission Control

Painel de avaliação do LateralShield: uma página única, com menu fixo à esquerda, que transforma o [catálogo](../catalogo/INDICE.md) e a [avaliação básica de processos](../docs/avaliacao-de-processos.md) em um checklist. Para cada controle e cada pergunta, registra-se a situação no ambiente, o responsável, o prazo e a evidência. No fim, sai um relatório em PDF e uma planilha Excel.

| Seção | Conteúdo |
|---|---|
| **Visão geral** | Dados da avaliação, contagens, a primeira verificação (logs centralizados), as perguntas de processo por onde começar e os próximos passos |
| **Controles** | Os controles do catálogo, com filtros por tecnologia, pilar, prioridade e situação. Cada um abre com o problema, o benefício e os comandos de avaliação, que são somente leitura |
| **Matriz 80/20** | Impacto × esforço, com a cor de cada controle indicando a situação registrada |
| **Processos** | As perguntas de pessoas e processos, com resposta `sim`, `parcial` ou `não`. Sem nota e sem nível de maturidade |
| **Plano de ação** | Controles expostos ou em implantação e perguntas com resposta `não` ou `parcial`, com responsável, prazo e destaque para o que venceu |
| **Incidentes** | Resumo das [recomendações gerais para incidentes](../docs/recomendacoes-para-incidentes.md) |
| **Relatório e dados** | Relatório em PDF e Excel, cópia dos dados em JSON e troca de senha |

A situação registrada aqui é a do **ambiente avaliado**. Ela não muda o status do controle no catálogo, que continua `rascunho` até a validação em laboratório.

## Três formas de usar

### 1. Abrir o arquivo no navegador

Abra [web/index.html](web/index.html). Não há build nem servidor. As respostas ficam guardadas **só naquele navegador**. O relatório sai pela impressão do navegador ("Salvar como PDF") e a planilha em CSV. O arquivo JSON exportado pode ser importado depois em uma instalação com servidor.

### 2. Instalar no OpenShift

```bash
oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/mission-control/openshift/mission-control.yaml
oc get route mission-control -n lateralshield
```

Ou, a partir de uma cópia do repositório: `oc apply -f mission-control/openshift/mission-control.yaml`.

O manifesto cria, no namespace `lateralshield`:

- a aplicação, na imagem `ubi9/php-82`, **sem etapa de build**: a página e o código chegam por ConfigMaps;
- um MySQL (`rhel9/mysql-80`) com volume persistente de 1 Gi;
- uma rota somente HTTPS;
- NetworkPolicies no padrão do [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md): entrada negada por padrão, liberada do roteador de ingress para a aplicação e da aplicação para o banco.

Pré-requisitos:

- permissão para criar namespaces;
- uma StorageClass padrão;
- acesso do cluster a `registry.redhat.io` e a `registry.access.redhat.com`. Em clusters desconectados, espelhe as duas imagens e ajuste os campos `image`.

Para outro namespace, ou para trocar a senha do banco antes de instalar, edite [openshift/base.yaml](openshift/base.yaml) e regenere o manifesto (veja [Manutenção](#manutenção)).

### 3. Executar em um contêiner

```bash
podman build -t lateralshield-mission-control mission-control/
podman run -d --name mission-control -p 8080:8080 \
  -v mission-control-dados:/dados lateralshield-mission-control
```

Nessa forma as respostas ficam em um arquivo SQLite no volume `/dados`. Para usar um MySQL externo, defina `MC_DB_HOST`, `MC_DB_PORT`, `MC_DB_NAME`, `MC_DB_USER` e `MC_DB_PASSWORD`. A autenticação Basic envia a senha a cada requisição: publique o contêiner atrás de HTTPS.

## Acesso

- Usuário inicial `admin`, senha inicial `redhat`.
- **A troca da senha é exigida no primeiro acesso.** Enquanto a senha inicial não for trocada, a aplicação não mostra nem grava respostas. A nova senha precisa ter pelo menos 10 caracteres.
- A senha fica no banco na forma de hash. A senha inicial do Secret `mission-control-admin` só vale na primeira execução.
- Depois da troca, o navegador pode pedir a senha de novo: informe a nova.

Para voltar à senha inicial quando ela for esquecida, apague o usuário no banco. Ele é recriado no acesso seguinte, e a troca volta a ser exigida. As respostas não são afetadas.

```bash
oc exec -n lateralshield deploy/mission-control-mysql -- /bin/sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" -h 127.0.0.1 "$MYSQL_DATABASE" -e "DELETE FROM mc_usuario"'
```

## Relatório

| Formato | Conteúdo |
|---|---|
| PDF | Dados da avaliação, resumo por tecnologia, primeira verificação, plano de ação, controles por tecnologia e perguntas de processo |
| Excel (`.xlsx`) | Planilhas `Resumo`, `Plano de ação`, `Controles` e `Processos`, com filtro e cabeçalho fixo |
| JSON | Cópia das respostas, para guardar ou levar a outra instalação. Importar substitui as respostas atuais |

O relatório mostra onde o ambiente é mais frágil. **Guarde-o com acesso restrito** e não o versione com dados reais.

## Cuidados

- A instalação padrão usa senhas conhecidas: a do `admin`, trocada no primeiro acesso, e a do banco, que só é alcançável pelo pod da aplicação. Em ambiente compartilhado, troque a do banco antes de instalar.
- Há um único usuário, e todas as pessoas com a senha veem e alteram tudo.
- `oc delete -f` com o manifesto remove o namespace e o volume do banco. Exporte o JSON antes.

## Manutenção

Dois arquivos são **gerados** e não devem ser editados à mão:

| Arquivo | Gerado a partir de |
|---|---|
| `web/data.js` | `catalogo/`, `docs/avaliacao-de-processos.md`, `docs/recomendacoes-para-incidentes.md` e a tabela de logs de `docs/metodologia.md` |
| `openshift/mission-control.yaml` | `openshift/base.yaml` e os arquivos de `web/` |

```bash
python3 scripts/mission_control.py           # regenera os dois
python3 scripts/mission_control.py --check   # falha se estiverem desatualizados (usado no CI)
```

Rode o script sempre que um controle, uma pergunta ou um arquivo de `web/` mudar. Para atualizar uma instalação, aplique o manifesto de novo. Os ConfigMaps são relidos pelo pod em cerca de um minuto; se a página não mudar, execute `oc rollout restart deploy/mission-control -n lateralshield`.

| Arquivo | Papel |
|---|---|
| `web/index.html` | A página. Funciona sozinha, com `data.js` |
| `web/index.php` | Autenticação, API e roteamento. Todas as requisições passam por ele |
| `web/relatorio.php` | Geração do PDF e da planilha, sem bibliotecas externas |
| `web/.htaccess` | Encaminha tudo para o `index.php` |
| `openshift/base.yaml` | Namespace, Secrets, MySQL, Deployment, Service, Route e NetworkPolicies |
| `Containerfile` | Imagem única, para uso fora do OpenShift |

Para desenvolver sem contêiner: `cd mission-control/web && php -S 127.0.0.1:8080 index.php` (usa SQLite em um arquivo temporário).

## Estado

Testado em contêineres locais, com a imagem `ubi9/php-82` e um MySQL 8.0, simulando o usuário sem privilégio do OpenShift: autenticação, troca de senha, gravação, relatórios e importação. O MySQL do teste foi a imagem comunitária equivalente (`quay.io/sclorg/mysql-80-c9s`), e não a `rhel9/mysql-80` do manifesto.

**O manifesto ainda não foi aplicado em um cluster OpenShift.** Rota, NetworkPolicies, volume persistente e a leitura dos ConfigMaps pelo pod dependem de teste em laboratório.
