# Avaliação básica de processos

O [catálogo](../catalogo/INDICE.md) avalia configuração: o que está exposto e o que um componente invadido consegue alcançar. Esta página avalia o que sustenta essa configuração: **pessoas e processos**. Uma regra que bloqueia e registra a tentativa perde metade do valor se o registro chega a uma caixa que ninguém lê, e um controle aplicado sem dono é desfeito na primeira mudança que ele atrapalhar.

A avaliação é básica de propósito: 20 perguntas em cinco blocos, pensadas para uma conversa com as equipes, e não para uma auditoria.

Três diferenças em relação ao catálogo:

- **Não são controles.** As perguntas não têm identificador, status nem passam pelo validador.
- **Não são específicas de tecnologias Red Hat.** Valem para qualquer ambiente. Estão aqui porque os controles do catálogo dependem delas; quando existe um controle relacionado, ele é citado.
- **Não medem maturidade.** Não há nota nem nível. O resultado é uma lista curta de lacunas, cada uma com responsável e prazo. Para uma avaliação completa, use os referenciais citados no [final da página](#referências).

## Como conduzir

1. **Reúna quem vive a rotina.** Alguém que opera as plataformas, alguém que responde por segurança, alguém de desenvolvimento e alguém com autoridade para definir prioridades. Perguntar só à gestão costuma trazer a resposta do organograma, e não a da rotina.
2. **Use três respostas:** `sim`, `parcial` ou `não`.
3. **"Sim" exige evidência:** um nome, um documento, uma data, um registro. "Temos, mas ninguém sabe onde está" é `não`. "Existe, mas não é seguido" é `parcial`.
4. **Pergunte pelo último caso real.** "Quando foi a última vez que isso aconteceu, e o que foi feito?" mostra mais do que "existe um processo para isso?".
5. **Procure a lacuna, não o culpado.** Se a conversa virar cobrança, as respostas passam a ser defensivas e a avaliação deixa de servir.
6. **Trate o resultado como informação sensível.** A lista de lacunas mostra onde o ambiente é mais frágil: guarde com acesso restrito e não a publique com dados reais.

## Resumo

| Bloco | Pergunta central | Perguntas |
|---|---|---|
| [Resposta a incidentes](#resposta-a-incidentes) | Se um servidor for invadido hoje, quem é acionado e quem decide? | 1 a 4 |
| [Segurança e políticas](#segurança-e-políticas) | Quem define o que é aceitável e confere se está sendo cumprido? | 5 a 8 |
| [Operação](#operação) | Quem opera as plataformas sabe mantê-las seguras? | 9 a 13 |
| [Monitoramento e detecção](#monitoramento-e-detecção) | Alguém vê o alerta, e em quanto tempo? | 14 a 16 |
| [Desenvolvimento](#desenvolvimento) | Quem escreve as aplicações sabe o que as expõe? | 17 a 20 |

## Resposta a incidentes

| # | Pergunta | O que conta como "sim" | Por que importa |
|---|---|---|---|
| 1 | Existe um time ou uma pessoa responsável por responder a incidentes de segurança? | Nomes, um substituto e um contato que funciona fora do horário comercial | Sem responsável, as primeiras horas se perdem descobrindo quem deveria agir, e são elas que definem até onde o invasor chega |
| 2 | Está definido quem decide entre manter o serviço no ar e conter? | Um papel nomeado, com autoridade reconhecida pela área de negócio | Isolar um componente derruba o serviço que ele presta. Sem alguém que decida, o isolamento espera uma reunião |
| 3 | Existe um plano de resposta escrito, e ele já foi usado? | Um documento que a equipe sabe localizar e a data do último simulado ou incidente real em que foi seguido | Plano nunca exercitado falha nos detalhes: contato desatualizado, acesso que não funciona, canal que depende do ambiente afetado |
| 4 | Depois de um incidente, alguém registra o que aconteceu e o que muda? | O relatório do último incidente, com ações, responsáveis e prazos | É o que transforma o caminho percorrido pelo invasor em controle permanente |

As [recomendações gerais para incidentes](recomendacoes-para-incidentes.md) partem do princípio de que as perguntas 1 e 2 têm resposta. Veja as seções [Organizar a resposta](recomendacoes-para-incidentes.md#organizar-a-resposta) e [Encerrar o incidente](recomendacoes-para-incidentes.md#encerrar-o-incidente).

## Segurança e políticas

| # | Pergunta | O que conta como "sim" | Por que importa |
|---|---|---|---|
| 5 | Existe um time ou uma pessoa de segurança que define as políticas e acompanha a aplicação? | Um responsável nomeado e políticas escritas que a operação conhece e usa, como uma linha de base de configuração por plataforma | Sem dono, cada equipe decide sozinha o que é aceitável, e o padrão do ambiente passa a ser o do servidor mais fraco |
| 6 | Alguém verifica periodicamente se as políticas estão sendo cumpridas? | Uma verificação com data e resultado guardado, manual ou automatizada | Configuração de segurança se degrada com o tempo. Os playbooks `avaliar_*` da [automação](../automacao/README.md) servem a essa verificação para os controles do catálogo |
| 7 | As exceções são registradas com dono, justificativa e prazo de revisão? | Uma lista de exceções consultável, com data da última revisão | Exceção sem registro vira exposição permanente. Exceção registrada, como um JBoss EAP legado que não pode ser atualizado, é candidata a controle de contenção ([LS-JBOSS-002](../catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md)) |
| 8 | Existe um inventário dos sistemas, com um responsável por cada um? | Uma lista atualizada em que cada servidor, cluster e aplicação tem dono | Não se contém o que não se sabe que existe, e sistema sem dono é o que fica sem correção |

## Operação

| # | Pergunta | O que conta como "sim" | Por que importa |
|---|---|---|---|
| 9 | As equipes que operam as plataformas têm conhecimento de segurança, ou alguém a quem recorrer? | Em cada plataforma (OpenShift, RHEL, JBoss EAP, Ansible Automation Platform), uma pessoa de referência em segurança ou um canal direto com o time de segurança | É a operação que aplica e mantém os controles. Quem não entende por que uma regra existe a remove no primeiro chamado |
| 10 | Há um processo para acompanhar e aplicar correções de segurança, com prazo? | Alguém acompanha os avisos de segurança do fornecedor, há prazo definido por severidade e a data da última rodada de correções é conhecida | Vulnerabilidade sem correção é a primeira forma de entrada citada no [modelo de ameaça](modelo-de-ameaca.md) |
| 11 | Os acessos administrativos são individuais e revisados? | Contas nominais, remoção quando a pessoa sai ou muda de função e uma revisão com data | Conta compartilhada e acesso esquecido são credenciais prontas para a movimentação lateral, e impedem saber quem fez o quê. Relacionado: [LS-RHEL-001](../catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) e [LS-AAP-001](../catalogo/aap/LS-AAP-001-chave-de-automacao-restrita.md) |
| 12 | As mudanças em produção são registradas e revisadas por outra pessoa? | Um registro consultável que inclui regras de firewall, permissões e acessos | Durante um incidente, é o registro de mudanças que separa o que a equipe fez do que o invasor fez |
| 13 | A restauração de backup já foi testada? | Um teste de restauração com data, e cópias que as credenciais do ambiente de produção não alcançam | Backup acessível com as mesmas credenciais do ambiente invadido é apagado junto com ele |

## Monitoramento e detecção

| # | Pergunta | O que conta como "sim" | Por que importa |
|---|---|---|---|
| 14 | Os logs saem dos servidores para um destino central, com retenção definida? | O encaminhamento funcionando em cada camada e um prazo de retenção escrito | É a [primeira verificação](metodologia.md#a-primeira-verificação-os-logs-saem-do-servidor) da metodologia: [LS-RHEL-002](../catalogo/rhel/LS-RHEL-002-syslog-central.md), [LS-OCP-003](../catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) e [LS-JBOSS-004](../catalogo/jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md) |
| 15 | Alguém é responsável por olhar os alertas, e em quanto tempo? | Um nome ou uma escala, um tempo esperado até a primeira análise e a regra para fora do horário comercial | Os controles de contenção geram sinais de alta qualidade. Sem destinatário, o bloqueio continua funcionando, mas a detecção se perde |
| 16 | Cada alerta tem uma instrução do que fazer? | Para os alertas dos controles já aplicados, uma instrução curta: o que significa, o que conferir e quem acionar | Alerta sem instrução é ignorado ou escalado para a pessoa errada |

## Desenvolvimento

| # | Pergunta | O que conta como "sim" | Por que importa |
|---|---|---|---|
| 17 | As equipes de desenvolvimento recebem orientação de segurança? | Treinamento ou material com data, voltado às linguagens e aos frameworks que a equipe realmente usa | Falha na aplicação aparece em dois pontos de entrada do modelo de ameaça: o JBoss EAP legado e o pod de aplicação |
| 18 | Dependências e imagens são verificadas quanto a vulnerabilidades conhecidas? | Uma verificação automática no pipeline ou periódica, com alguém responsável por tratar o resultado | Vulnerabilidade em biblioteca é um dos motivos pelos quais o pod de aplicação é ponto de entrada comum, e uma verificação sem dono só produz relatórios |
| 19 | Senhas, chaves e tokens ficam fora do código e dos repositórios? | Segredos em cofre ou em recurso próprio da plataforma, e uma busca por segredos nos repositórios com data | Credencial em repositório é lida por qualquer pessoa ou processo com acesso ao código, e liga sistemas que a rede não liga |
| 20 | A equipe de desenvolvimento sabe dizer com quais destinos cada aplicação precisa falar? | Para cada aplicação, a lista de bancos de dados e integrações que ela usa | É a informação que os controles de contenção exigem: a lista de destinos do [LS-JBOSS-002](../catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) e as regras do [LS-OCP-002](../catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md) |

## Como interpretar o resultado

- **Comece pelas perguntas 1, 14 e 15.** Um `não` em qualquer uma delas deve ser tratado junto com os primeiros controles do catálogo, e não depois: sem log central, sem quem leia o alerta e sem quem responda, os controles ainda bloqueiam, mas ninguém fica sabendo da tentativa.
- **Trate `parcial` como `não` com ponto de partida.** Registre o que falta para a resposta virar `sim`.
- **Não some as respostas.** Dezoito respostas `sim` não compensam a falta de um responsável por incidentes.
- **Aplique o filtro 80/20 também aqui.** Para cada lacuna, escolha o menor passo que muda a resposta. A tabela abaixo traz sugestões.

| Lacuna | Primeiro passo de baixo esforço |
|---|---|
| Não há responsável por incidentes (1, 2) | Nomear uma pessoa e um substituto, com contato fora do horário e autoridade para isolar um componente. O time vem depois |
| Não há plano de resposta (3) | Escrever uma página: quem acionar, quem decide, qual é o canal alternativo e onde estão os logs. As [recomendações gerais para incidentes](recomendacoes-para-incidentes.md) servem de base |
| Não há dono das políticas (5) | Nomear um responsável e adotar como primeira linha de base escrita os controles do catálogo já aplicados |
| Ninguém verifica o cumprimento (6) | Agendar a execução dos playbooks `avaliar_*` e guardar o resultado de cada rodada |
| Exceções sem registro (7) | Abrir uma lista com sistema, motivo, dono e data de revisão, começando pelos sistemas que não podem ser atualizados |
| Não há inventário (8) | Começar pelo que está exposto à internet e pelos pontos de controle central: Ansible Automation Platform e plano de controle do OpenShift |
| Correções sem processo (10) | Definir quem acompanha os avisos de segurança do fornecedor e um prazo para as correções de severidade crítica |
| Ninguém olha os alertas (15, 16) | Começar com poucos alertas, os de bloqueio dos controles de contenção, e um destinatário nomeado |
| Desenvolvimento sem orientação (17) | Fazer uma sessão curta sobre as falhas já encontradas nas aplicações do próprio ambiente |

## Registro

Registre uma linha por pergunta. Um exemplo com dados fictícios:

| # | Resposta | Evidência | Lacuna | Responsável | Prazo |
|---|---|---|---|---|---|
| 1 | parcial | Há um responsável nomeado, sem substituto | Definir substituto e contato fora do horário | Coordenação de infraestrutura | 30 dias |
| 15 | não | Os alertas chegam a uma caixa de e-mail compartilhada que ninguém acompanha | Definir escala e tempo de primeira análise | Time de segurança | 15 dias |

Repita a avaliação no passo **Verificar** do [ciclo de adoção](metodologia.md#ciclo-de-adoção) e depois de cada incidente: o incidente mostra quais respostas `sim` eram, na prática, `parcial`.

## Referências

- [NIST Cybersecurity Framework (CSF) 2.0](https://www.nist.gov/cyberframework)
- [NIST SP 800-61 Rev. 3 — Incident Response Recommendations and Considerations for Cybersecurity Risk Management](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- CIS Critical Security Controls: [Security Awareness and Skills Training](https://www.cisecurity.org/controls/security-awareness-and-skills-training), [Application Software Security](https://www.cisecurity.org/controls/application-software-security) e [Incident Response Management](https://www.cisecurity.org/controls/incident-response-management)
- [OWASP SAMM — Software Assurance Maturity Model](https://owaspsamm.org/)
- [Red Hat Product Security Center](https://access.redhat.com/security/), para acompanhar os avisos de segurança dos produtos
- [Metodologia do LateralShield](metodologia.md) e [modelo de ameaça](modelo-de-ameaca.md)
