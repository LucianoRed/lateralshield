---
id: LS-RHEL-004
titulo: Bloquear o login de root e usar contas nominais com sudo
tecnologia: rhel
pilar: conter
impacto: alto
esforco: medio
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-004 — Bloquear o login de root e usar contas nominais com sudo

## Problema

Quando a equipe administra os servidores entrando diretamente como `root`, a mesma credencial vale para várias pessoas e, quase sempre, para vários servidores. Quem obtém essa senha ou essa chave em um host — em um script, em um histórico de shell, em um backup — entra nos demais com privilégio total.

Há um segundo efeito: o registro mostra apenas "root". Não dá para saber qual pessoa executou o quê, nem distinguir o administrador do invasor que usa a mesma conta.

## Benefício

A senha de `root` deixa de ser uma credencial que abre vários servidores. Para chegar a privilégio total, o invasor precisa comprometer a conta de uma pessoa específica, que tem autenticação própria e pode ser bloqueada sozinha, sem trocar senha em todo o ambiente.

Cada ação privilegiada passa a ter um nome associado. A saída de um administrador da equipe vira a desativação de uma conta, e não a troca de uma senha compartilhada. E um login direto como `root`, que deixa de fazer parte da rotina, passa a ser um alerta.

## Pré-requisitos

- Contas nominais para todos os administradores, locais ou de um diretório central (por exemplo, Identity Management).
- Acesso de console fora de banda (console da VM, iLO/iDRAC) e um procedimento de emergência definido para quando o `sudo` ou o diretório estiverem indisponíveis.
- Levantamento de rotinas que hoje entram como `root`: scripts, cópias por `scp`, ferramentas de backup e monitoramento.

## Avaliação

```bash
passwd -S root
sshd -T | grep -E '^permitrootlogin '
awk -F: '$3 == 0 {print $1}' /etc/passwd
grep -cvE '^\s*(#|$)' /root/.ssh/authorized_keys 2>/dev/null
last -n 10 root
getent group wheel
grep -E '^\s*auth\s+required\s+pam_wheel' /etc/pam.d/su || echo "su liberado para qualquer usuário"
```

Indicadores de exposição:

- `passwd -S root` mostra senha utilizável (`PS`) e ninguém sabe dizer se ela é única deste servidor.
- `permitrootlogin` diferente de `no`.
- Mais de uma conta com UID 0.
- Chaves em `/root/.ssh/authorized_keys`: cada uma é um login direto como `root`.
- `last` mostra logins recentes de `root` vindos da rede.
- Grupo `wheel` vazio, ou com contas genéricas e de serviço.

## Implementação

**1. Garantir o caminho novo antes de fechar o antigo.** Cada administrador entra com a própria conta e eleva com `sudo`:

```bash
usermod --append -G wheel <usuario>
sudo -l -U <usuario>
```

Peça a cada administrador que abra uma sessão com a conta nominal e execute `sudo -v`. O escopo das regras de `sudo` é assunto do [LS-RHEL-005](LS-RHEL-005-sudo-de-menor-privilegio.md).

**2. Fechar o login remoto de root.** O `PermitRootLogin no` faz parte do [LS-RHEL-001](LS-RHEL-001-ssh-somente-de-origens-administrativas.md). Complete removendo as chaves de `/root/.ssh/authorized_keys`, depois de migrar as rotinas que as usavam para uma conta dedicada.

**3. Tratar a senha de root.** Escolha uma das duas opções e registre a decisão:

- *Bloquear a senha:* `passwd -l root`. Nenhum login por senha como `root` funciona mais, nem no console.
- *Manter uma senha de emergência:* aleatória, **diferente em cada servidor**, guardada em cofre e usada somente no console. É a opção indicada quando o procedimento de recuperação depende do modo de emergência do sistema.

**4. Restringir o `su` ao grupo de administradores.** Em `/etc/pam.d/su`, remova o comentário da linha:

```
auth            required        pam_wheel.so use_uid
```

Com isso, uma conta de serviço invadida não consegue usar `su` para `root`, mesmo que o invasor conheça a senha.

**5. Eliminar contas extras com UID 0** encontradas na avaliação.

No RHEL 8 e 9, o módulo `pam_securetty` vem desativado e o arquivo `/etc/securetty` não é mais distribuído. Em servidores migrados do RHEL 7, uma restrição feita por esse arquivo não foi levada adiante.

## Validação

- Com conta nominal: `ssh <usuario>@<servidor>` e `sudo -i` funcionam.
- `ssh root@<servidor>` é recusado.
- De uma conta fora do grupo `wheel`, `su -` falha mesmo com a senha correta.
- `passwd -S root` mostra a senha bloqueada (`LK`), se essa foi a opção.
- As rotinas levantadas nos pré-requisitos continuam funcionando com a conta dedicada.

## Reversão

```bash
passwd -u root                      # desbloqueia a senha de root
```

Comente novamente a linha do `pam_wheel` em `/etc/pam.d/su`. Para o SSH, veja a reversão do [LS-RHEL-001](LS-RHEL-001-ssh-somente-de-origens-administrativas.md).

## Impacto operacional

- **Recuperação do sistema.** Com a senha de `root` bloqueada, os modos de emergência e de recuperação do systemd não abrem o shell: o sistema informa que a conta de `root` está bloqueada. A recuperação passa a exigir inicialização por mídia de resgate ou alteração dos parâmetros de boot. Decida isso antes de bloquear, e teste o procedimento em um servidor.
- Se o diretório central ficar indisponível e não houver conta local de emergência com `sudo`, ninguém administra o servidor. Mantenha uma conta local de emergência, com senha em cofre e uso alertado.
- Scripts e ferramentas que entram como `root` param. Migre-os para contas dedicadas com `sudo` restrito.
- O `pam_wheel` não afeta o `sudo`, mas afeta qualquer procedimento que dependa de `su` a partir de contas fora do grupo.

## Detecção

Depois do controle, qualquer tentativa de entrar como `root` é anômala. Os sinais ficam em `/var/log/secure` e no journal, e precisam chegar ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)):

```bash
journalctl -u sshd | grep -iE 'for root from|ROOT LOGIN REFUSED'
journalctl _COMM=su | grep -i 'fail'
ausearch -m USER_LOGIN,USER_AUTH -sv no -i -ts today | grep -w 'acct=root'
```

Alerte para tentativas de login como `root` pela rede, falhas de `su` para `root` e qualquer login de `root` bem-sucedido no console fora de um procedimento de emergência registrado. Mudanças em contas e no grupo `wheel` são cobertas pelo [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

## Referências

- Documentação do RHEL: *Configuring basic system settings* (Managing sudo access).
- Documentação do RHEL: *Considerations in adopting RHEL 8* (securetty is now disabled by default).
- `passwd(1)`, `pam_wheel(8)`, `sshd_config(5)`.
