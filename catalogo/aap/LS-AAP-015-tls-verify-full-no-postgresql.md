---
id: LS-AAP-015
titulo: Exigir TLS verify-full nas conexões com o PostgreSQL
tecnologia: aap
pilar: conter
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.5 ou superior, instalação RPM e em contêiner
status: rascunho
---

# LS-AAP-015 — Exigir TLS verify-full nas conexões com o PostgreSQL

## Problema

O banco PostgreSQL do AAP guarda as credenciais de automação cifradas, a `SECRET_KEY` relacionada ao material criptográfico da plataforma e os registros de atividade. Por padrão, os componentes podem tentar conexão cifrada sem exigir verificação completa do certificado do servidor — e, na instalação RPM, o SSL no Postgres gerenciado pelo instalador chega desligado (`postgres_use_ssl` com padrão `false`).

Na mesma rede dos nós ([LS-AAP-010](LS-AAP-010-segmentacao-de-rede-dos-nos.md) mitiga, mas não elimina o risco), um host capaz de interceptar ou desviar o tráfego para a porta 5432 pode apresentar um banco falso, coletar credenciais de conexão ou enfraquecer a hipótese de que o canal até o banco é confiável. Quem controla o caminho até o PostgreSQL está a um passo do material que decifra o restante.

## Benefício

Gateway, controller, hub e Event-Driven Ansible só falam com o PostgreSQL autenticando o certificado do servidor (e, quando configurado, com certificado de cliente). Um serviço na rede que se passa pelo banco sem o certificado certo deixa de ser aceito.

A operação ganha um baseline explícito no inventário de instalação: upgrades reaplicam TLS em vez de reabrir conexão sem verificação.

## Pré-requisitos

- Inventário de instalação versionado, com as senhas em Ansible Vault ([LS-AAP-006](LS-AAP-006-senhas-do-instalador-em-vault.md)).
- CA e certificados do PostgreSQL (e, se for usar mTLS com certificado de cliente, um par por componente, como na documentação de instalação).
- Janela para rerodar o instalador ou reconfigurar o banco externo equivalente.
- Se o banco for de terceiros, ele precisa aceitar TLS (e mTLS, se for o modo escolhido) **antes** de apontar os componentes com `verify-full`.

## Avaliação

**1. Inventário de instalação.** Confira as variáveis de segurança do banco.

Instalação RPM — valores recomendados pela documentação de hardening:

```text
postgres_use_ssl=true
pg_sslmode=verify-full
automation_gateway_pg_sslmode=verify-full
automationcontroller_pg_sslmode=verify-full
automationhub_pg_sslmode=verify-full
automationedacontroller_pg_sslmode=verify-full
```

Instalação em contêiner — valores recomendados:

```text
postgresql_disable_tls=false
gateway_pg_sslmode=verify-full
controller_pg_sslmode=verify-full
hub_pg_sslmode=verify-full
eda_pg_sslmode=verify-full
```

Ausência de `postgres_use_ssl=true` (RPM) ou presença de `postgresql_disable_tls=true` (contêiner), e `sslmode` diferente de `verify-full` / `verify-ca` onde a política exige verificação, são **exposição**.

**2. No servidor PostgreSQL**, confira se aceita só conexões SSL e qual é o certificado apresentado (ferramentas do próprio Postgres ou inspeção da configuração gerenciada pelo instalador). Não use um cliente qualquer da rede de aplicação: a porta 5432 não deve estar aberta para ela ([LS-AAP-010](LS-AAP-010-segmentacao-de-rede-dos-nos.md)).

**3. Nos nós dos componentes**, inspecione a configuração de banco efetiva após a instalação (arquivos gerados pelo instalador) e confirme `sslmode` e caminhos de certificado — os caminhos exatos variam entre RPM, contêiner e operador; use o que a versão documentar.

## Implementação

**1. Preparar certificados.** Para o banco gerenciado pelo instalador, siga o guia da topologia (RPM ou contêiner) para habilitar SSL e confiar na CA. Para mTLS com certificado de cliente, a documentação de instalação RPM exemplifica variáveis por componente, cada uma com certificado e chave distintos, por exemplo:

```text
pgclient_sslcert=/caminho/para/awx.cert
pgclient_sslkey=/caminho/para/awx.key
pg_sslmode=verify-full

automationgateway_pgclient_sslcert=/caminho/para/gateway.cert
automationgateway_pgclient_sslkey=/caminho/para/gateway.key
automationgateway_pg_sslmode=verify-full
```

Repita o padrão para hub (`automationhub_*`) e Event-Driven Ansible (`automationedacontroller_*`). Na instalação em contêiner, use os nomes `*_pg_sslmode` e certificados equivalentes do inventário de contêineres.

**2. Ajustar o inventário** com os valores da avaliação (`postgres_use_ssl=true` ou `postgresql_disable_tls=false`, e `verify-full` em todos os componentes presentes na topologia).

**3. Executar o instalador** (ou o procedimento de reconfiguração documentado) a partir do host de instalação. Em banco externo, configure SSL/mTLS no provedor e só então altere o inventário e reconfigure os componentes.

**4. Segmentação.** Mesmo com TLS, mantenha a 5432 restrita aos nós da plataforma ([LS-AAP-010](LS-AAP-010-segmentacao-de-rede-dos-nos.md)).

## Validação

- Os componentes sobem e a interface do gateway responde.
- Um job de teste e uma operação no hub (por exemplo, listar collections) funcionam.
- O inventário aplicado mostra `verify-full` (ou o modo acordado) em todos os componentes.
- Em teste controlado com certificado de servidor incorreto (laboratório), a conexão do componente ao banco falha.

## Reversão

Restaure as variáveis anteriores no inventário (por exemplo `postgres_use_ssl=false` ou `pg_sslmode` mais permissivo) e rode de novo o instalador. Tenha a senha do Vault e o inventário anterior à mão ([LS-AAP-006](LS-AAP-006-senhas-do-instalador-em-vault.md)). A reversão reabre o risco que este controle remove.

## Impacto operacional

- Certificados do banco e dos clientes precisam entrar no ciclo de renovação; expiração derruba gateway, controller, hub e EDA juntos.
- Banco externo exige alinhamento com o time dono da instância PostgreSQL antes do corte.
- Troca de CA ou de SAN sem atualizar truststores dos nós quebra o `verify-full` de propósito — ensaiar a renovação em homologação.

## Detecção

- Falhas seguidas de conexão SSL/TLS ao PostgreSQL nos logs dos componentes e do banco: certificado expirado, nome errado ou alguém no meio do caminho. Encaminhe os logs dos nós ao destino central ([LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md)).
- Drift no inventário: `postgres_use_ssl` ou `*_pg_sslmode` alterados em pull request ou em rerun do instalador.
- Tentativas na 5432 de fora da rede da plataforma ([LS-AAP-010](LS-AAP-010-segmentacao-de-rede-dos-nos.md)).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Hardening and compliance* (Security-relevant variables in the installation inventory — `postgres_use_ssl`, `postgresql_disable_tls`, `*_pg_sslmode=verify-full`).
- Documentação do Ansible Automation Platform 2.5: *RPM installation* (PostgreSQL requirements — Enabling mutual TLS (mTLS) authentication; Inventory file variables).
- Documentação do Ansible Automation Platform 2.5: *Containerized installation* (Inventory file variables — `postgresql_disable_tls`, `*_pg_sslmode`).
