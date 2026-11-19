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

### A partir de um host na rede dos nós do OpenShift

- **Machine Config Server** (22623/22624) entrega a configuração Ignition sem autenticação.
- Demais portas de infraestrutura dos nós expostas à rede local.

### A partir de um servidor RHEL

- SSH liberado entre todos os servidores; chaves privadas e `known_hosts` revelando os próximos alvos.
- Senha de root ou de conta de serviço igual em vários servidores.
- `sudo` amplo para contas de serviço.

### Pelo Ansible Automation Platform

- O AAP guarda credenciais com acesso a quase tudo. Quem o controla, controla o ambiente.
- No sentido inverso: a chave pública da automação instalada em todos os servidores aceita conexão de qualquer origem, e não apenas dos nós de execução.

## Como o catálogo responde

| Caminho | Controles |
|---|---|
| Saída irrestrita do JBoss | [LS-JBOSS-002](../catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) |
| Interfaces de gerenciamento do JBoss expostas | [LS-JBOSS-001](../catalogo/jboss-eap/LS-JBOSS-001-interfaces-de-gerenciamento.md) |
| Invasão do JBoss passa despercebida | [LS-JBOSS-003](../catalogo/jboss-eap/LS-JBOSS-003-auditoria-de-processos.md) |
| Machine Config Server acessível | [LS-OCP-001](../catalogo/openshift/LS-OCP-001-machine-config-server.md) |
| Rede de pods plana | [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md) |
| SSH livre entre servidores | [LS-RHEL-001](../catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) |
| Chave da automação aceita de qualquer origem | [LS-AAP-001](../catalogo/aap/LS-AAP-001-chave-de-automacao-restrita.md) |

Os caminhos ainda sem controle publicado estão no [roadmap](roadmap.md).
