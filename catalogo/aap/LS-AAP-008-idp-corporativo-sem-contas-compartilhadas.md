---
id: LS-AAP-008
titulo: Autenticar pelo IdP corporativo, sem contas locais compartilhadas
tecnologia: aap
pilar: prevenir
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.4 (por componente) e 2.5 ou superior (platform gateway)
status: rascunho
---

# LS-AAP-008 — Autenticar pelo IdP corporativo, sem contas locais compartilhadas

## Problema

Contas locais do AAP têm vida própria: não seguem a política de senhas da empresa, não são desativadas quando a pessoa sai e não passam pelo segundo fator. Quando, além disso, são compartilhadas — o `admin` que o time inteiro conhece, o usuário `operador` usado por três turnos —, a senha circula em mensagens e planilhas, e o registro de quem fez o quê deixa de existir.

Para um invasor, uma conta compartilhada é o alvo ideal: a senha está em muitos lugares, o uso fora do padrão não chama atenção e nenhum registro aponta para uma pessoa. E essa conta dá acesso a uma plataforma que executa comandos em quase todos os servidores.

## Benefício

O acesso ao AAP passa a seguir o ciclo de vida da identidade corporativa: quem sai da empresa ou muda de função perde o acesso no mesmo momento, e a política de senha e o segundo fator ([LS-AAP-002](LS-AAP-002-mfa-no-provedor-de-identidade.md)) valem para todos.

Cada ação na plataforma passa a ter um autor identificável. Em uma investigação, o activity stream aponta para uma pessoa, e não para uma conta que dez pessoas usam.

## Pré-requisitos

- Um provedor de identidade corporativo com os grupos que representam os times. Red Hat build of Keycloak e Identity Management são exemplos.
- Conta de emergência definida ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md)), **antes** de qualquer mudança na autenticação.
- Levantamento de quem usa cada conta local hoje, incluindo integrações.

## Avaliação

No automation controller 2.4:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/users/?page_size=200" \
  | jq -r '.results[] | [.username, (.external_account // "local"), (.ldap_dn // ""), (.last_login // "nunca")] | @tsv'
```

No AAP 2.5 ou superior, use **Access Management > Users** e **Access Management > Authentication Methods**. Os usuários ficam na API do gateway (`/api/gateway/v1/users/`).

Indicadores de exposição:

- Nenhum método de autenticação externo configurado.
- Contas locais com nome genérico (`operador`, `suporte`, `ansible`, `deploy`) e login recente.
- A conta `admin` com uso frequente.
- Contas locais de pessoas que já não fazem parte do time.

## Implementação

**1. Configurar o método de autenticação externo.** No AAP 2.5 ou superior, em **Access Management > Authentication Methods**. Os tipos documentados incluem LDAP, SAML, OIDC genérico, Keycloak, RADIUS e TACACS+, além do método local. Prefira SAML ou OIDC, em que o login acontece na página do provedor de identidade. Use sempre transporte cifrado (LDAPS ou LDAP com TLS; HTTPS para SAML e OIDC).

No AAP 2.4, a autenticação é configurada em cada componente: no automation controller em **Settings > Authentication**; para o private automation hub, o guia de hardening indica LDAP; o Event-Driven Ansible controller aceita apenas contas locais.

**2. Definir quem entra e com qual acesso.** Use os mapeamentos do autenticador para permitir a entrada apenas de grupos específicos e para associar grupos do provedor de identidade a organizações e times do AAP. Não associe um grupo amplo ao tipo administrador.

**3. Conferir o que o provedor de identidade garante.** A documentação da versão 2.6 avisa que a plataforma aceita o e-mail informado pelo provedor sem verificá-lo e usa o e-mail para vincular identidades a contas. Antes de ativar o autenticador, confirme que o provedor verifica os endereços e não deixa o usuário trocá-los por conta própria.

**4. Migrar as pessoas.** Cada pessoa entra pela conta corporativa e recebe os papéis pelo time. Um usuário que entra por outro autenticador é um registro novo no AAP: os papéis da conta local antiga não acompanham e precisam ser concedidos de novo, de preferência ao time.

**5. Tratar as integrações.** Sistemas que chamam a API recebem uma conta de integração própria, uma por sistema, com papéis mínimos e token.

**6. Remover as contas locais compartilhadas.** Desative-as primeiro, observe por um período e só então apague. Mantenha apenas as contas de emergência. No AAP 2.6 ou superior, desativar o autenticador local bloqueia também o `admin`; não o desative se a conta de emergência for local.

## Validação

- Um usuário corporativo do grupo permitido entra e vê apenas os recursos do seu time.
- Um usuário corporativo fora dos grupos permitidos não entra.
- Um usuário desativado no provedor de identidade não consegue mais entrar.
- A lista de usuários locais contém somente as contas de emergência e as de integração documentadas.

## Reversão

Desative o método de autenticação externo e reative as contas locais. Enquanto as contas locais não forem apagadas, a volta é imediata; por isso a ordem do passo 6.

## Impacto operacional

- Com o provedor de identidade indisponível, só a conta de emergência entra. Os jobs agendados continuam rodando.
- Desativar o usuário no provedor de identidade impede novos logins, mas não revoga tokens de API já emitidos. Inclua a revisão de tokens no desligamento de pessoas.
- As contas de serviço usadas pela automação **nos hosts gerenciados** devem continuar locais, como recomenda o guia de hardening, para que os jobs não parem se o provedor de identidade cair.
- A migração exige refazer a concessão de papéis. É o principal trabalho deste controle.

## Detecção

- Login por conta local, criação de usuário local e alteração dos métodos de autenticação: os três devem ser raros depois da migração e merecem alerta.
- No provedor de identidade: tentativas de login no AAP por usuários fora dos grupos permitidos.

Os eventos do AAP chegam ao destino central por [LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md); encaminhe os do provedor de identidade para o mesmo lugar.

## Referências

- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (Configuring authentication in the Ansible Automation Platform; mapeamentos de autenticador).
- Documentação do Ansible Automation Platform: *Hardening and compliance* (2.5 e 2.6) e *Red Hat Ansible Automation Platform hardening guide* (2.4), seções sobre autenticação externa.
- Documentação do Ansible Automation Platform 2.4: *Automation controller administration guide* (configuração de autenticação).
