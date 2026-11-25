---
id: LS-AAP-004
titulo: Restringir o acesso ao sistema operacional dos nós do AAP
tecnologia: aap
pilar: conter
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior, instalado em RHEL 8 e 9 (RPM ou contêiner)
status: rascunho
---

# LS-AAP-004 — Restringir o acesso ao sistema operacional dos nós do AAP

## Problema

Os controles de acesso da interface do AAP não valem para quem entra no sistema operacional dos nós. Nesses servidores estão a chave que decifra as credenciais guardadas no banco, a senha do banco de dados e os certificados da plataforma. Esses arquivos ficam sem criptografia, porque os serviços precisam lê-los ao iniciar, e são protegidos apenas por permissões UNIX: `root` e a conta de serviço `awx` conseguem lê-los.

Portanto, qualquer pessoa ou processo que vire `root`, `awx` ou `postgres` em um nó da plataforma tem, na prática, todas as credenciais que a automação usa. Um `sudo` concedido por conveniência a um time de suporte ou a uma conta de monitoramento transforma esse nó no atalho para o ambiente inteiro.

## Benefício

O caminho para as credenciais da automação passa a ser um só: a interface e a API do AAP, com autenticação, papéis e registro. Comprometer uma conta comum de sistema operacional em um nó da plataforma deixa de dar acesso à chave e ao banco.

O número de pessoas capazes de extrair as credenciais do ambiente inteiro cai para o pequeno grupo que mantém a plataforma, e cada entrada desse grupo nos nós fica registrada.

## Pré-requisitos

- Lista nominal de quem mantém a plataforma.
- Acesso de console fora de banda aos nós, para o caso de bloqueio acidental.
- Saber qual conta o instalador usa para se conectar aos nós.

## Avaliação

Em cada nó da plataforma (controller, banco de dados, hub, gateway, nós de execução):

```bash
getent group wheel
grep -rEs '^[^#]*\b(awx|postgres)\b' /etc/sudoers /etc/sudoers.d/
sudo -l -U awx
sudo -l -U postgres
passwd -S awx postgres
ls -l ~awx/.ssh/authorized_keys ~postgres/.ssh/authorized_keys 2>/dev/null
awk -F: '$7 !~ /(nologin|false)$/ {print $1}' /etc/passwd
```

Indicadores de exposição:

- Membros de `wheel`, ou de outro grupo com `sudo`, que não mantêm a plataforma.
- Qualquer regra de `sudo` em que `awx` ou `postgres` aparecem: seja concedendo privilégio a essas contas, seja permitindo que outro usuário se torne uma delas (`(awx)`, `(postgres)`).
- `awx` ou `postgres` com senha definida (o esperado em `passwd -S` é `LK`) ou com `authorized_keys`.
- Contas com shell de login além das de serviço e das dos administradores.

Na instalação em contêiner, os serviços rodam no Podman de um usuário dedicado, e os segredos da plataforma ficam nos Podman secrets desse usuário. Aplique as mesmas perguntas a essa conta.

## Implementação

**1. Limitar quem entra.** Só os administradores nominais da plataforma devem ter login nos nós. Restrinja o SSH ao grupo deles ([LS-RHEL-007](../rhel/LS-RHEL-007-ssh-por-chave-ou-mfa-e-allowgroups.md)) e às origens administrativas ([LS-RHEL-001](../rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md)). Usuários da automação não precisam de conta no sistema operacional.

**2. Remover o `sudo` que envolve as contas de serviço.** Apague as regras encontradas na avaliação e valide com `visudo -c`. O guia de hardening do AAP é direto: não conceda `sudo` para `root` nem para `awx` a usuários não confiáveis, e lembre que restringir o `sudo` a comandos específicos não protege quando o comando permite abrir um shell ou alterar arquivos. Para o restante, siga [LS-RHEL-005](../rhel/LS-RHEL-005-sudo-de-menor-privilegio.md).

**3. Manter as contas de serviço sem login.** As contas `postgres`, `awx`, `redis`, `receptor` e `nginx` precisam existir localmente, mas não precisam de senha nem de chave SSH:

```bash
passwd -l awx
passwd -l postgres
```

Remova `authorized_keys` dessas contas, se existir.

**4. Tratar ferramentas que rodam nos nós.** Agentes de monitoramento, backup e inventário que executam como `root` nesses servidores têm o mesmo alcance de um administrador da plataforma. Reduza-os ao necessário.

## Validação

- Um usuário fora do grupo de administradores não consegue abrir sessão nos nós.
- `sudo -l -U awx` e `sudo -l -U postgres` informam que o usuário não pode executar `sudo`.
- A interface do AAP continua funcionando e um job de teste executa normalmente.

## Reversão

Restaure as regras removidas de `/etc/sudoers.d/` (guarde uma cópia antes de apagar) e, se necessário, desbloqueie a conta com `passwd -u <conta>`.

## Impacto operacional

- O instalador se conecta aos nós por SSH e eleva privilégio. Preserve a conta usada por ele, ou upgrades e backups falham. Se a política exigir senha no `sudo`, a documentação indica executar o instalador pedindo a senha de elevação.
- Diagnósticos que usavam `sudo -u awx` ou `su - postgres` passam a exigir um administrador da plataforma. O comando `awx-manage` continua disponível para `root`.
- Times que acessavam os nós para ler logs deixam de conseguir. Dê a eles os logs no destino central ([LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md)).

## Detecção

- Sessões SSH abertas nos nós da plataforma e todo uso de `sudo`, `su` e `sudo -u awx` neles. As regras de auditoria de [LS-RHEL-003](../rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md) cobrem esses eventos.
- Alterações em `/etc/sudoers`, `/etc/sudoers.d/` e nos grupos administrativos.

Os nós do AAP devem estar entre os primeiros servidores a encaminhar logs para o destino central ([LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md)): entrada de alguém fora da lista de administradores é motivo de alerta imediato.

## Referências

- Documentação do Ansible Automation Platform: *Hardening and compliance* (2.5) e *Red Hat Ansible Automation Platform hardening guide* (2.4), seções sobre acesso aos servidores da plataforma, contas locais e `sudo`.
- Documentação do Ansible Automation Platform: *Configuring automation execution* (Secret handling and connection security; Security best practices).
- `sudoers(5)`, `passwd(1)`.
