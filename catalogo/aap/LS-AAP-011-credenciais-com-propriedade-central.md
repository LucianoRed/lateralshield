---
id: LS-AAP-011
titulo: Centralizar a propriedade das credenciais e conceder aos times apenas o papel Use
tecnologia: aap
pilar: conter
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior
status: rascunho
---

# LS-AAP-011 — Centralizar a propriedade das credenciais e conceder aos times apenas o papel Use

## Problema

No AAP, quem administra uma credencial pode alterá-la, trocar o segredo, associá-la a outros job templates e conceder acesso a outras pessoas. Quando cada time cria e administra as próprias credenciais, ou quando elas pertencem a usuários individuais, ninguém sabe ao certo quantas credenciais com acesso a produção existem, quem pode usá-las e quem pode repassá-las.

Para o invasor, isso significa que a conta de qualquer membro de qualquer time pode ser suficiente para ampliar o próprio acesso: ele concede a si mesmo, ou a outra conta que controla, o uso de uma credencial privilegiada, e a mudança se perde entre muitas outras.

## Benefício

O número de contas capazes de alterar ou redistribuir credenciais cai para o do time da plataforma. Comprometer a conta de um operador dá ao invasor o uso das credenciais daquele time, nos job templates daquele time, mas não a capacidade de ampliar esse acesso nem de trocar segredos.

A operação passa a ter um inventário confiável: toda credencial pertence a uma organização, tem um responsável e uma lista curta de times que podem usá-la.

## Pré-requisitos

- Um time responsável pela plataforma, com capacidade de atender pedidos de criação e rotação.
- Usuários organizados em times no AAP, de preferência a partir de grupos do provedor de identidade ([LS-AAP-008](LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md)).
- Os segredos atuais em mãos. O AAP não devolve segredos pela interface nem pela API; migrar uma credencial exige cadastrá-la de novo.

## Avaliação

Pela interface, abra cada credencial e veja as abas de acesso de usuários e de times. No automation controller 2.4, pela API:

```bash
# credenciais sem organização (pertencem a usuários)
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/credentials/?organization__isnull=true" | jq -r '.results[].name'

# quem tem acesso a uma credencial, e com quais papéis
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/credentials/<id>/access_list/" \
  | jq -r '.results[] | [.username, ([.summary_fields.direct_access[].role.name] | join(","))] | @tsv'
```

No AAP 2.5 ou superior, os nomes dos papéis e os caminhos da API mudam; use as abas de acesso da credencial e confira os caminhos na raiz `/api/` da instalação.

Indicadores de exposição:

- Credenciais sem organização, pertencentes a usuários individuais.
- Papel de administração de credenciais nas mãos de usuários ou times fora do time da plataforma.
- Papéis concedidos diretamente a usuários, e não a times.
- Credenciais duplicadas com o mesmo segredo em organizações diferentes.

## Implementação

**1. Colocar toda credencial em uma organização.** O time da plataforma cria as credenciais na organização correspondente. Credenciais pessoais são recriadas na organização; aproveite para trocar o segredo, já que ele precisará ser digitado de novo.

**2. Reservar a administração ao time da plataforma.** Remova o papel de administração da credencial de usuários e times de fora. No nível da organização, o papel de administrador de credenciais também fica restrito a esse time.

**3. Conceder apenas o uso, e a times.** O papel **Use** permite selecionar a credencial em um job template sem ver nem alterar o segredo. Conceda-o ao time, nunca ao usuário individual, para que a entrada e a saída de pessoas sejam tratadas no grupo.

**4. Para as credenciais mais sensíveis, não conceder nem o uso.** Quem tem **Use** e também pode criar ou editar job templates consegue executar qualquer playbook com aquela credencial, nos inventários a que tem acesso. Para credenciais de produção com privilégio alto, o time da plataforma prepara os job templates e concede aos demais apenas a execução deles.

**5. Fechar a criação fora do processo.** Verifique, na versão em uso, se usuários comuns conseguem criar credenciais pessoais e trate essa possibilidade na revisão periódica: credencial sem organização é desvio.

## Validação

Com um usuário comum de um time:

- a credencial aparece e pode ser selecionada em um job template do time;
- os campos de segredo não podem ser lidos nem alterados;
- o usuário não consegue conceder a credencial a outra pessoa ou time.

A consulta de credenciais sem organização não retorna nada.

## Reversão

Conceda novamente o papel de administração da credencial ao time ou usuário que o tinha. A mudança é imediata e não afeta os job templates existentes.

## Impacto operacional

- O time da plataforma passa a ser caminho obrigatório para criar e rotacionar credenciais. Sem um prazo de atendimento combinado, os times voltam a criar credenciais por fora.
- Rotação de segredos deixa de ser feita por quem é dono do sistema de destino; combine como o novo segredo chega ao time da plataforma sem trafegar em mensagens.
- Job templates que pedem credencial no lançamento continuam funcionando apenas com as credenciais em que o usuário tem **Use**.

## Detecção

No activity stream, alerte para:

- criação de credencial por usuário fora do time da plataforma;
- concessão de papel de administração em qualquer credencial;
- concessão de **Use** em credencial de produção a time que nunca a teve;
- alteração de uma credencial existente fora de uma rotação registrada.

Esses eventos precisam sair da plataforma para serem úteis: [LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md). A separação por ambiente, que define quais credenciais merecem mais atenção, está em [LS-AAP-009](LS-AAP-009-credenciais-por-finalidade-e-ambiente.md).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Using automation execution* (Managing user credentials) e *Access management and authentication* (Managing access with role-based access control).
- Documentação do Ansible Automation Platform 2.4: *Automation controller user guide* (credenciais; papéis e acesso baseado em papéis).
- Documentação do Ansible Automation Platform: *Configuring automation execution* (Secret handling and connection security).
