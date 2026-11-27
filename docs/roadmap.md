# Roadmap

O roadmap segue o escopo do projeto: OpenShift, RHEL, JBoss EAP e Ansible Automation Platform. A ordem dentro de cada fase reflete a prioridade 80/20.

## Fase 0 — Fundação (atual)

- [x] Missão, princípios e escopo documentados.
- [x] Metodologia, modelo de ameaça e modelo de controle.
- [x] Primeiros dez controles em `rascunho`, cobrindo as quatro tecnologias e os três pilares.
- [x] Lista prioritária de OpenShift, RHEL e Ansible Automation Platform escrita: mais 30 controles em `rascunho`, 40 no total.
- [x] Segunda leva do AAP (gateway, tokens, segredos em playbooks, TLS no PostgreSQL, assinatura no hub): 45 controles em `rascunho` no total.
- [x] Validação automática do catálogo e geração do índice.
- [x] Primeira automação Ansible: avaliação de RHEL/JBoss e OpenShift, aplicação do LS-JBOSS-002.
- [ ] Validar em laboratório os 45 controles e promovê-los a `validado`, registrando versões testadas.

## Fase 1 — Controles de prioridade 1

Controles candidatos, ainda não escritos. Os candidatos que já viraram controle saíram desta lista e estão no [índice do catálogo](../catalogo/INDICE.md).

### OpenShift

| Candidato | Pilar |
|---|---|
| Revisar o grupo `self-provisioner` | Prevenir |
| Não guardar segredos em MachineConfig | Prevenir |
| Restringir o acesso à API e ao console a redes administrativas | Prevenir |
| Encaminhar os logs de aplicações e de infraestrutura do cluster (ClusterLogForwarder) | Detectar |
| Aprovação de CSRs de nós: revisar aprovações automáticas e alertar sobre CSRs inesperados | Detectar |

### RHEL

| Candidato | Pilar |
|---|---|
| Filtro de saída no host para serviços que não precisam iniciar conexões | Conter |
| Inventário e remoção de chaves SSH privadas em servidores | Conter |
| Senhas locais únicas por servidor e HBAC com Identity Management | Conter |
| Auditoria de conexões SSH de servidor para servidor | Detectar |
| Arquivos e credenciais isca (canários) | Detectar |

### JBoss EAP

| Candidato | Pilar |
|---|---|
| Filtro global de desserialização (`jdk.serialFilter`) em JDKs que o suportam | Prevenir |
| Remoção de consoles e invocadores do EAP 5 (`jmx-console`, `web-console`, `JMXInvokerServlet`) | Prevenir |
| Senhas de datasource fora do texto claro (vault / credential store) e usuário de banco com privilégio mínimo | Conter |
| Isolamento do serviço com systemd (`NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`, `ProtectHome`) | Conter |
| Autenticação e criptografia do cluster JGroups | Conter |
| Proxy reverso à frente do EAP legado com filtragem de requisições | Prevenir |

### Ansible Automation Platform

| Candidato | Pilar |
|---|---|
| HTTPS e HSTS com certificados de CA nos componentes (não autoassinados do instalador) | Prevenir |
| RBAC por organização e equipe com papéis mínimos por persona | Prevenir |
| Credenciais do Event-Driven Ansible fora de `extra_vars` | Conter |

## Fase 2 — Automação

- Role Ansible de avaliação por controle, com saída consolidada em relatório único.
- Roles de aplicação com modo de observação e reversão para cada controle `validado`.
- Empacotamento como coleção Ansible e exemplos de job templates para o AAP.
- Execução periódica da avaliação para detectar regressão de configuração.

## Fase 3 — Expansão

- Mapeamento dos controles para técnicas MITRE ATT&CK de movimentação lateral.
- Avaliação de outras tecnologias Red Hat conforme demanda e contribuições (por exemplo: Identity Management, Satellite, Red Hat build of Keycloak, AMQ, Data Grid).
- Relatos de campo anonimizados: o que funcionou, o que quebrou.

## Como influenciar o roadmap

Abra uma issue descrevendo o caminho de movimentação lateral observado e a tecnologia envolvida. Propostas com avaliação e reversão já esboçadas têm prioridade.
