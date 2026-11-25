---
id: LS-AAP-003
titulo: Reservar o System Administrator a contas de emergência
tecnologia: aap
pilar: prevenir
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior
status: rascunho
---

# LS-AAP-003 — Reservar o System Administrator a contas de emergência

## Problema

Um usuário do tipo System Administrator (no AAP 2.5 ou superior, **Ansible Automation Platform Administrator**) tem leitura e escrita sobre toda a instalação: todas as organizações, todos os inventários, todas as credenciais e todas as configurações. Com essa conta é possível executar qualquer comando em qualquer servidor gerenciado.

É comum que várias pessoas usem esse tipo de conta no dia a dia, ou que todas compartilhem o usuário `admin` criado na instalação. Cada uma dessas sessões é um caminho direto para o ambiente inteiro: basta uma estação comprometida ou uma senha vazada.

## Benefício

O comprometimento da conta de um operador passa a dar ao invasor apenas o que aquele operador podia fazer: os job templates e inventários do time dele, e não a plataforma inteira.

O acesso total continua existindo, mas fica guardado para emergências. Como ele deixa de ser usado na rotina, qualquer login com essa conta passa a ser um evento raro, fácil de alertar e de investigar.

## Pré-requisitos

- Usuários nominais para o dia a dia, de preferência pelo provedor de identidade ([LS-AAP-008](LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md)).
- Um local seguro para guardar a senha da conta de emergência, com acesso controlado e registrado.
- Saber quais tarefas da rotina dependem hoje de privilégio total.

## Avaliação

No automation controller 2.4:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/users/?is_superuser=true" | jq -r '.results[].username'
```

No AAP 2.5 ou superior, os usuários passaram para a API do gateway (`/api/gateway/v1/users/`). O caminho mais seguro é a tela **Access Management > Users**, coluna **User type**. Contas migradas de versões anteriores podem aparecer como *Normal* e ainda assim ter administração de um serviço (Automation Execution, Automation Decisions ou Automation Content): abra o usuário para conferir.

Verifique também se algum mapeamento do provedor de identidade concede privilégio de administrador a um grupo inteiro.

Interpretação:

- Mais administradores do que contas de emergência previstas (uma ou duas): **exposto**.
- Usuários nominais de uso diário como administradores: **exposto**.
- A conta `admin` usada por mais de uma pessoa, ou com `last_login` recente sem incidente registrado: **exposto**.

## Implementação

**1. Definir as contas de emergência.** Mantenha uma ou duas contas locais com privilégio total. A conta `admin` padrão pode ser uma delas; a documentação avisa que removê-la faz instalações e upgrades falharem. Troque a senha por uma longa e aleatória e guarde-a em local com acesso controlado, de preferência com custódia dividida entre duas pessoas.

**2. Delegar a rotina com papéis de menor alcance.** Substitua o privilégio total por papéis no nível da organização (administrador da organização, administrador de projetos, de inventários, de job templates) e por papéis em objetos concedidos a times. Para quem só precisa consultar, use o tipo auditor, que é somente leitura.

**3. Remover o privilégio das contas nominais.** Desmarque o tipo administrador dos usuários de uso diário e corrija os mapeamentos do provedor de identidade que o concedem a grupos amplos.

**4. Manter o caminho de emergência funcionando.** Teste a conta de emergência em intervalos definidos e troque a senha depois de cada uso. No AAP 2.6 ou superior, desativar o autenticador local bloqueia também a conta `admin`; se a conta de emergência é local, mantenha esse autenticador ativo.

## Validação

- A lista de administradores contém apenas as contas de emergência.
- Um operador comum executa os job templates do seu time e não enxerga credenciais, inventários ou configurações de outras organizações.
- O teste periódico da conta de emergência funciona e aparece nos logs.

## Reversão

Com a conta de emergência, marque novamente o usuário como administrador em **Users**. A mudança é imediata.

## Impacto operacional

- Algumas tarefas exigem privilégio total: configurações globais, licença, grupos de instâncias, métodos de autenticação. Elas passam a seguir o procedimento de emergência ou uma janela planejada. Se isso ocorrer toda semana, faltam papéis delegados, e não mais administradores.
- O instalador usa a senha do `admin` em upgrades, backups e restaurações. Guarde-a como descrito em [LS-AAP-006](LS-AAP-006-senhas-do-instalador-em-vault.md) e atualize o arquivo quando a senha mudar.
- Conta de emergência que nunca é testada não funciona no dia em que é necessária: senha expirada, autenticador desativado ou cofre inacessível são falhas comuns.

## Detecção

- **Login de uma conta de emergência.** Deve corresponder a um incidente ou a um teste registrado. Fora disso, trate como incidente.
- **Usuário que passa a ser administrador.** O activity stream registra a alteração do usuário e quem a fez.
- **Criação de novo usuário local.**

Esses eventos precisam chegar ao destino central para não depender da própria plataforma: [LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (Managing access with role-based access control; Users).
- Documentação do Ansible Automation Platform 2.4: *Automation controller user guide* (Managing Users in automation controller).
- Documentação do Ansible Automation Platform: *Hardening and compliance*, recomendação de reservar contas locais, como `admin`, para acesso de emergência.
