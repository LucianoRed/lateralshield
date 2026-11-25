---
id: LS-RHEL-009
titulo: Registrar e revisar o uso de sudo
tecnologia: rhel
pilar: detectar
impacto: medio
esforco: baixo
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-009 — Registrar e revisar o uso de sudo

## Problema

O `sudo` já registra cada comando por padrão, mas esse registro costuma ter dois defeitos: fica só no servidor, onde quem virou `root` pode apagá-lo, e ninguém o lê.

Depois de obter uma conta com `sudo`, o invasor a usa como qualquer administrador usaria — para ler arquivos de credenciais, criar contas, alterar serviços. Sem revisão, esse uso se mistura à rotina. E quando a pessoa abre um shell de `root` (`sudo -i`, `sudo su -`), o registro termina ali: aparece a abertura do shell, e nada do que foi feito dentro dele.

## Benefício

O uso de privilégio passa a ter um registro fora do alcance de quem o exerceu, e alguém olhando para ele em intervalo definido. Uma conta de serviço que usa `sudo` pela primeira vez, um administrador ativo de madrugada em servidores que não são seus, uma sequência de tentativas recusadas: tudo isso passa a ser visto em dias, e não descoberto na investigação de um incidente maior.

Para as sessões de shell privilegiado, a gravação da saída permite reconstruir o que foi feito. A revisão periódica também alimenta o [LS-RHEL-005](LS-RHEL-005-sudo-de-menor-privilegio.md): mostra quais regras de `sudo` são usadas de fato e quais podem ser removidas.

## Pré-requisitos

- Destino central de logs ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)).
- Um responsável pela revisão e uma periodicidade definida. Sem isso, o controle é só armazenamento.
- Espaço em disco para a gravação de sessões, se for ativada.

## Avaliação

```bash
grep -rEn '^\s*Defaults.*(syslog|logfile|log_input|log_output|iolog)' /etc/sudoers /etc/sudoers.d/
journalctl -t sudo --since "7 days ago" | grep -c 'COMMAND='
journalctl -t sudo --since "7 days ago" | grep -cE 'COMMAND=.*(/bin/(ba)?sh|/bin/su)\b'
```

- `Defaults !syslog` ou equivalente: o registro foi desligado. **Sem detecção.**
- Há comandos registrados localmente (segundo comando), mas eles não aparecem no destino central: o registro existe e pode ser apagado.
- O terceiro comando conta as aberturas de shell de `root`. Se o número é alto e não há gravação de sessão (`log_output`), a maior parte da atividade privilegiada não está registrada.
- Pergunte quem leu esses registros no último mês. "Ninguém" é o achado mais comum.

## Implementação

**1. Garantir que o registro sai do servidor.** O `sudo` grava no syslog (facilidade `authpriv`, em `/var/log/secure`) e no journal. Com o [LS-RHEL-002](LS-RHEL-002-syslog-central.md) aplicado, confirme no destino central que as linhas com `COMMAND=` chegam.

O `sudo` do RHEL também grava no audit um registro `USER_CMD` por comando, que segue pelo plugin de syslog do audit. Confirme no servidor com `ausearch -m USER_CMD -i -ts today`.

**2. Gravar a saída das sessões de pessoas.** Crie `/etc/sudoers.d/ls-registro`:

```
Defaults:%wheel log_output
```

```bash
visudo -cf /etc/sudoers.d/ls-registro
```

A partir daí, o que aparece na tela durante um `sudo` de um membro do grupo `wheel` fica gravado em `/var/log/sudo-io` (o padrão de `iolog_dir`), inclusive dentro de um shell de `root`. Cada linha do log do `sudo` passa a trazer um identificador `TSID=`, usado para reproduzir a sessão:

```bash
sudoreplay -l user <usuario>
sudoreplay <TSID>
```

Não ative `log_input`: ele grava tudo o que é digitado, inclusive senhas, em arquivo sem criptografia.

A gravação fica no próprio servidor. Ela ajuda na reconstrução, mas não substitui o registro central dos comandos: quem tem `root` pode apagá-la.

**3. Revisar em intervalo fixo.** A partir do destino central, toda semana, responda:

- Quais contas usaram `sudo`, em quais servidores? Alguma pela primeira vez?
- Alguma conta de serviço usou `sudo` de forma interativa (com `TTY=pts/`)?
- Quantas aberturas de shell de `root`, e por quem?
- Houve tentativas recusadas?
- Algum comando alterou contas, regras de `sudo`, chaves SSH ou configuração de log?

Em um servidor isolado, o equivalente local é:

```bash
journalctl -t sudo --since "7 days ago" | grep 'COMMAND=' | awk '{print $6}' | sort | uniq -c
ausearch -m USER_CMD -i -ts week-ago | grep -c 'res=failed'
```

Registre o resultado da revisão, mesmo quando não houver achados.

## Validação

```bash
sudo -l >/dev/null && sudo /usr/bin/id
journalctl -t sudo --since "5 minutes ago"
sudoreplay -l user "$USER"
```

O comando deve aparecer no journal, no destino central e, com `log_output`, na lista do `sudoreplay`. Confirme também que existe o registro da última revisão.

## Reversão

```bash
rm /etc/sudoers.d/ls-registro
visudo -c
```

As gravações já feitas permanecem em `/var/log/sudo-io` até serem removidas.

## Impacto operacional

- O registro de comandos não tem impacto. A gravação de saída executa os comandos em um pseudoterminal e ocupa disco: comandos com muita saída geram arquivos grandes. Defina retenção para `/var/log/sudo-io`.
- Não aplique `log_output` à conta de automação: o volume é alto e o registro dos jobs já existe no Ansible Automation Platform. A regra acima vale só para o grupo `wheel`.
- A saída gravada pode conter dados sensíveis exibidos na tela. Mantenha o diretório restrito a `root`.
- A revisão consome tempo de uma pessoa. Sem esse tempo reservado, ela para na segunda semana.

## Detecção

Além da revisão periódica, alerte de imediato no destino central para:

- mensagens `NOT in sudoers` e `command not allowed`;
- `incorrect password attempts` em sequência para a mesma conta;
- qualquer uso de `sudo` por conta de serviço que não tenha regra prevista;
- comandos que desligam o próprio registro: alterações em `/etc/sudoers.d/`, em `rsyslog` e em `auditd`.

O texto das mensagens varia com a versão do `sudo`; confira o padrão no ambiente. As alterações nas regras e a execução de `sudo` por qualquer conta também ficam no audit, pelas chaves `ls_sudoers` e `ls_sudo` do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

## Referências

- Documentação do RHEL: *Configuring basic system settings* (Managing sudo access).
- `sudoers(5)`: opções `syslog`, `logfile`, `log_output`, `log_input` e `iolog_dir`.
- `sudoreplay(8)`, `ausearch(8)`.
- RHEL Audit System Reference (tipo de registro `USER_CMD`).
