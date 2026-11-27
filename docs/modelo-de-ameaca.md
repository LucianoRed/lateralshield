# Modelo de ameaça

Este documento descreve o adversário e os caminhos que o catálogo procura fechar. Serve para priorizar controles, e não como guia de ataque.

## Adversário considerado

Um invasor que **já obteve execução de código em um componente** do ambiente — por vulnerabilidade sem correção, credencial vazada ou dependência comprometida — e que agora tenta:

1. Descobrir o que existe ao redor (varredura de rede, leitura de configurações).
2. Obter credenciais (arquivos de configuração, chaves SSH, tokens, segredos).
3. Alcançar outros sistemas com essas credenciais ou por serviços internos sem autenticação.
4. Chegar a um ponto de controle central: plano de controle do OpenShift, Ansible Automation Platform, servidor de identidade, banco de dados principal.

Ficam fora do escopo: ataques físicos, comprometimento da cadeia de suprimentos do próprio fornecedor e adversários com acesso prévio de administrador ao plano de controle.

## Pontos de entrada típicos

| Ponto de entrada | Por que é comum |
|---|---|
| JBoss EAP legado (5.x, 6.x, 7.x antigos) | Versões fora de suporte, consoles expostos, desserialização Java, aplicações antigas |
| Pod de aplicação no OpenShift | Vulnerabilidade na aplicação ou em biblioteca |
| Servidor RHEL com serviço exposto | Serviço desatualizado ou credencial fraca |
| Estação ou conta de administrador | Phishing, reutilização de senha |

## Caminhos de movimentação lateral

### A partir de um JBoss EAP invadido

- O processo Java pode abrir conexões para **qualquer destino** da rede interna, quando só precisa do banco de dados e de poucas integrações.
- Senhas de datasource em texto claro nos arquivos `standalone.xml` / `domain.xml` / `*-ds.xml`.
- Chaves SSH e arquivos de credenciais legíveis pelo usuário do serviço.
- Interfaces de gerenciamento de **outros** JBoss acessíveis pela rede (9990, 9999, consoles JMX do EAP 5).
- Canais de cluster (JGroups) sem autenticação.

### A partir de um pod no OpenShift

- Sem NetworkPolicy, o pod alcança todos os outros pods do cluster.
- Token da service account montado por padrão, com permissões além do necessário.
- Acesso à rede dos nós e a serviços de infraestrutura a partir de pods com `hostNetwork` ou após fuga do contêiner.
- Contêineres executando como root ou com SCC privilegiada, que encurtam o caminho até o nó.
- Secrets legíveis por mais contas do que o necessário, e credenciais embutidas em manifestos, imagens e variáveis de ambiente.

### Com uma conta ou credencial do OpenShift

- O usuário `kubeadmin` criado na instalação continua existindo, com senha fixa e sem vínculo com o provedor de identidade.
- `cluster-admin` concedido a muitas pessoas, grupos e service accounts: qualquer uma dessas credenciais entrega o cluster inteiro.
- Sem o log de auditoria da API fora do cluster, a criação de um `ClusterRoleBinding` ou a leitura em massa de Secrets não deixa rastro que o invasor não possa apagar.

### A partir de um host na rede dos nós do OpenShift

- **Machine Config Server** (22623/22624) entrega a configuração Ignition sem autenticação.
- Demais portas de infraestrutura dos nós expostas à rede local.

### A partir de um servidor RHEL

- SSH liberado entre todos os servidores; chaves privadas e `known_hosts` revelando os próximos alvos.
- Senha de root ou de conta de serviço igual em vários servidores.
- `sudo` amplo para contas de serviço, login direto de root e contas compartilhadas.
- SELinux desativado ou em modo permissivo: o serviço invadido alcança tudo o que as permissões de arquivo deixam.
- Portas de serviço abertas para a rede inteira, além das que o servidor precisa expor.
- Credenciais na memória de outros processos, ao alcance por `ptrace` e por core dumps.
- Host invadido usado como roteador ou para desviar tráfego (encaminhamento de IP, redirecionamentos ICMP).

### Pelo Ansible Automation Platform

- O AAP guarda credenciais com acesso a quase tudo. Quem o controla, controla o ambiente.
- No sentido inverso: a chave pública da automação instalada em todos os servidores aceita conexão de qualquer origem, e não apenas dos nós de execução.
- Contas locais compartilhadas, sem MFA, e perfil de System Administrator usado no dia a dia.
- Entrada HTTPS direta a controller, hub ou Event-Driven Ansible, sem passar pelo Platform Gateway.
- Tokens de API de longa duração, basic auth de administrador em scripts e segredos em playbooks ou `extra_vars`.
- Acesso ao sistema operacional dos nós da plataforma: quem lê a `SECRET_KEY` e o banco de dados decifra as credenciais armazenadas.
- Conexão com o PostgreSQL sem TLS com verificação do certificado.
- Senhas do inventário de instalação em texto claro, em repositórios e estações.
- Uma mesma credencial usada em todos os ambientes, e times com permissão de administrar credenciais que só precisariam usar.
- Collections e execution environments sem assinatura nem aprovação no private automation hub.

## Como o catálogo responde

| Caminho | Controles |
|---|---|
| Saída irrestrita do JBoss | [LS-JBOSS-002](../catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) |
| Interfaces de gerenciamento do JBoss expostas | [LS-JBOSS-001](../catalogo/jboss-eap/LS-JBOSS-001-interfaces-de-gerenciamento.md) |
| Invasão do JBoss passa despercebida | [LS-JBOSS-003](../catalogo/jboss-eap/LS-JBOSS-003-auditoria-de-processos.md), [LS-JBOSS-004](../catalogo/jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md) |
| Ponto de entrada pela web não fica registrado | [LS-OCP-003](../catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) |
| Machine Config Server acessível | [LS-OCP-001](../catalogo/openshift/LS-OCP-001-machine-config-server.md) |
| Rede de pods plana | [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md), [LS-OCP-012](../catalogo/openshift/LS-OCP-012-adminnetworkpolicy.md) |
| Contêiner com root, SCC privilegiada ou acesso ao host | [LS-OCP-008](../catalogo/openshift/LS-OCP-008-scc-privilegiadas-so-com-justificativa.md), [LS-OCP-009](../catalogo/openshift/LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md) |
| Token de service account e Secrets com alcance além do necessário | [LS-OCP-010](../catalogo/openshift/LS-OCP-010-service-account-dedicada-por-workload.md), [LS-OCP-011](../catalogo/openshift/LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md), [LS-OCP-013](../catalogo/openshift/LS-OCP-013-sem-credenciais-embutidas.md) |
| Conta administrativa do OpenShift excessiva ou sem dono | [LS-OCP-004](../catalogo/openshift/LS-OCP-004-remover-kubeadmin.md), [LS-OCP-005](../catalogo/openshift/LS-OCP-005-restringir-cluster-admin.md) |
| Ações na API do OpenShift passam despercebidas | [LS-OCP-006](../catalogo/openshift/LS-OCP-006-auditoria-da-api-fora-do-cluster.md), [LS-OCP-007](../catalogo/openshift/LS-OCP-007-alertas-de-rbac-scc-e-secrets.md) |
| SSH livre entre servidores | [LS-RHEL-001](../catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md), [LS-RHEL-007](../catalogo/rhel/LS-RHEL-007-ssh-por-chave-ou-mfa-e-allowgroups.md) |
| Root direto, contas compartilhadas e `sudo` amplo | [LS-RHEL-004](../catalogo/rhel/LS-RHEL-004-sem-login-de-root.md), [LS-RHEL-005](../catalogo/rhel/LS-RHEL-005-sudo-de-menor-privilegio.md) |
| Serviço invadido sem confinamento no host | [LS-RHEL-006](../catalogo/rhel/LS-RHEL-006-selinux-em-enforcing.md), [LS-RHEL-010](../catalogo/rhel/LS-RHEL-010-core-dumps-e-ptrace.md) |
| Portas abertas além do necessário e host usado como roteador | [LS-RHEL-008](../catalogo/rhel/LS-RHEL-008-firewalld-somente-o-necessario.md), [LS-RHEL-011](../catalogo/rhel/LS-RHEL-011-parametros-de-rede-do-kernel.md) |
| Invasor apaga os logs do host invadido | [LS-RHEL-002](../catalogo/rhel/LS-RHEL-002-syslog-central.md) |
| Ações privilegiadas e troca de binários passam despercebidas | [LS-RHEL-003](../catalogo/rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md), [LS-RHEL-009](../catalogo/rhel/LS-RHEL-009-uso-de-sudo-registrado-e-revisado.md), [LS-RHEL-012](../catalogo/rhel/LS-RHEL-012-integridade-de-arquivos-com-aide.md) |
| Chave da automação aceita de qualquer origem | [LS-AAP-001](../catalogo/aap/LS-AAP-001-chave-de-automacao-restrita.md) |
| Tomada do AAP por uma conta de usuário | [LS-AAP-002](../catalogo/aap/LS-AAP-002-mfa-no-provedor-de-identidade.md), [LS-AAP-003](../catalogo/aap/LS-AAP-003-administrador-somente-break-glass.md), [LS-AAP-008](../catalogo/aap/LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md), [LS-AAP-012](../catalogo/aap/LS-AAP-012-entrada-somente-pelo-gateway.md) |
| Token ou senha de integração com alcance de administrador | [LS-AAP-013](../catalogo/aap/LS-AAP-013-tokens-e-oauth-no-gateway.md) |
| Segredo no playbook, em `extra_vars` ou no log do job | [LS-AAP-014](../catalogo/aap/LS-AAP-014-sem-segredos-em-playbooks-e-extra-vars.md) |
| Extração das credenciais do AAP pelo sistema operacional, pelo banco ou pelo instalador | [LS-AAP-004](../catalogo/aap/LS-AAP-004-acesso-ao-so-dos-nos.md), [LS-AAP-005](../catalogo/aap/LS-AAP-005-protecao-da-secret-key.md), [LS-AAP-006](../catalogo/aap/LS-AAP-006-senhas-do-instalador-em-vault.md), [LS-AAP-010](../catalogo/aap/LS-AAP-010-segmentacao-de-rede-dos-nos.md), [LS-AAP-015](../catalogo/aap/LS-AAP-015-tls-verify-full-no-postgresql.md) |
| Uma credencial do AAP abre todos os ambientes | [LS-AAP-009](../catalogo/aap/LS-AAP-009-credenciais-por-finalidade-e-ambiente.md), [LS-AAP-011](../catalogo/aap/LS-AAP-011-credenciais-com-propriedade-central.md) |
| Conteúdo de automação adulterado no hub ou na EE | [LS-AAP-016](../catalogo/aap/LS-AAP-016-assinatura-e-aprovacao-no-hub.md) |
| Uso indevido do AAP passa despercebido | [LS-AAP-007](../catalogo/aap/LS-AAP-007-logs-e-activity-stream-em-agregador.md) |

Os caminhos ainda sem controle publicado estão no [roadmap](roadmap.md).
