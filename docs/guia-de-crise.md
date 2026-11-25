# Guia de crise

As [recomendações gerais para incidentes](recomendacoes-para-incidentes.md) dizem **como** aplicar cada medida de emergência. Esta página diz **o que conferir e em que ordem**: um checklist para montar uma sala de crise com um mínimo de organização, do primeiro sinal ao encerramento.

Três avisos:

- **Não são controles.** Os itens não têm identificador no catálogo, status nem passam pelo validador.
- **Não substitui o plano de resposta da organização** nem a equipe especializada em resposta, perícia ou assuntos jurídicos. Serve para quem não tem um plano à mão, ou para conferir se o plano em uso esqueceu de algo.
- **Não é específico de tecnologias Red Hat.** Vale para qualquer ambiente. Quando existe um controle do catálogo ou uma recomendação relacionada, ele é citado.

## Como usar

1. **Abra o guia no primeiro sinal**, mesmo que ainda seja só suspeita. Fechar um alarme falso custa pouco; começar a registrar tarde custa a linha do tempo.
2. **Uma pessoa registra.** Quem investiga e quem bloqueia não deve parar para escrever.
3. **Use quatro situações:** `pendente`, `em andamento`, `feito` ou `não se aplica`. "Não se aplica" também é uma decisão, e merece uma linha dizendo por quê. O que não se resolve durante a crise não fica como pendente: ganha responsável e prazo e vai para o plano de ação. No Mission Control, é a situação `no plano de ação`.
4. **Registre fato separado de hipótese, com horário** e sempre no mesmo fuso.
5. **As seções não são fases estanques.** A contenção não espera o levantamento terminar: levantamento, coleta de evidências e bloqueios andam juntos. A única ordem que não se inverte é conter antes de limpar.
6. **Use o guia fora do ambiente afetado.** Se o Mission Control está instalado em um cluster que faz parte do incidente, abra a página em modo local em uma estação fora dele, ou use o guia impresso.
7. **Trate o registro como informação sensível.** Ele mostra o que está exposto: guarde com acesso restrito e não o publique com dados reais.

## Resumo

| Seção | Pergunta central | Itens |
|---|---|---|
| [Abertura da sala de crise](#abertura-da-sala-de-crise) | Quem decide, quem faz o quê e por onde a equipe fala? | 1 a 6 |
| [Levantamento do incidente](#levantamento-do-incidente) | O que aconteceu, por onde entrou e até onde chegou? | 7 a 16 |
| [Coleta de evidências](#coleta-de-evidências) | O que precisa ser guardado antes que alguém reinicie ou limpe? | 17 a 22 |
| [Bloqueios e contenção](#bloqueios-e-contenção) | O que o invasor ainda alcança, e onde isso é cortado? | 23 a 29 |
| [Erradicação e credenciais](#erradicação-e-credenciais) | Por onde ele entrou e o que deixou para voltar? | 30 a 33 |
| [Voltar os serviços com segurança](#voltar-os-serviços-com-segurança) | O que precisa ser verdade para o serviço voltar? | 34 a 38 |
| [Encerramento](#encerramento) | O que fica permanente, o que é removido e o que se aprende? | 39 a 42 |

## Abertura da sala de crise

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 1 | Há um responsável pelo incidente, com autoridade para decidir entre manter o serviço no ar e conter? | Nome, substituto e como acionar os dois | Isolar um componente derruba o serviço que ele presta. Sem alguém que decida, a contenção espera uma reunião |
| 2 | Os papéis da sala estão distribuídos? | Quem investiga, quem aplica os bloqueios, quem fala com as outras áreas e quem registra | Com todos investigando, ninguém contém e ninguém registra |
| 3 | O canal de comunicação da equipe está fora do ambiente afetado? | Qual canal está em uso e quem tem acesso a ele | Se o e-mail ou o chat corporativo podem estar comprometidos, o invasor acompanha a resposta |
| 4 | Existe uma linha do tempo única, com uma pessoa responsável por mantê-la? | Onde ela fica. Cada ação entra com hora, autor e motivo | É o que permite desfazer as medidas de emergência depois, e separar o que a equipe fez do que o invasor fez |
| 5 | As mudanças não relacionadas ao incidente foram congeladas? | Quem avisou as equipes e desde quando vale | Implantações e manutenções durante o incidente confundem a investigação e escondem o que o invasor fez |
| 6 | As áreas jurídica, de privacidade e de comunicação foram avisadas? | Quem foi avisado e a que horas | Incidentes com dados pessoais podem exigir comunicação a autoridades e titulares, com prazo. Quem conhece o prazo precisa saber cedo |

## Levantamento do incidente

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 7 | Quais são as evidências do incidente? | Descrição curta do que aconteceu ou do que se suspeita, separando fato de hipótese | Sem uma descrição comum, cada pessoa da sala trabalha em um incidente diferente |
| 8 | Como e quando o incidente foi percebido? | Alerta, relato de usuário ou aviso de terceiro. Horário do primeiro sinal e do evento mais antigo já encontrado | A distância entre os dois horários mostra por quanto tempo o invasor agiu sem ser visto, e até onde os logs precisam ser lidos |
| 9 | O incidente ainda está em andamento? | Atividade observada agora: conexões, processos, logins, mudanças de configuração | Define a urgência da contenção |
| 10 | A origem é conhecida? | Endereços de origem, contas usadas e ponto de entrada provável: falha sem correção, credencial vazada ou serviço exposto | Sem o ponto de entrada, o invasor volta pelo mesmo caminho depois da limpeza |
| 11 | Quais ativos estão envolvidos? | Servidores, pods, namespaces, clusters e contas, marcando o que é confirmado e o que é suspeito | É a lista do que isolar e do que preservar. Ativo marcado como limpo sem verificação é pior do que ativo marcado como suspeito |
| 12 | Houve elevação de privilégio? | Indícios de uso de root, de `sudo`, de `cluster-admin`, de contêiner privilegiado ou de administrador do Ansible Automation Platform | Com privilégio de administrador, os logs locais e a configuração do ativo deixam de ser confiáveis |
| 13 | Quais credenciais estavam ao alcance dos ativos envolvidos? | Senhas de datasource, chaves SSH, tokens de service account, Secrets e credenciais guardadas no Ansible Automation Platform | Tudo o que estava legível para o processo comprometido deve ser tratado como exposto, mesmo sem prova de uso |
| 14 | Para onde o invasor pode ter se movido? | Um desenho dos ativos envolvidos: o que cada um alcança, o que alcança cada um e onde é possível bloquear | [Desenhar a topologia](recomendacoes-para-incidentes.md#desenhar-a-topologia-dos-ativos-envolvidos) evita bloquear no lugar errado ou deixar um caminho aberto |
| 15 | Há indício de acesso a dados ou de saída de dados? | Quais dados, se incluem dados pessoais, e o tráfego de saída observado | Muda as obrigações de comunicação e a prioridade do bloqueio de saída |
| 16 | Qual é o impacto no negócio neste momento? | Serviços afetados, usuários atingidos e o que para de funcionar se os ativos forem isolados | É a informação de que o responsável precisa para decidir entre disponibilidade e contenção |

## Coleta de evidências

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 17 | Os logs dos ativos envolvidos estão fora deles? | Onde estão. Se não estavam em um destino central, quem copiou, quando e para onde | Um invasor com privilégio apaga os logs locais. Ver [LS-RHEL-002](../catalogo/rhel/LS-RHEL-002-syslog-central.md), [LS-OCP-003](../catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md), [LS-OCP-006](../catalogo/openshift/LS-OCP-006-auditoria-da-api-fora-do-cluster.md), [LS-JBOSS-004](../catalogo/jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md) e [LS-AAP-007](../catalogo/aap/LS-AAP-007-logs-e-activity-stream-em-agregador.md) |
| 18 | A retenção dos logs cobre o período do incidente? | Retenção atual no destino central e até quando foi ampliada | A rotação normal apaga o período de interesse enquanto a investigação ainda está em curso |
| 19 | Foi tirado um snapshot do disco ou da máquina virtual antes de qualquer reinício ou limpeza? | Ativo, horário e onde a cópia está guardada | Depois da reinstalação ou da restauração de backup, não há mais o que analisar |
| 20 | O estado em execução foi registrado antes de isolar ou desligar? | Processos, conexões de rede, usuários conectados e tarefas agendadas de cada ativo, com horário | Memória e processos em execução se perdem no reinício e costumam ser a melhor evidência |
| 21 | No OpenShift, os registros do período foram guardados e os pods suspeitos, preservados? | Log de auditoria da API, eventos e definição dos workloads suspeitos. O pod é retirado do tráfego, e não apagado | Apagar o pod destrói a evidência, e os eventos do cluster são guardados por pouco tempo |
| 22 | As evidências estão fora do ambiente afetado, com acesso restrito? | Onde estão, quem tem acesso, e quem coletou cada item e quando | Snapshots e logs contêm dados sensíveis e credenciais. Evidência sem registro de coleta perde valor em uma apuração formal. Ver [Preservar evidências](recomendacoes-para-incidentes.md#preservar-evidências-antes-de-limpar) |

## Bloqueios e contenção

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 23 | Os componentes suspeitos foram isolados sem ser desligados? | Ativo, como foi isolado e quem aprovou a indisponibilidade | [Isolar sem desligar](recomendacoes-para-incidentes.md#isolar-o-componente-suspeito-sem-desligá-lo) corta o caminho para os vizinhos e mantém a evidência |
| 24 | As interfaces administrativas expostas à internet foram fechadas? | O que estava exposto e o que foi restrito: SSH, consoles de gerenciamento, API e console do OpenShift, interface do Ansible Automation Platform | [Fechar interfaces administrativas](recomendacoes-para-incidentes.md#fechar-interfaces-administrativas-expostas-à-internet) tira do invasor o caminho mais direto de volta |
| 25 | A saída dos servidores para a internet foi restrita, e as tentativas estão sendo registradas? | Segmentos afetados, destinos liberados e onde ficam os registros de bloqueio | [Restringir a saída](recomendacoes-para-incidentes.md#restringir-a-saída-dos-servidores-para-a-internet) dificulta comando remoto e saída de dados, e as tentativas registradas mostram outros servidores com o mesmo comportamento |
| 26 | A entrada no perímetro foi reduzida ao necessário? | Regra aplicada, exceções criadas e data de revisão | [Aceitar entrada apenas do Brasil](recomendacoes-para-incidentes.md#aceitar-entrada-apenas-do-brasil-no-perímetro) reduz o volume e ganha tempo. Não contém quem já entrou |
| 27 | As contas e as sessões suspeitas foram bloqueadas? | Contas bloqueadas, sessões e tokens encerrados, e a que horas | Uma sessão aberta continua valendo depois do bloqueio da conta ou da troca da senha |
| 28 | Cada bloqueio foi registrado com dono, prazo e forma de desfazer? | Uma entrada na linha do tempo por bloqueio | Medida de emergência sem prazo vira configuração permanente que ninguém sabe explicar |
| 29 | A contenção foi conferida? | O teste que mostra que o ativo isolado não alcança mais os vizinhos, e o horário da última atividade suspeita observada | Bloqueio aplicado no lugar errado dá a sensação de contenção com o caminho ainda aberto |

## Erradicação e credenciais

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 30 | O ponto de entrada foi fechado? | Falha corrigida, serviço retirado ou caminho contido, e como isso foi conferido | Sem isso, o invasor volta pelo mesmo caminho |
| 31 | As credenciais ao alcance foram trocadas, depois da contenção e começando pelas de maior alcance? | Lista das credenciais, ordem da troca e sessões encerradas | [Trocar credenciais na ordem certa](recomendacoes-para-incidentes.md#trocar-credenciais-na-ordem-certa): trocar a senha enquanto o invasor ainda lê o arquivo só entrega a senha nova |
| 32 | Foi procurado o que o invasor deixou para voltar? | Contas e chaves SSH novas, tarefas agendadas, regras de `sudo`, permissões e service accounts criadas no cluster, workloads desconhecidos e alterações em projetos e credenciais do Ansible Automation Platform | Um acesso esquecido desfaz todo o trabalho de contenção |
| 33 | Os componentes comprometidos serão reconstruídos a partir de fonte confiável? | De onde vem a reconstrução: imagem, automação ou mídia de instalação, e quem conferiu a origem | Não há como provar que um sistema invadido com privilégio de administrador foi limpo por completo |

## Voltar os serviços com segurança

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 34 | O critério para voltar está definido e foi aprovado pelo responsável pelo incidente? | O que precisa ser verdade para o serviço voltar, e quem aprovou | Sob pressão, o serviço volta antes de o caminho estar fechado |
| 35 | O backup usado é anterior ao comprometimento e foi conferido? | Data do backup, data do evento mais antigo encontrado e como a cópia foi conferida | Restaurar um backup já comprometido devolve o acesso ao invasor |
| 36 | O caminho usado pelo invasor está fechado nos componentes que voltam? | Correção ou controle aplicado, e a avaliação que confirma | Um componente reconstruído igual ao anterior tem a mesma falha. Procure o controle correspondente no [catálogo](../catalogo/INDICE.md) |
| 37 | O retorno é gradual e com monitoramento reforçado? | Ordem de retorno, quem acompanha os logs e os alertas, e por quanto tempo | Os primeiros dias depois do retorno mostram se sobrou algum acesso |
| 38 | As partes interessadas foram comunicadas? | Usuários, áreas de negócio e, quando exigido, autoridades e titulares de dados, com data | As obrigações de comunicação podem ter prazo: confirme com a área jurídica |

## Encerramento

| # | Verificação | O que registrar | Por que importa |
|---|---|---|---|
| 39 | Cada medida de emergência foi tornada permanente ou removida? | A decisão, a data e o responsável, medida por medida | Ver [Encerrar o incidente](recomendacoes-para-incidentes.md#encerrar-o-incidente): a medida que fica passa a ser tratada como controle |
| 40 | O destino das evidências foi definido? | Prazo de retenção, responsável pela guarda e data de descarte | Cópias de disco e de log esquecidas guardam credenciais e dados sensíveis sem dono |
| 41 | O relatório do incidente foi escrito? | Linha do tempo, causa, impacto e ações, cada uma com responsável e prazo | É o que transforma o caminho percorrido pelo invasor em controle permanente |
| 42 | As avaliações do catálogo foram rodadas nos componentes envolvidos? | Controles avaliados e lacunas levadas ao plano de ação | O caminho que o invasor percorreu indica quais controles de contenção e de detecção faltavam |

## Referências

- [NIST SP 800-61 Rev. 3 — Incident Response Recommendations and Considerations for Cybersecurity Risk Management](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [CERT.br — Centro de Estudos, Resposta e Tratamento de Incidentes de Segurança no Brasil](https://www.cert.br/)
- [Recomendações gerais para incidentes](recomendacoes-para-incidentes.md) e [avaliação básica de processos](avaliacao-de-processos.md)
