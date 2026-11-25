# Mission Control

Painel de avaliação do LateralShield: uma página única, com menu fixo à esquerda, que transforma o [catálogo](../catalogo/INDICE.md) e a [avaliação básica de processos](../docs/avaliacao-de-processos.md) em um checklist. Para cada controle e cada pergunta, registra-se a situação no ambiente, o responsável, o prazo e a evidência. No fim, sai um relatório em PDF e uma planilha Excel.

| Seção | Conteúdo |
|---|---|
| **Visão geral** | O nível de proteção, os marcos, gráficos por pilar, tecnologia e prioridade, a primeira verificação (logs centralizados), as perguntas de processo por onde começar e os próximos passos |
| **Topologia de ataque** | Desenho animado dos caminhos de movimentação lateral do [modelo de ameaça](../docs/modelo-de-ameaca.md): cada caminho aparece aberto, parcial ou mitigado conforme a situação dos seus controles |
| **Controles** | Os controles do catálogo, com filtros por tecnologia, pilar, prioridade e situação. Cada um abre com o problema, o benefício e os comandos de avaliação, que são somente leitura |
| **Matriz 80/20** | Impacto × esforço, com a cor de cada controle indicando a situação registrada |
| **Processos** | As perguntas de pessoas e processos, com resposta `sim`, `parcial` ou `não`. Sem nota e sem nível de maturidade |
| **Plano de ação** | Controles expostos ou em implantação e perguntas com resposta `não` ou `parcial`, com responsável, prazo e destaque para o que venceu |
| **Sala de crise** | O [guia de crise](../docs/guia-de-crise.md) como checklist marcável, com situação, responsável e registro por item, e o texto completo das [recomendações gerais para incidentes](../docs/recomendacoes-para-incidentes.md), sem sair da página |
| **Relatório e dados** | Relatório em PDF e Excel, cópia dos dados em JSON e troca de senha |

A situação registrada aqui é a do **ambiente avaliado**. Ela não muda o status do controle no catálogo, que continua `rascunho` até a validação em laboratório.

## Nível de proteção

A visão geral mostra um índice de 0 a 100 e um nível de 1 a 5, para acompanhar a evolução do ambiente e mostrar o que mais vale aplicar em seguida.

- O índice é a parcela dos controles aplicáveis que já está aplicada, com peso 3, 2 e 1 para as prioridades 1, 2 e 3 da matriz 80/20.
- Controle `não avaliado`, `exposto` ou `em implantação` conta como não aplicado. Controle marcado como `não se aplica` sai da conta.
- Os níveis começam em 0, 20, 40, 65 e 90 pontos: Inicial, Básico, Intermediário, Avançado e Consolidado. As faixas são uma convenção do painel, e não uma escala de mercado.
- As perguntas de processo **não entram** no índice e continuam sem nota.

O índice mede a cobertura do catálogo no ambiente, a partir do que foi registrado. **Não é certificação nem garantia de segurança**, e não aparece no relatório em PDF e Excel.

## Topologia de ataque

O desenho parte de cinco pontos de entrada já invadidos e mostra até onde o invasor chega. Cada linha da tabela "Como o catálogo responde" do [modelo de ameaça](../docs/modelo-de-ameaca.md) é um caminho:

| Situação do caminho | Quando |
|---|---|
| Mitigado, ou com alerta | Todos os controles aplicáveis do caminho estão aplicados |
| Parcial | Há controle aplicado ou em implantação, mas não todos |
| Aberto, ou sem alerta | Nenhum aplicado e ao menos um exposto |
| Não avaliado | Nenhum controle do caminho foi avaliado |

Um clique em um escudo ou em um sinal de detecção abre os controles do caminho, e a situação pode ser registrada ali mesmo. Os botões "Com a prioridade 1 aplicada" e seguintes simulam o resultado sem gravar nada.

O desenho reflete a situação registrada, e não um teste do ambiente: não há varredura nem verificação automática.

## Sala de crise

A seção tem duas abas. **Guia de crise** é o checklist: cada item recebe uma situação (`pendente`, `em andamento`, `feito` ou `não se aplica`), um responsável e um registro do que foi apurado ou feito. **Medidas de emergência** traz as recomendações completas, com quando usar, o que fazer, cuidados e como desfazer.

- "Imprimir o registro" gera o registro da crise pela impressão do navegador, que também salva em PDF. Na instalação com servidor, a planilha Excel traz a aba `Guia de crise`. O relatório em PDF do servidor cobre só a avaliação do ambiente.
- "Zerar para um novo incidente" limpa a situação e os registros do guia. Imprima ou exporte antes.
- O guia guarda um incidente por vez.
- **Use o guia fora do ambiente afetado.** Se o cluster onde o Mission Control está instalado faz parte do incidente, abra `web/index.html` em uma estação fora dele, ou use o guia impresso.

## Três formas de usar

### 1. Abrir o arquivo no navegador

Abra [web/index.html](web/index.html). Não há build nem servidor. As respostas ficam guardadas **só naquele navegador**. O relatório sai pela impressão do navegador ("Salvar como PDF") e a planilha em CSV. O arquivo JSON exportado pode ser importado depois em uma instalação com servidor.

### 2. Instalar no OpenShift

```bash
oc new-project lateralshield
oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/mission-control/openshift/mission-control.yaml
oc get route mission-control -n lateralshield
```

Ou, a partir de uma cópia do repositório, troque o endereço por `mission-control/openshift/mission-control.yaml`.

O `oc new-project` cria o projeto `lateralshield`, e o manifesto cria dentro dele:

- a aplicação, na imagem `ubi9/php-82`, **sem etapa de build**: a página e o código chegam por ConfigMaps;
- um MySQL (`rhel9/mysql-80`) com volume persistente de 1 Gi;
- uma rota somente HTTPS;
- NetworkPolicies no padrão do [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md): entrada negada por padrão, liberada do roteador de ingress para a aplicação e da aplicação para o banco.

Pré-requisitos:

- permissão para criar projetos (`oc new-project`). Se o projeto `lateralshield` já existir, basta ser administrador dele;
- uma StorageClass padrão;
- acesso do cluster a `registry.redhat.io` e a `registry.access.redhat.com`. Em clusters desconectados, espelhe as duas imagens e ajuste os campos `image`.

O nome do projeto está fixo no manifesto. Para outro nome, ou para trocar a senha do banco antes de instalar, edite [openshift/base.yaml](openshift/base.yaml) e o nome do namespace dos ConfigMaps em `scripts/mission_control.py`, e regenere o manifesto (veja [Manutenção](#manutenção)).

#### Atualizar uma instalação

Aplique o manifesto de novo e reinicie a aplicação:

```bash
oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/mission-control/openshift/mission-control.yaml
oc rollout restart deploy/mission-control -n lateralshield
oc rollout status deploy/mission-control -n lateralshield
```

- As respostas ficam no banco e não são afetadas. Só o Deployment `mission-control` reinicia: o MySQL, o volume e a senha do `admin` continuam como estavam.
- A página e o código chegam por ConfigMaps, que o pod relê sozinho em cerca de um minuto. O reinício garante que a versão nova entre de imediato.
- Para aplicar uma versão que ainda não está na `main` do GitHub, use o arquivo de uma cópia do repositório: `oc apply -f mission-control/openshift/mission-control.yaml`.
- Depois, recarregue a página no navegador.

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
| Excel (`.xlsx`) | Planilhas `Resumo`, `Plano de ação`, `Controles`, `Processos` e `Guia de crise`, com filtro e cabeçalho fixo |
| JSON | Cópia das respostas, para guardar ou levar a outra instalação. Importar substitui as respostas atuais |

O relatório mostra onde o ambiente é mais frágil. **Guarde-o com acesso restrito** e não o versione com dados reais.

## Cuidados

- A instalação padrão usa senhas conhecidas: a do `admin`, trocada no primeiro acesso, e a do banco, que só é alcançável pelo pod da aplicação. Em ambiente compartilhado, troque a do banco antes de instalar.
- Há um único usuário, e todas as pessoas com a senha veem e alteram tudo.
- `oc delete -f` com o manifesto remove a aplicação e o volume do banco, e `oc delete project lateralshield` remove tudo. Exporte o JSON antes.

## Manutenção

Dois arquivos são **gerados** e não devem ser editados à mão:

| Arquivo | Gerado a partir de |
|---|---|
| `web/data.js` | `catalogo/`, `docs/avaliacao-de-processos.md`, `docs/guia-de-crise.md`, `docs/recomendacoes-para-incidentes.md`, a tabela de logs de `docs/metodologia.md` e a tabela de caminhos de `docs/modelo-de-ameaca.md` |
| `openshift/mission-control.yaml` | `openshift/base.yaml` e os arquivos de `web/` |

```bash
python3 scripts/mission_control.py           # regenera os dois
python3 scripts/mission_control.py --check   # falha se estiverem desatualizados (usado no CI)
```

Rode o script sempre que um controle, uma pergunta ou um arquivo de `web/` mudar. Para levar a mudança a uma instalação, veja [Atualizar uma instalação](#atualizar-uma-instalação).

| Arquivo | Papel |
|---|---|
| `web/index.html` | A página. Funciona sozinha, com `data.js` |
| `web/index.php` | Autenticação, API e roteamento. Todas as requisições passam por ele |
| `web/relatorio.php` | Geração do PDF e da planilha, sem bibliotecas externas |
| `web/.htaccess` | Encaminha tudo para o `index.php` |
| `openshift/base.yaml` | Secrets, MySQL, Deployment, Service, Route e NetworkPolicies |
| `Containerfile` | Imagem única, para uso fora do OpenShift |

Os caminhos da topologia vêm do modelo de ameaça, mas a posição de cada um no desenho fica em `TOPO`, no `web/index.html`: cada linha da tabela é ligada a uma aresta ou a um sinal por um dos seus controles. Uma linha nova que não for incluída em `TOPO` aparece na tabela de caminhos e nas contagens, mas não no desenho.

Para desenvolver sem contêiner: `cd mission-control/web && php -S 127.0.0.1:8080 index.php` (usa SQLite em um arquivo temporário).

## Estado

Testado em contêineres locais, com a imagem `ubi9/php-82` e um MySQL 8.0, simulando o usuário sem privilégio do OpenShift: autenticação, troca de senha, gravação, relatórios e importação. O MySQL do teste foi a imagem comunitária equivalente (`quay.io/sclorg/mysql-80-c9s`), e não a `rhel9/mysql-80` do manifesto.

O nível de proteção, os gráficos, a topologia e a sala de crise foram conferidos no Chrome, em modo local; a gravação dos itens do guia e a planilha foram testadas com o servidor PHP local e SQLite. Não foram conferidos em Firefox nem em Safari.

**O manifesto ainda não foi aplicado em um cluster OpenShift.** Rota, NetworkPolicies, volume persistente e a leitura dos ConfigMaps pelo pod dependem de teste em laboratório.
