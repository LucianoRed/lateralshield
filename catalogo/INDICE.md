# Índice do catálogo

<!-- Gerado por scripts/catalogo.py. Não edite manualmente. -->

Controles do LateralShield para tecnologias Red Hat. A prioridade segue o filtro 80/20 da [metodologia](../docs/metodologia.md).

## Red Hat OpenShift

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-OCP-001](openshift/LS-OCP-001-machine-config-server.md) | Restringir o acesso ao Machine Config Server | conter | alto | baixo | 1 | rascunho |
| [LS-OCP-002](openshift/LS-OCP-002-networkpolicy-negacao-padrao.md) | Aplicar NetworkPolicy de negação padrão nos namespaces de aplicação | conter | alto | medio | 2 | rascunho |
| [LS-OCP-003](openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) | Enviar o log de acesso do ingress para um syslog central | detectar | alto | baixo | 1 | rascunho |
| [LS-OCP-004](openshift/LS-OCP-004-remover-kubeadmin.md) | Remover o usuário kubeadmin | prevenir | alto | baixo | 1 | rascunho |
| [LS-OCP-005](openshift/LS-OCP-005-restringir-cluster-admin.md) | Restringir o papel cluster-admin a poucas contas nominais | prevenir | alto | baixo | 1 | rascunho |
| [LS-OCP-006](openshift/LS-OCP-006-auditoria-da-api-fora-do-cluster.md) | Enviar o log de auditoria da API para fora do cluster | detectar | alto | baixo | 1 | rascunho |
| [LS-OCP-007](openshift/LS-OCP-007-alertas-de-rbac-scc-e-secrets.md) | Alertar sobre mudanças em RBAC, SCC e Secrets | detectar | alto | baixo | 1 | rascunho |
| [LS-OCP-008](openshift/LS-OCP-008-scc-privilegiadas-so-com-justificativa.md) | Reservar as SCCs privileged e anyuid a workloads justificados | conter | alto | medio | 2 | rascunho |
| [LS-OCP-009](openshift/LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md) | Executar contêineres sem root e sem hostNetwork, hostPath e hostPorts | conter | alto | medio | 2 | rascunho |
| [LS-OCP-010](openshift/LS-OCP-010-service-account-dedicada-por-workload.md) | Usar uma service account dedicada por workload, com papéis mínimos | conter | alto | medio | 2 | rascunho |
| [LS-OCP-011](openshift/LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md) | Restringir o acesso a Secrets com RBAC | conter | alto | medio | 2 | rascunho |
| [LS-OCP-012](openshift/LS-OCP-012-adminnetworkpolicy.md) | Aplicar AdminNetworkPolicy para regras que o tenant não sobrescreve | conter | alto | medio | 2 | rascunho |
| [LS-OCP-013](openshift/LS-OCP-013-sem-credenciais-embutidas.md) | Eliminar credenciais embutidas em manifestos, imagens e variáveis | conter | alto | medio | 2 | rascunho |

## Red Hat Enterprise Linux

| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |
|---|---|---|---|---|---|---|
| [LS-RHEL-001](rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) | Aceitar SSH somente de origens administrativas | conter | alto | baixo | 1 | rascunho |
| [LS-RHEL-002](rhel/LS-RHEL-002-syslog-central.md) | Encaminhar os logs do sistema para um syslog central | detectar | alto | baixo | 1 | rascunho |
| [LS-RHEL-003](rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md) | Auditar identidade, sudo e módulos de kernel com o auditd | detectar | alto | baixo | 1 | rascunho |
| [LS-RHEL-004](rhel/LS-RHEL-004-sem-login-de-root.md) | Bloquear o login de root e usar contas nominais com sudo | conter | alto | medio | 2 | rascunho |
| [LS-RHEL-005](rhel/LS-RHEL-005-sudo-de-menor-privilegio.md) | Aplicar sudo de menor privilégio | conter | alto | medio | 2 | rascunho |
| [LS-RHEL-006](rhel/LS-RHEL-006-selinux-em-enforcing.md) | Manter o SELinux em modo enforcing | conter | alto | medio | 2 | rascunho |
| [LS-RHEL-007](rhel/LS-RHEL-007-ssh-por-chave-ou-mfa-e-allowgroups.md) | Exigir chave ou MFA no SSH e restringir o acesso com AllowGroups | conter | alto | medio | 2 | rascunho |
| [LS-RHEL-008](rhel/LS-RHEL-008-firewalld-somente-o-necessario.md) | Liberar no firewalld somente os serviços e portas necessários | conter | alto | medio | 2 | rascunho |
| [LS-RHEL-009](rhel/LS-RHEL-009-uso-de-sudo-registrado-e-revisado.md) | Registrar e revisar o uso de sudo | detectar | medio | baixo | 2 | rascunho |
| [LS-RHEL-010](rhel/LS-RHEL-010-core-dumps-e-ptrace.md) | Desabilitar core dumps e restringir o ptrace | conter | medio | baixo | 2 | rascunho |
| [LS-RHEL-011](rhel/LS-RHEL-011-parametros-de-rede-do-kernel.md) | Endurecer os parâmetros de rede do kernel | conter | medio | baixo | 2 | rascunho |
| [LS-RHEL-012](rhel/LS-RHEL-012-integridade-de-arquivos-com-aide.md) | Verificar a integridade de arquivos com o AIDE | detectar | medio | baixo | 2 | rascunho |

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
| [LS-AAP-002](aap/LS-AAP-002-mfa-no-provedor-de-identidade.md) | Exigir MFA no provedor de identidade usado pelo AAP | prevenir | alto | baixo | 1 | rascunho |
| [LS-AAP-003](aap/LS-AAP-003-administrador-somente-break-glass.md) | Reservar o System Administrator a contas de emergência | prevenir | alto | baixo | 1 | rascunho |
| [LS-AAP-004](aap/LS-AAP-004-acesso-ao-so-dos-nos.md) | Restringir o acesso ao sistema operacional dos nós do AAP | conter | alto | baixo | 1 | rascunho |
| [LS-AAP-005](aap/LS-AAP-005-protecao-da-secret-key.md) | Proteger a SECRET_KEY e manter cópia de segurança | conter | alto | baixo | 1 | rascunho |
| [LS-AAP-006](aap/LS-AAP-006-senhas-do-instalador-em-vault.md) | Guardar as senhas do inventário de instalação em Ansible Vault | conter | alto | baixo | 1 | rascunho |
| [LS-AAP-007](aap/LS-AAP-007-logs-e-activity-stream-em-agregador.md) | Enviar os logs e o activity stream para um agregador central | detectar | alto | baixo | 1 | rascunho |
| [LS-AAP-008](aap/LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md) | Autenticar pelo IdP corporativo, sem contas locais compartilhadas | prevenir | alto | medio | 2 | rascunho |
| [LS-AAP-009](aap/LS-AAP-009-credenciais-por-finalidade-e-ambiente.md) | Separar as credenciais por finalidade e ambiente | conter | alto | medio | 2 | rascunho |
| [LS-AAP-010](aap/LS-AAP-010-segmentacao-de-rede-dos-nos.md) | Segmentar a rede dos nós do AAP | conter | alto | medio | 2 | rascunho |
| [LS-AAP-011](aap/LS-AAP-011-credenciais-com-propriedade-central.md) | Centralizar a propriedade das credenciais e conceder aos times apenas o papel Use | conter | alto | medio | 2 | rascunho |
| [LS-AAP-012](aap/LS-AAP-012-entrada-somente-pelo-gateway.md) | Publicar apenas o Platform Gateway como entrada | prevenir | alto | medio | 2 | rascunho |
| [LS-AAP-013](aap/LS-AAP-013-tokens-e-oauth-no-gateway.md) | Autenticar integrações com OAuth ou PAT do gateway | prevenir | alto | medio | 2 | rascunho |
| [LS-AAP-014](aap/LS-AAP-014-sem-segredos-em-playbooks-e-extra-vars.md) | Eliminar segredos de playbooks e extra_vars | conter | alto | medio | 2 | rascunho |
| [LS-AAP-015](aap/LS-AAP-015-tls-verify-full-no-postgresql.md) | Exigir TLS verify-full nas conexões com o PostgreSQL | conter | alto | medio | 2 | rascunho |
| [LS-AAP-016](aap/LS-AAP-016-assinatura-e-aprovacao-no-hub.md) | Assinar e aprovar conteúdo no private automation hub | prevenir | alto | medio | 2 | rascunho |
