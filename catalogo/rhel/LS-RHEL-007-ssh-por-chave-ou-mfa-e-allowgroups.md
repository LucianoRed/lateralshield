---
id: LS-RHEL-007
titulo: Exigir chave ou MFA no SSH e restringir o acesso com AllowGroups
tecnologia: rhel
pilar: conter
impacto: alto
esforco: medio
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-007 — Exigir chave ou MFA no SSH e restringir o acesso com AllowGroups

## Problema

Por padrão, toda conta com shell válido e senha pode entrar por SSH. Isso inclui contas de serviço, contas de aplicação, contas de teste esquecidas e qualquer usuário do diretório central que resolva no servidor.

Para quem se move lateralmente, cada uma dessas contas é uma porta. A senha de uma conta de aplicação encontrada em um arquivo de configuração, ou uma senha fraca descoberta por tentativa, basta para abrir sessão no servidor vizinho — mesmo que a conta nunca tenha sido criada para login interativo.

O [LS-RHEL-001](LS-RHEL-001-ssh-somente-de-origens-administrativas.md) limita **de onde** o SSH é aceito. Este controle limita **quem** entra e **com o quê**.

## Benefício

Uma senha roubada deixa de ser suficiente para abrir sessão: o servidor exige uma chave ou um segundo fator. E mesmo com a credencial certa, só entra quem pertence ao grupo de acesso; contas de serviço e contas esquecidas ficam de fora por construção.

A lista de quem acessa cada servidor passa a ser a lista de membros de um grupo, fácil de revisar. E uma tentativa de login de conta fora do grupo vira um registro explícito no log.

## Pré-requisitos

- [LS-RHEL-001](LS-RHEL-001-ssh-somente-de-origens-administrativas.md) aplicado ou planejado.
- Um grupo de acesso por tipo de servidor, local ou do diretório central, com as contas nominais dos administradores ([LS-RHEL-004](LS-RHEL-004-sem-login-de-root.md)).
- O nome da conta usada pela automação, que também precisa entrar.
- Chaves públicas dos administradores já distribuídas, ou o segundo fator já funcionando no diretório.
- Acesso de console fora de banda.

## Avaliação

```bash
sshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|challengeresponseauthentication|pubkeyauthentication|authenticationmethods|permitemptypasswords|allowgroups|allowusers|denygroups|denyusers) '
awk -F: '$7 !~ /(nologin|false)$/ {print $1}' /etc/passwd
journalctl -u sshd --since "30 days ago" | grep -oE 'Accepted \S+ for \S+' | sort | uniq -c
```

Indicadores de exposição:

- Nenhuma linha `allowgroups` ou `allowusers`: qualquer conta com shell entra.
- `passwordauthentication yes` com `authenticationmethods any`: uma senha sozinha basta.
- Contas de serviço com shell válido na saída do segundo comando.
- O terceiro comando mostra quem entra de fato e por qual método. Contas que aparecem ali e não deveriam são achado; as demais formam a lista inicial do grupo.

Quando há blocos `Match`, confira o resultado para um usuário específico com `sshd -T -C user=<usuario>,host=<nome>,addr=<ip-de-origem>`.

## Implementação

**1. Montar o grupo de acesso.** Inclua os administradores e a conta de automação:

```bash
groupadd ls-ssh
usermod --append -G ls-ssh <administrador>
usermod --append -G ls-ssh <conta-de-automacao>
```

**2. Configurar o sshd.** No RHEL 9, crie `/etc/ssh/sshd_config.d/11-lateralshield-acesso.conf`; no RHEL 7 e 8, que não têm esse diretório, ajuste `/etc/ssh/sshd_config`.

Opção A — somente chave:

```
AllowGroups ls-ssh
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
```

Opção B — chave e um segundo fator para pessoas, somente chave para a automação:

```
AllowGroups ls-ssh
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication yes
AuthenticationMethods publickey,keyboard-interactive

Match User <conta-de-automacao>
    AuthenticationMethods publickey
```

Na opção B, o sshd só aceita a sessão depois da chave **e** da etapa interativa, que é conduzida pelo PAM (`UsePAM yes`). O que essa etapa pede depende do PAM: a senha do usuário ou, em ambientes com um diretório que ofereça senha de uso único (como o Identity Management), a senha mais o código. Este controle não foi validado com um provedor de segundo fator específico; confira o comportamento na documentação do diretório em uso antes de aplicar.

No RHEL 7 e 8, a diretiva `KbdInteractiveAuthentication` se chama `ChallengeResponseAuthentication`.

**3. Aplicar com uma sessão aberta.**

```bash
sshd -t && systemctl reload sshd
```

Mantenha a sessão atual e abra uma **nova** para testar. Na opção B, confirme o resultado efetivo para um administrador e para a conta de automação com `sshd -T -C user=<usuario>,host=<nome>,addr=<ip-de-origem>`, já que o bloco `Match` muda o que vale para cada um. Defina `AllowGroups` em um único lugar: quando existe `AllowUsers` ou `DenyUsers` em outro arquivo, as diretivas se combinam e o resultado pode ser mais restritivo do que o esperado.

**4. Tirar o shell das contas de serviço** que não precisam de login: `usermod -s /sbin/nologin <conta>`. Confirme antes que nenhuma rotina usa `su - <conta>`.

## Validação

- Administrador do grupo, com chave (e segundo fator, na opção B): entra.
- Conta fora do grupo, mesmo com a credencial correta: recusada.
- `ssh -o PubkeyAuthentication=no <usuario>@<servidor>`: recusado sem pedir senha (opção A).
- Um job do Ansible Automation Platform contra o servidor executa normalmente.
- `sshd -T | grep -E '^(allowgroups|authenticationmethods) '` mostra o configurado.

## Reversão

Remova o arquivo `11-lateralshield-acesso.conf` (ou restaure as diretivas em `/etc/ssh/sshd_config`) e execute `sshd -t && systemctl reload sshd`. O grupo pode permanecer.

## Impacto operacional

- Quem não estiver no grupo perde o acesso no momento do `reload`, incluindo contas usadas por ferramentas de backup, monitoramento e transferência de arquivos. O levantamento da avaliação existe para isso.
- Com grupo de diretório central, a indisponibilidade do diretório pode impedir a resolução do grupo e bloquear o acesso. Mantenha uma conta local de emergência em um grupo local também listado em `AllowGroups`.
- A opção B não serve para contas não interativas; por isso o bloco `Match` para a automação. A conta de automação continua protegida pela restrição de origem do [LS-AAP-001](../aap/LS-AAP-001-chave-de-automacao-restrita.md).
- Novo administrador passa a exigir duas ações: chave (ou segundo fator) e inclusão no grupo.
- A chave privada dos administradores passa a ser a credencial crítica. Ela deve ter senha e não pode ficar em servidores ([LS-RHEL-001](LS-RHEL-001-ssh-somente-de-origens-administrativas.md)).

## Detecção

O sshd registra a recusa de contas fora do grupo:

```bash
journalctl -u sshd | grep -E 'not allowed because none of user.s groups are listed in AllowGroups'
```

Depois do controle, essa mensagem significa que alguém tem uma credencial válida de uma conta que não deveria entrar por SSH — tipicamente uma conta de serviço. Encaminhe ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)) e alerte, junto com sequências de falhas de autenticação para o mesmo usuário vindas de um servidor interno.

Mudanças na composição do grupo são registradas pela chave `ls_identidade` do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

## Referências

- Documentação do RHEL: *Securing networks* (Using secure communications between two systems with OpenSSH).
- `sshd_config(5)`: `AllowGroups`, `AuthenticationMethods`, `KbdInteractiveAuthentication`, `Match`.
- `sshd(8)`, opções `-T` e `-C`.
