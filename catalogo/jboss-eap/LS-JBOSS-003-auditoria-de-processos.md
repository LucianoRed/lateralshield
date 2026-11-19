---
id: LS-JBOSS-003
titulo: Auditar a execução de processos pelo usuário do JBoss
tecnologia: jboss-eap
pilar: detectar
impacto: alto
esforco: baixo
versoes: JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9
status: rascunho
---

# LS-JBOSS-003 — Auditar a execução de processos pelo usuário do JBoss

## Problema

Depois de explorar um JBoss, o invasor quase sempre executa comandos do sistema: um shell, `id`, `whoami`, `curl`, `wget`, `ssh`. Um servidor de aplicação saudável raramente faz isso depois de iniciado. Essa diferença é um sinal de detecção barato e de alta precisão, e na maioria dos ambientes ninguém o está coletando.

## Benefício

A invasão de um JBoss passa a ser percebida no primeiro comando que o invasor executa, e não semanas depois, pelo dano causado. O alerta tem pouquíssimos falsos positivos, porque um servidor de aplicação em operação normal quase não executa programas.

Em caso de incidente, fica também o registro exato do que foi executado, com horário, o que encurta a investigação.

## Pré-requisitos

- `auditd` ativo (padrão no RHEL).
- O JBoss roda com usuário dedicado. Obtenha o UID: `id -u jboss`.
- Um destino para os logs fora do servidor (rsyslog, agregador). Log que fica só no host invadido pode ser apagado.

## Avaliação

```bash
systemctl is-active auditd
auditctl -l | grep -E 'ls_jboss_exec' || echo "sem regra de auditoria para o JBoss"
```

Sem regra, a execução de comandos pelo JBoss não deixa rastro: **sem detecção**.

## Implementação

Crie `/etc/audit/rules.d/50-lateralshield-jboss.rules`, trocando `1001` pelo UID do usuário do JBoss:

```
-a always,exit -F arch=b64 -S execve,execveat -F uid=1001 -k ls_jboss_exec
-a always,exit -F arch=b32 -S execve,execveat -F uid=1001 -k ls_jboss_exec
```

Carregue:

```bash
augenrules --load
auditctl -l | grep ls_jboss_exec
```

Levante a linha de base: reinicie o JBoss em uma janela e veja o que os scripts de inicialização executam.

```bash
ausearch -k ls_jboss_exec -i --start recent | grep -o 'exe=[^ ]*' | sort | uniq -c
```

Esses executáveis (tipicamente `java`, `sh`, `dirname`, `uname`, `grep`) aparecem apenas na partida. Qualquer `execve` **fora da partida do serviço** é o evento a alertar. Se a aplicação invoca programas externos legitimamente, registre-os como exceção conhecida.

Encaminhe os eventos para fora do host. Com rsyslog, habilite o plugin `syslog` do audit (`/etc/audit/plugins.d/syslog.conf`, `active = yes`; em RHEL 7, `/etc/audisp/plugins.d/syslog.conf`) e reinicie o `auditd` com `service auditd restart`.

## Validação

```bash
sudo -u jboss /usr/bin/id
ausearch -k ls_jboss_exec -i --start recent | tail -n 20
```

O comando deve aparecer com `exe=/usr/bin/id` e o UID do JBoss, e chegar ao agregador de logs.

## Reversão

```bash
rm /etc/audit/rules.d/50-lateralshield-jboss.rules
augenrules --load
```

## Impacto operacional

- Volume baixo em operação normal. Aplicações que executam programas externos com frequência geram mais eventos; nesse caso, restrinja o alerta aos executáveis fora da lista conhecida em vez de remover a regra.
- Se as regras do audit estiverem imutáveis (`-e 2`), a carga só vale após reinicialização do host.

## Detecção

Alerte para qualquer evento `ls_jboss_exec` fora da janela de partida do serviço. Prioridade máxima quando o executável for um interpretador ou ferramenta de rede: `sh`, `bash`, `python`, `perl`, `curl`, `wget`, `nc`, `ssh`, `scp`.

A combinação deste alerta com uma conexão bloqueada pelo [LS-JBOSS-002](LS-JBOSS-002-egress-por-usuario.md) no mesmo servidor é, na prática, confirmação de comprometimento.

## Referências

- Documentação do RHEL: *Security hardening* (Auditing the system; Defining audit rules).
- `audit.rules(7)`, `ausearch(8)`.
