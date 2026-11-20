# Índice do catálogo

<!-- Gerado por scripts/catalogo.py. Não edite manualmente. -->

Controles do LateralShield para tecnologias Red Hat. A prioridade segue o filtro 80/20 da [metodologia](../docs/metodologia.md).

## Red Hat OpenShift

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-OCP-001](openshift/LS-OCP-001-machine-config-server.md) | Restringir o acesso ao Machine Config Server | conter | alto | baixo | 1 | rascunho |
| [LS-OCP-002](openshift/LS-OCP-002-networkpolicy-negacao-padrao.md) | Aplicar NetworkPolicy de negação padrão nos namespaces de aplicação | conter | alto | medio | 2 | rascunho |
| [LS-OCP-003](openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) | Enviar o log de acesso do ingress para um syslog central | detectar | alto | baixo | 1 | rascunho |

## Red Hat Enterprise Linux

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-RHEL-001](rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) | Aceitar SSH somente de origens administrativas | conter | alto | baixo | 1 | rascunho |
| [LS-RHEL-002](rhel/LS-RHEL-002-syslog-central.md) | Encaminhar os logs do sistema para um syslog central | detectar | alto | baixo | 1 | rascunho |

## Red Hat JBoss EAP

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-JBOSS-001](jboss-eap/LS-JBOSS-001-interfaces-de-gerenciamento.md) | Fechar as interfaces de gerenciamento do JBoss EAP para a rede | prevenir | alto | baixo | 1 | rascunho |
| [LS-JBOSS-002](jboss-eap/LS-JBOSS-002-egress-por-usuario.md) | Limitar as conexões de saída do processo JBoss ao estritamente necessário | conter | alto | baixo | 1 | rascunho |
| [LS-JBOSS-003](jboss-eap/LS-JBOSS-003-auditoria-de-processos.md) | Auditar a execução de processos pelo usuário do JBoss | detectar | alto | baixo | 1 | rascunho |
| [LS-JBOSS-004](jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md) | Enviar os logs do JBoss EAP para um syslog central | detectar | alto | baixo | 1 | rascunho |

## Red Hat Ansible Automation Platform

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-AAP-001](aap/LS-AAP-001-chave-de-automacao-restrita.md) | Restringir a chave de automação aos nós de execução do AAP | conter | alto | baixo | 1 | rascunho |
