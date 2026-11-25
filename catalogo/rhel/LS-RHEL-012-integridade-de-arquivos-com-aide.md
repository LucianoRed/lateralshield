---
id: LS-RHEL-012
titulo: Verificar a integridade de arquivos com o AIDE
tecnologia: rhel
pilar: detectar
impacto: medio
esforco: baixo
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-012 — Verificar a integridade de arquivos com o AIDE

## Problema

Quem obtém privilégio em um servidor raramente se contenta com o acesso do momento. Para voltar depois e para capturar as credenciais de quem administra a máquina, o invasor altera o próprio sistema: troca um binário por uma versão modificada, acrescenta um módulo de autenticação, uma unidade do systemd, uma tarefa agendada, uma chave em `authorized_keys`.

Essas mudanças são pequenas e ficam em diretórios que ninguém inspeciona à mão. Um servidor adulterado continua funcionando normalmente, e passa a entregar ao invasor cada senha digitada nele — o material para os saltos seguintes. Sem uma referência do estado correto, não há como perceber a diferença.

## Benefício

Alterações em binários, bibliotecas e arquivos de configuração do sistema passam a ser percebidas em até um dia, em vez de permanecerem por meses. A persistência do invasor, que depende de não ser notada, perde essa garantia.

Na resposta a um incidente, a equipe consegue dizer rapidamente o que mudou em um servidor suspeito e desde quando, em vez de reinstalar tudo por precaução ou confiar em uma máquina adulterada.

## Pré-requisitos

- Pacote `aide`, dos repositórios do RHEL.
- Um servidor em estado conhecido e confiável no momento de criar a base. Uma base criada depois da invasão registra a adulteração como normal.
- Um lugar fora do servidor para guardar cópia da base de referência.
- Destino central de logs ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)).
- Um responsável por analisar as diferenças, e o processo de mudanças avisando quando há atualização de pacotes.

## Avaliação

```bash
rpm -q aide
ls -l /var/lib/aide/
grep -rs 'aide' /etc/crontab /etc/cron.d/ /etc/cron.daily/ /etc/cron.weekly/ /var/spool/cron/ 2>/dev/null
systemctl list-timers --all 2>/dev/null | grep -i aide
```

- Pacote ausente, ou instalado sem `/var/lib/aide/aide.db.gz`: **sem detecção** de adulteração.
- Base existente, mas sem agendamento: a verificação nunca roda.
- Base com data muito antiga em servidor que recebe atualizações: toda verificação acusa centenas de diferenças, e ninguém mais lê o resultado.

## Implementação

**1. Instalar e revisar o escopo.**

```bash
dnf install aide        # yum, no RHEL 7
```

O arquivo `/etc/aide.conf` já cobre os diretórios de sistema. Acrescente o que é específico do servidor — por exemplo, os binários e scripts de partida de um servidor de aplicação instalado em `/opt` — usando um dos grupos de atributos já definidos no próprio arquivo, e exclua com `!` diretórios que mudam o tempo todo (dados, logs, arquivos temporários). Os nomes dos grupos variam entre versões; consulte o arquivo instalado.

**2. Criar a base de referência**, com o servidor em estado confiável:

```bash
aide --init
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
```

**3. Guardar uma cópia fora do servidor.** Quem tem `root` pode refazer a base depois de adulterar o sistema. Copie `aide.db.gz` e o seu hash (`sha256sum`) para um repositório central com acesso restrito; em caso de suspeita, a verificação é feita contra essa cópia.

**4. Agendar a verificação diária.** A documentação do RHEL recomenda no mínimo uma verificação semanal e, de preferência, diária. Acrescente em `/etc/crontab`:

```
05 4 * * * root /usr/sbin/aide --check >/dev/null 2>&1 && logger -t ls_aide "AIDE: sem diferencas" || logger -p authpriv.warning -t ls_aide "AIDE: diferencas encontradas ou falha na verificacao"
```

O `aide --check` termina com código diferente de zero quando encontra arquivos novos, removidos ou alterados, ou quando não consegue executar. A linha acima envia ao syslog uma mensagem `ls_aide` em todos os casos, com o resultado; o relatório completo fica no arquivo de log do AIDE (em `/var/log/aide/`, conforme `aide.conf`).

**5. Atualizar a base após mudanças legítimas.** Depois de uma atualização de pacotes ou de uma mudança de configuração aprovada, revise o relatório e aceite o novo estado:

```bash
aide --update
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
```

Atualize também a cópia externa. Esse passo precisa fazer parte do procedimento de atualização; sem ele, o controle vira ruído em poucas semanas.

Em escala, as RHEL System Roles incluem uma role `aide` nas versões mais recentes; verifique se ela está disponível na versão instalada.

## Validação

```bash
touch /etc/ls-aide-teste
aide --check ; echo "codigo de saida: $?"
rm /etc/ls-aide-teste
```

O relatório deve listar `/etc/ls-aide-teste` como arquivo adicionado, com código de saída diferente de zero. Execute a linha do agendamento manualmente e confirme que a mensagem `ls_aide` chega ao destino central. Depois de remover o arquivo de teste, `aide --check` deve voltar a não apontar diferenças.

## Reversão

Remova a linha de `/etc/crontab`. Se quiser desinstalar: `dnf remove aide` e apague `/var/lib/aide/`.

## Impacto operacional

- A verificação lê todos os arquivos monitorados e calcula hashes: consome disco e CPU por alguns minutos. Agende fora do horário de pico e observe em servidores com muitos arquivos.
- **Toda atualização de pacotes gera diferenças.** Sem atualizar a base logo depois, o alerta dispara todos os dias e deixa de ser lido. É o principal motivo de abandono deste controle.
- A detecção não é imediata: uma alteração feita logo após a verificação só aparece na seguinte.
- O AIDE roda no próprio servidor que verifica. Um invasor com `root` pode alterar a base, o agendamento ou o binário; por isso a cópia externa e o alerta de silêncio descrito abaixo. O controle aumenta o custo da persistência, e não a impede.
- Arquivos fora do escopo do `aide.conf` não são verificados. Diretórios pessoais e de dados costumam ficar de fora.

## Detecção

O sinal é a mensagem `ls_aide` no syslog, que precisa chegar ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)). No destino, alerte para:

- **`ls_aide` com diferenças, fora de uma janela de mudança.** Abra o relatório no servidor e trate como incidente qualquer alteração em binários, bibliotecas, módulos de autenticação (`/etc/pam.d`, `/usr/lib64/security`), unidades do systemd, tarefas agendadas e configuração do `sshd` e do `sudo`.
- **Mudança na própria base** (`/var/lib/aide/aide.db.gz`) sem atualização de pacotes correspondente, comparando o hash com a cópia externa.
- **Silêncio.** Um servidor que deixou de enviar a mensagem diária `ls_aide` teve o agendamento removido ou a verificação interrompida.
- **Agendamento alterado.** A linha em `/etc/crontab` pode ser vigiada com uma regra do audit, nos moldes do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

Para os arquivos instalados por pacotes, `rpm -Va` oferece uma segunda verificação, independente da base do AIDE.

## Referências

- Documentação do RHEL: *Security hardening* (Checking integrity with AIDE).
- `aide(1)`, `aide.conf(5)`.
- Documentação do RHEL: *Automating system administration by using RHEL System Roles*.
