---
id: LS-RHEL-010
titulo: Desabilitar core dumps e restringir o ptrace
tecnologia: rhel
pilar: conter
impacto: medio
esforco: baixo
versoes: RHEL 8 e 9
status: rascunho
---

# LS-RHEL-010 — Desabilitar core dumps e restringir o ptrace

## Problema

Credenciais não ficam só em arquivos. Elas estão na memória dos processos: a senha do banco de dados dentro do servidor de aplicação, chaves carregadas em um agente SSH, tokens de sessão, segredos lidos de um cofre na partida.

Há dois caminhos comuns para chegar a essa memória a partir de uma conta comum invadida:

- **`ptrace`.** Por padrão, um processo pode se anexar a qualquer outro processo do mesmo usuário e ler sua memória. Quem invade a conta de uma aplicação lê a memória de tudo o mais que roda com aquela conta.
- **Core dumps.** Quando um processo falha, o sistema pode gravar em disco uma cópia da memória dele. Esses arquivos se acumulam, entram em backups e guardam em texto claro o que o processo tinha carregado.

Em ambos os casos, o invasor obtém credenciais que nunca foram gravadas em arquivo de configuração, e parte delas para outros sistemas.

## Benefício

Uma conta de serviço invadida deixa de conseguir ler a memória dos processos vizinhos, e o servidor deixa de acumular cópias de memória em disco. As credenciais que só existem em memória ficam fora do alcance de quem não é `root`.

O efeito sobre a operação é pequeno: servidores de produção raramente precisam de depuração interativa, e a falha de um processo continua registrada no log, sem o arquivo.

## Pré-requisitos

- Confirmar com os times de aplicação se algum procedimento de suporte depende de core dumps ou de anexar depuradores em produção.
- Kernel com o módulo de segurança Yama, presente no RHEL 8 e 9. Se `sysctl kernel.yama.ptrace_scope` retornar erro, a parte de `ptrace` deste controle não se aplica.

O `kdump`, que captura a memória do kernel em caso de falha do sistema, é outro mecanismo e não é alterado por este controle.

## Avaliação

```bash
sysctl kernel.yama.ptrace_scope fs.suid_dumpable kernel.core_pattern
grep -Ehv '^\s*(#|$)' /etc/systemd/coredump.conf /etc/systemd/coredump.conf.d/*.conf 2>/dev/null
grep -rEhs '^[^#]*\bcore\b' /etc/security/limits.conf /etc/security/limits.d/
systemctl show --property=DefaultLimitCORE
grep -i 'core file' /proc/<pid-do-servico>/limits
coredumpctl list --no-pager 2>/dev/null | tail -n 5
ls -la /var/lib/systemd/coredump/ 2>/dev/null
```

Indicadores de exposição:

- `kernel.yama.ptrace_scope = 0`: qualquer processo se anexa a outro do mesmo usuário.
- `fs.suid_dumpable` diferente de `0`: programas com privilégio elevado também geram core dump.
- `kernel.core_pattern` apontando para o `systemd-coredump` sem `Storage=none` em `coredump.conf`: as cópias de memória são guardadas em `/var/lib/systemd/coredump/`.
- Limite de core diferente de `0` para o processo de um serviço exposto (quinto comando), em geral por um `LimitCORE=` na unidade do serviço ou por um ajuste feito em uma depuração antiga.
- Arquivos já existentes nesse diretório: verifique de quais processos são e remova-os depois de avaliar.

## Implementação

**1. Restringir o `ptrace`.** Aplique primeiro em tempo de execução, que vale até a próxima reinicialização:

```bash
sysctl -w kernel.yama.ptrace_scope=1
```

Valores:

| Valor | Efeito |
|---|---|
| `0` | Comportamento clássico: anexar a qualquer processo do mesmo usuário |
| `1` | Só é possível anexar a processos descendentes (o depurador que iniciou o programa) |
| `2` | Só processos com a capacidade `CAP_SYS_PTRACE` (na prática, `root`) |
| `3` | Ninguém se anexa; **não pode ser desfeito sem reiniciar** |

Use `1` como ponto de partida e `2` em servidores de produção onde ninguém depura com conta comum. Evite `3` até ter certeza.

**2. Desabilitar os core dumps.** Crie `/etc/systemd/coredump.conf.d/ls-sem-coredump.conf`:

```
[Coredump]
Storage=none
ProcessSizeMax=0
```

As duas opções juntas desligam o tratamento de core dumps, mantendo apenas a entrada no log. A mudança vale a partir da próxima falha de processo, sem reinício.

Como defesa adicional para sessões de usuário, crie `/etc/security/limits.d/ls-sem-coredump.conf`:

```
*    hard    core    0
```

**3. Tornar persistente.** Crie `/etc/sysctl.d/60-lateralshield-processos.conf`:

```
kernel.yama.ptrace_scope = 1
fs.suid_dumpable = 0
```

```bash
sysctl --system
```

## Validação

```bash
sysctl kernel.yama.ptrace_scope fs.suid_dumpable
```

Com uma conta comum, em servidor de teste que tenha o `strace` instalado:

```bash
sleep 300 &
strace -p $!          # deve falhar com "Operation not permitted"
```

Para os core dumps, provoque a falha de um processo de teste e confirme que nada foi gravado:

```bash
sleep 60 & kill -SEGV $!
journalctl -t systemd-coredump --since "1 minute ago"
ls /var/lib/systemd/coredump/
```

O journal registra a falha, e o diretório continua vazio. A aplicação deve seguir funcionando; reinicie-a uma vez em janela para confirmar que os scripts de partida não dependem de `ptrace`.

## Reversão

```bash
rm /etc/sysctl.d/60-lateralshield-processos.conf \
   /etc/systemd/coredump.conf.d/ls-sem-coredump.conf \
   /etc/security/limits.d/ls-sem-coredump.conf
sysctl -w kernel.yama.ptrace_scope=0
```

Confirme com `sysctl --system` que nenhum outro arquivo redefine os valores. Se `ptrace_scope` foi colocado em `3`, a reversão só vale depois de reiniciar o host.

## Impacto operacional

- Ferramentas que se anexam a processos em execução (`gdb -p`, `strace -p` e modos de diagnóstico de algumas linguagens) deixam de funcionar com conta comum. Com o valor `2`, exigem `root`.
- Sem core dump, a análise de falhas de aplicação perde sua principal evidência. Se o suporte do fornecedor pedir um, reative temporariamente em um servidor, com prazo, e remova o arquivo ao final.
- O limite em `limits.d` vale para sessões abertas pelo PAM, e não para serviços do systemd; por isso a configuração do `coredump.conf` é a principal.
- `root` continua podendo ler a memória de qualquer processo. Este controle restringe contas comuns e de serviço; não protege contra quem já tem privilégio total.

## Detecção

Mesmo com o armazenamento desligado, o `systemd-coredump` registra no journal cada processo que falhou. A falha repetida de um serviço exposto pode ser tentativa de exploração; encaminhe essas mensagens ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)) e alerte quando o processo for um serviço de rede.

```bash
journalctl -t systemd-coredump --since today
journalctl -k | grep -i 'ptrace'
```

O segundo comando procura o registro que o Yama faz, no log do kernel, das tentativas de anexação negadas. Este ponto não foi confirmado na documentação: verifique no servidor de teste, logo após a validação, se a mensagem aparece.

Para registrar todo uso de `ptrace` e as mudanças nesta configuração, acrescente às regras do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md):

```
-a always,exit -F arch=b64 -S ptrace -k ls_ptrace
-w /etc/sysctl.conf -p wa -k ls_sysctl
-w /etc/sysctl.d/ -p wa -k ls_sysctl
-w /etc/systemd/coredump.conf.d/ -p wa -k ls_sysctl
```

Em servidor de produção, um evento `ls_ptrace` de conta de serviço é anômalo, e um evento `ls_sysctl` fora de janela indica alguém desfazendo a proteção.

## Referências

- Documentação do kernel Linux: *Yama* (`ptrace_scope`).
- `coredump.conf(5)`, `systemd-coredump(8)`, `core(5)`, `limits.conf(5)`, `sysctl.d(5)`.
- Red Hat Customer Portal: *How to permanently disable coredump* (solução 5955071).
