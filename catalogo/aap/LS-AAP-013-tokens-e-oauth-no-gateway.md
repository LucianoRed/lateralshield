---
id: LS-AAP-013
titulo: Autenticar integrações com OAuth ou PAT do gateway
tecnologia: aap
pilar: prevenir
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.5 ou superior
status: rascunho
---

# LS-AAP-013 — Autenticar integrações com OAuth ou PAT do gateway

## Problema

Pipelines, portais e scripts costumam falar com o AAP usando usuário e senha de administrador (basic auth) ou tokens criados ainda no automation controller da 2.4. Tokens antigos do gateway e do controller chegaram a valer por mil anos; mesmo depois da correção que reduziu o padrão para um ano, esses tokens já emitidos mantêm a validade longa até serem revogados.

Quem obtém essa senha ou esse token — em repositório, variável de CI, backup ou estação — executa automação com o privilégio da conta, sem MFA e sem passar pelo ciclo de vida do IdP. É um caminho permanente para a plataforma que controla os servidores.

## Benefício

Cada integração passa a ter um token próprio, criado no Platform Gateway, com escopo mínimo e dono definido. A senha de administrador deixa de circular em scripts, e tokens legados de componente ou de validade milenar deixam de abrir a API.

Revogar o acesso de uma ferramenta vira revogar um token ou uma aplicação OAuth, sem trocar a senha do `admin` nem derrubar as demais integrações.

## Pré-requisitos

- Platform Gateway acessível; preferência por entrada única ([LS-AAP-012](LS-AAP-012-entrada-somente-pelo-gateway.md)).
- IdP ou contas nominais já em uso ([LS-AAP-008](LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md)); contas de emergência reservadas ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md)).
- Inventário das integrações que hoje chamam a API (CI/CD, ITSM, scripts de operação).
- Decisão sobre permitir ou não que usuários autenticados por IdP externo criem tokens OAuth2 (a plataforma bloqueia isso por padrão).

## Avaliação

**1. Basic auth do gateway.** Em **Settings > Platform gateway**, confira se **Gateway basic auth enabled** está ativo. Se estiver, qualquer cliente ainda pode autenticar com usuário e senha na API do gateway.

**2. Listar tokens e aplicações OAuth** em **Access Management > OAuth Applications** e, por usuário, na aba **Tokens**. Pela API do gateway (ajuste o token de avaliação):

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/gateway/v1/tokens/?page_size=200" \
  | jq -r '.results[] | [.id, .user, .application, .scope, .expires] | @tsv'
```

**3. Procurar senhas e tokens em claro** em repositórios de automação, variáveis de CI e inventários (sem imprimir o segredo no terminal compartilhado).

Indicadores de exposição:

- Scripts com usuário `admin` (ou outro administrador) e senha via basic auth.
- Tokens com data de expiração da ordem de séculos ou criados antes do patch que reduziu o padrão para um ano (documentação: tokens anteriores a esse patch no gateway/controller 2.4 mantêm validade de mil anos).
- Token de conta com System Administrator usado por várias ferramentas.
- Aplicações OAuth sem responsável conhecido.

## Implementação

**1. Criar uma aplicação OAuth por sistema externo** (quando vários tokens da mesma ferramenta devam ser geridos juntos) em **Access Management > OAuth Applications**. Para um script de uma pessoa ou de um pipeline único, um Personal Access Token (PAT) sem aplicação associada pode bastar.

**2. Emitir o token com o menor escopo.** Use `Read` quando a integração só consulta; `Write` só quando cria ou altera recursos. Associe o token a um usuário de serviço com papéis mínimos na organização — não ao administrador da plataforma.

**3. Guardar o token no cofre da integração** (credencial do CI, secret do pipeline). O valor só aparece na criação; trate perda como revogação e recriação.

**4. Ajustar a validade.** O padrão atual de access token é de um ano (`OAUTH2_PROVIDER__ACCESS_TOKEN_EXPIRE_SECONDS = 31536000`). Para tokens de usuários externos habilitados a criá-los, a documentação recomenda janelas bem menores (por exemplo, oito horas). Documente a rotação antes do vencimento.

**5. Substituir as integrações** uma a uma: troque a URL para o gateway, autentique com `Authorization: Bearer` e valide. Só então remova usuário/senha do script.

**6. Revogar o que sobrou.** Tokens legados e PATs sem dono:

```bash
aap-gateway-manage revoke_oauth2_tokens --user <usuario-de-servico>
# ou, com cuidado em manutenção planejada:
# aap-gateway-manage revoke_oauth2_tokens --revoke_refresh
```

**7. Desligar a basic auth do gateway** somente depois que IdP (ou outro autenticador) e os tokens das integrações estiverem validados. Em **Settings > Platform gateway**, desative **Gateway basic auth enabled**. Desligar com autenticação só local bloqueia a UI.

**8. Usuários vindos do IdP.** Por padrão eles não criam tokens OAuth2. Se for necessário habilitar **Allow external users to create OAuth2 tokens**, aplique na mesma hora as compensações da documentação: validade curta, RBAC restrito, revogação no offboarding e auditoria no activity stream.

## Validação

- Cada integração crítica autentica com Bearer token do gateway e executa só o que o escopo permite.
- Tentativa de basic auth com a senha antiga do administrador falha, se a basic auth foi desabilitada.
- A listagem de tokens não mostra expiração na ordem de mil anos para tokens ainda em uso.
- Revogar o token de um laboratório derruba só aquela integração.

## Reversão

- Reative **Gateway basic auth enabled** se a UI ou uma integração legítima depender dela — é medida temporária, não o estado desejado.
- Recrie o token ou a aplicação OAuth; o valor anterior não pode ser recuperado.
- Tokens revogados em massa com `revoke_oauth2_tokens` exigem reemissão para cada cliente.

## Impacto operacional

- Toda integração precisa de dono e de data de rotação; token sem inventário vira o próximo esquecimento.
- Habilitar criação de tokens para usuários do IdP sem offboarding que revogue tokens deixa acesso ativo depois que a conta no IdP morreu: o ciclo de vida do token é da plataforma, não do IdP.
- Alterar a chave JWT do gateway invalida sessões até a recomposição; não misture essa rotação com a troca rotineira de PATs.

## Detecção

Encaminhe o activity stream do gateway e do controller ao agregador ([LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md)) e alerte sobre:

- criação de token ou de aplicação OAuth;
- reativação de **Gateway basic auth enabled**;
- autenticação basic auth com contas administrativas, se a basic auth ainda estiver ligada em transição;
- uso de token depois da data de rotação combinada ou por usuário desligado no IdP.

## Referências

- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (Configuring access to external applications with token-based authentication; Applications; Adding tokens; revoke_oauth2_tokens; Manage OAuth2 token creation for external users).
- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (Configuring platform security — **Gateway basic auth enabled** e **Gateway access token expiration**).
- Documentação do Ansible Automation Platform 2.5: *Operating Ansible Automation Platform* (`settings.py`, incluindo `OAUTH2_PROVIDER__ACCESS_TOKEN_EXPIRE_SECONDS`).
