---
id: LS-AAP-002
titulo: Exigir MFA no provedor de identidade usado pelo AAP
tecnologia: aap
pilar: prevenir
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior, com autenticação externa
status: rascunho
---

# LS-AAP-002 — Exigir MFA no provedor de identidade usado pelo AAP

## Problema

O Ansible Automation Platform dispara jobs com credenciais que alcançam quase todos os servidores do ambiente. Quando o login na plataforma depende apenas de usuário e senha, uma senha obtida por phishing, reutilizada de outro serviço ou lida em uma estação comprometida basta para que o invasor execute automação privilegiada em nome de um operador.

Nesse cenário o invasor não precisa explorar nenhum servidor: ele entra pela porta da frente e usa a própria automação para se mover.

## Benefício

Uma senha vazada, sozinha, deixa de abrir o AAP. Para chegar à automação o invasor passa a precisar também do segundo fator do usuário. Phishing simples de senha e reutilização de senha de outro serviço deixam de ser suficientes.

Como o MFA é aplicado no provedor de identidade, a regra vale para todos os usuários que entram por ele, sem configurar nada usuário a usuário no AAP.

## Pré-requisitos

- Autenticação externa já configurada no AAP ([LS-AAP-008](LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md)). O MFA é uma função do provedor de identidade corporativo, não do AAP: a documentação consultada não descreve segundo fator nativo para contas locais.
- Um provedor de identidade com suporte a MFA e que conduza a tela de login (SAML ou OIDC). O Red Hat build of Keycloak é um exemplo.
- Conta de emergência definida e testada ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md)), para o caso de o provedor de identidade ficar indisponível.

## Avaliação

1. Liste os métodos de autenticação ativos. No AAP 2.5 ou superior: **Access Management > Authentication Methods**. No AAP 2.4: **Settings > Authentication** do automation controller.
2. Para cada método externo, verifique no provedor de identidade se a política aplicada à aplicação do AAP exige segundo fator.
3. Faça o teste direto: entre com um usuário de teste que não tenha segundo fator cadastrado.

Interpretação:

- Só existe o método local, ou o login externo conclui sem pedir segundo fator: **exposto**.
- O método externo é do tipo em que a senha é digitada na tela do próprio AAP (LDAP, por exemplo): o segundo fator depende do que o serviço de diretório oferece e, em geral, não é aplicado. Trate como exposto até provar o contrário.
- MFA exigido só para alguns grupos: verifique se todos os usuários com acesso a credenciais e job templates de produção estão cobertos.

## Implementação

**1. Usar um método em que o login acontece no provedor de identidade.** SAML e OIDC redirecionam o usuário para a página do provedor, onde o segundo fator é exigido. Se hoje o AAP usa LDAP direto, a troca de método faz parte de [LS-AAP-008](LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md).

**2. Exigir o segundo fator na política da aplicação.** No provedor de identidade, marque o segundo fator como obrigatório para a aplicação (cliente) que representa o AAP. No Red Hat build of Keycloak, isso é feito no fluxo de autenticação do realm ou do cliente. Comece pelos administradores e por quem opera produção e, em seguida, estenda a todos.

**3. Tratar o que fica fora do MFA.**

- Contas locais: restrinja-as às contas de emergência ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md)).
- Tokens de API: um token emitido continua válido sem segundo fator. Revise os tokens existentes, defina validade curta e emita tokens apenas para integrações que precisam deles. No automation controller 2.4, a opção **Allow External Users to Create OAuth2 Tokens** controla se usuários externos podem criar tokens; confira a opção equivalente na versão em uso.
- No AAP 2.4, o Event-Driven Ansible controller aceita apenas contas locais, segundo o guia de hardening. Trate essas contas como as de emergência: poucas, nominais e com senha forte.

## Validação

- O login pelo provedor de identidade pede o segundo fator.
- O usuário de teste sem segundo fator cadastrado não consegue entrar.
- A conta de emergência continua funcionando, e o uso dela gera registro.

## Reversão

Desfaça a exigência de segundo fator na política da aplicação no provedor de identidade. Nada muda no AAP.

## Impacto operacional

- Os usuários precisam cadastrar o segundo fator antes da virada; avise com antecedência e tenha um procedimento para perda do dispositivo.
- Scripts e integrações que entram na API com usuário e senha deixam de funcionar. Migre-os para tokens de contas de integração nominais, com papéis mínimos.
- Com o provedor de identidade indisponível, ninguém entra além da conta de emergência. Jobs agendados continuam rodando, porque não dependem de login.

## Detecção

- No provedor de identidade: falhas repetidas de segundo fator para um mesmo usuário indicam que a senha já está nas mãos de outra pessoa.
- No AAP: login por conta local enquanto o provedor de identidade está disponível, e criação de tokens fora do padrão.

Esses registros só servem se saírem dos dois sistemas: encaminhe os logs do AAP conforme [LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md) e os do provedor de identidade para o mesmo destino central.

## Referências

- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (Configuring authentication in the Ansible Automation Platform).
- Documentação do Ansible Automation Platform: *Hardening and compliance* (2.5) e *Red Hat Ansible Automation Platform hardening guide* (2.4), seções sobre autenticação externa e contas locais.
- Documentação do Red Hat build of Keycloak: *Server Administration Guide* (Configuring authentication).
