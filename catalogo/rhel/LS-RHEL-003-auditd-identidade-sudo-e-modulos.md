---
id: LS-RHEL-003
titulo: Auditar identidade, sudo e módulos de kernel com o auditd
tecnologia: rhel
pilar: detectar
impacto: alto
esforco: baixo
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-003 — Auditar identidade, sudo e módulos de kernel com o auditd

## Problema

O `auditd` vem ativo no RHEL, mas quase sem regras. Sem regras, três ações típicas de quem já obteve privilégio em um servidor não deixam registro confiável:

- **criar ou alterar contas e grupos**, para manter o acesso e voltar depois;
- **alterar as regras de `sudo`**, para dar privilégio a uma conta sob seu controle;
- **carregar módulos de kernel**, para esconder processos, arquivos e conexões.

São os passos que transformam a invasão de um servidor em presença permanente, e é dessa presença que partem os saltos seguintes. Sem auditoria, a equipe só descobre a conta extra ou a regra de `sudo` indevida meses depois, se descobrir.

## Benefício

Cada mudança em contas, grupos, regras de `sudo` e módulos de kernel passa a gerar um evento com horário, usuário de origem da sessão e comando. Ações que quase nunca acontecem fora de uma janela de mudança viram alertas de alta precisão.

Na investigação de um incidente, a equipe consegue responder "quando esta conta foi criada, e por quem?" sem depender da memória de ninguém. Com o encaminhamento do [LS-RHEL-002](LS-RHEL-002-syslog-central.md), a resposta continua disponível mesmo que o invasor apague os registros locais.

## Pré-requisitos

- `auditd` ativo (padrão no RHEL).
- Espaço em `/var/log/audit` e rotação definida em `/etc/audit/auditd.conf`.
- Destino central de logs ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)), com o plugin de syslog do audit ativo.

## Avaliação

```bash
systemctl is-active auditd
auditctl -s | grep -E '^(enabled|failure|lost|backlog)'
auditctl -l
auditctl -l | grep -cE '/etc/(passwd|shadow|group|sudoers)|init_module'
```

- `auditctl -l` retorna `No rules`: o audit está ligado, mas não registra nada do que interessa. **Sem detecção.**
- O último comando conta as regras que cobrem identidade, `sudo` e módulos. Zero significa que esses eventos não são auditados.
- `enabled 2` indica regras imutáveis: qualquer alteração só vale depois de reiniciar o host.
- `lost` diferente de zero indica eventos descartados; revise `backlog_limit` antes de acrescentar regras.

## Implementação

Crie `/etc/audit/rules.d/40-lateralshield.rules`:

```
# Identidade: contas, grupos e senhas
-w /etc/passwd -p wa -k ls_identidade
-w /etc/shadow -p wa -k ls_identidade
-w /etc/group -p wa -k ls_identidade
-w /etc/gshadow -p wa -k ls_identidade
-w /etc/security/opasswd -p wa -k ls_identidade

# sudo: quem pode usar e quem usa
-w /etc/sudoers -p wa -k ls_sudoers
-w /etc/sudoers.d/ -p wa -k ls_sudoers
-a always,exit -F path=/usr/bin/sudo -F perm=x -k ls_sudo
-a always,exit -F path=/usr/bin/su -F perm=x -k ls_sudo

# Módulos de kernel: carga e remoção
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -k ls_modulos
-a always,exit -F arch=b32 -S init_module,finit_module,delete_module -k ls_modulos
```

Carregue e confira:

```bash
augenrules --load
auditctl -l | grep -E 'ls_(identidade|sudoers|sudo|modulos)'
```

As regras de execução de `sudo` e `su` não filtram por usuário de propósito: assim registram também o uso por contas de serviço, que é o caso mais suspeito. O registro detalhado do que foi executado com `sudo` é assunto do [LS-RHEL-009](LS-RHEL-009-uso-de-sudo-registrado-e-revisado.md).

Para os eventos saírem do servidor, ative o plugin de syslog do audit conforme o [LS-RHEL-002](LS-RHEL-002-syslog-central.md).

O RHEL 8 e o 9 trazem conjuntos de regras mais amplos, voltados a conformidade, em `/usr/share/audit/sample-rules/`. A documentação avisa que eles não devem ser usados todos de uma vez. As regras acima são o subconjunto mínimo para movimentação lateral e convivem com esses arquivos; antes de combinar, verifique se não há regras duplicadas.

Depois de estabilizar as regras, é possível torná-las imutáveis com `-e 2` em um arquivo final (por exemplo `99-finalize.rules`). O invasor deixa de conseguir desligá-las sem reiniciar o host, e a operação também.

## Validação

Em um servidor de teste:

```bash
sudo -l >/dev/null
useradd ls-teste && userdel -r ls-teste

ausearch -k ls_sudo -i -ts recent | tail -n 5
ausearch -k ls_identidade -i -ts recent | tail -n 5
aureport -k --summary -ts today
```

Os eventos devem aparecer com a chave correspondente e com o `auid` de quem abriu a sessão, e chegar ao destino central. `aureport -m -ts today` resume as modificações de contas.

## Reversão

```bash
rm /etc/audit/rules.d/40-lateralshield.rules
augenrules --load
```

Com regras imutáveis (`-e 2`), a remoção só vale depois de reiniciar o host.

## Impacto operacional

- Nenhum impacto nas aplicações. O volume é baixo em servidores comuns: os arquivos vigiados mudam pouco e módulos são carregados quase só na inicialização.
- Servidores gerenciados por automação geram um evento `ls_sudo` por tarefa executada com privilégio. Isso é esperado; no alerta, separe a conta de automação das demais em vez de excluí-la da regra.
- Atualizações de pacotes e troca de senhas tocam `/etc/passwd`, `/etc/shadow` e `/etc/group`. O alerta deve considerar janelas de mudança.
- Um arquivo de regras com erro impede a carga das regras seguintes. Sempre confira com `auditctl -l` depois de `augenrules --load`.
- Com `-e 2`, qualquer ajuste nas regras passa a exigir reinicialização.

## Detecção

Os eventos ficam em `/var/log/audit/audit.log` e, com o plugin de syslog, seguem para o destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)). Alerte por chave:

- `ls_sudoers`: sempre. Mudança em regras de `sudo` fora de uma mudança planejada é sinal de elevação de privilégio.
- `ls_identidade`: fora de janela de mudança, e principalmente quando o processo não é uma ferramenta de administração de contas (`useradd`, `usermod`, `passwd`).
- `ls_modulos`: carga de módulo muito depois da inicialização, por processo que não seja `modprobe` chamado pelo sistema.
- `ls_sudo`: execução de `sudo` ou `su` por conta de serviço (o usuário do JBoss, de um servidor web, de um banco de dados). Complementa o [LS-JBOSS-003](../jboss-eap/LS-JBOSS-003-auditoria-de-processos.md).

Alerte também para a parada do `auditd` e para mudanças na configuração do audit (registros `CONFIG_CHANGE`) fora de janela.

## Referências

- Documentação do RHEL: *Security hardening* (Auditing the system; Defining Audit rules; Using pre-configured Audit rules files; Using augenrules to define persistent rules).
- `audit.rules(7)`, `auditctl(8)`, `augenrules(8)`, `ausearch(8)`, `aureport(8)`.
