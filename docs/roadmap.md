# Roadmap

O roadmap segue o escopo do projeto: OpenShift, RHEL, JBoss EAP e Ansible Automation Platform. A ordem dentro de cada fase reflete a prioridade 80/20.

## Fase 0 — Fundação (atual)

- [x] Missão, princípios e escopo documentados.
- [x] Metodologia, modelo de ameaça e modelo de controle.
- [x] Primeiros dez controles em `rascunho`, cobrindo as quatro tecnologias e os três pilares.
- [x] Validação automática do catálogo e geração do índice.
- [x] Primeira automação Ansible: avaliação de RHEL/JBoss e OpenShift, aplicação do LS-JBOSS-002.
- [ ] Validar em laboratório os dez controles e promovê-los a `validado`, registrando versões testadas.

## Fase 1 — Controles de prioridade 1

Controles candidatos, ainda não escritos.

### OpenShift

| Candidato | Pilar |
|---|---|
| Bloquear acesso de pods à rede dos nós e a metadados de nuvem (EgressFirewall / AdminNetworkPolicy) | Conter |
| Remover `kubeadmin`, revisar `cluster-admin` e o grupo `self-provisioner` | Prevenir |
| Desativar a montagem automática do token de service account onde não é usada | Conter |
| Auditar workloads com SCC privilegiada, `hostNetwork`, `hostPath` e `hostPID` | Conter |
| Não guardar segredos em MachineConfig | Prevenir |
| Restringir o acesso à API e ao console a redes administrativas | Prevenir |
| Encaminhar os logs do cluster (ClusterLogForwarder) e o log de auditoria da API, e alertar sobre ações sensíveis (`exec`, leitura de secrets, novos `ClusterRoleBinding`) | Detectar |
| Aprovação de CSRs de nós: revisar aprovações automáticas e alertar sobre CSRs inesperados | Detectar |

### RHEL

| Candidato | Pilar |
|---|---|
| Filtro de saída no host para serviços que não precisam iniciar conexões | Conter |
| Inventário e remoção de chaves SSH privadas em servidores | Conter |
| `sudo` de escopo mínimo para contas de serviço | Conter |
| Senhas locais únicas por servidor e HBAC com Identity Management | Conter |
| SELinux em modo `enforcing` com verificação do domínio dos serviços expostos | Conter |
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
| Tratar o AAP como ativo de nível zero: rede administrativa, autenticação externa com MFA, sem contas locais compartilhadas | Prevenir |
| Credenciais separadas por ambiente e por inventário | Conter |
| Restringir as portas da malha de automação (receptor) aos nós da malha | Conter |
| Enviar o fluxo de atividades e os logs de jobs para agregador externo | Detectar |

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
