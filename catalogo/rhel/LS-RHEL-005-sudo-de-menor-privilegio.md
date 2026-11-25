---
id: LS-RHEL-005
titulo: Aplicar sudo de menor privilégio
tecnologia: rhel
pilar: conter
impacto: alto
esforco: medio
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-005 — Aplicar sudo de menor privilégio

## Problema

Regras de `sudo` crescem por conveniência. A conta do servidor de aplicação ganha `ALL` para que um script de deploy funcione; o time de suporte ganha `NOPASSWD: ALL` para não digitar senha; ninguém revisa depois.

Para o invasor, isso elimina uma etapa inteira. Quem explora uma aplicação obtém a conta de serviço; se essa conta tem `sudo` amplo, ele já é `root`, e com `root` lê chaves, senhas e tokens de tudo o que roda no servidor — o material de que precisa para o próximo salto.

Regras estreitas no nome e largas na prática têm o mesmo efeito: permitir um editor de texto, um paginador ou um interpretador como `root` equivale a permitir tudo, porque esses programas executam outros programas e alteram qualquer arquivo.

## Benefício

A invasão de uma conta de serviço fica restrita ao que essa conta faz. O invasor não vira `root` pelo `sudo`, não lê as credenciais das demais aplicações do servidor e precisa de outra falha para subir de privilégio — o que dá tempo à detecção.

Para a operação, as regras passam a documentar o que cada conta realmente precisa, e qualquer comando fora da lista é recusado e registrado.

## Pré-requisitos

- Lista das contas de serviço e dos grupos com regras de `sudo`.
- Registro do uso real de `sudo` nas últimas semanas ([LS-RHEL-009](LS-RHEL-009-uso-de-sudo-registrado-e-revisado.md)), para saber o que cada conta executa.
- Acesso de console ou uma sessão de `root` aberta durante a mudança.

## Avaliação

```bash
visudo -c
grep -rEn '^[^#]*NOPASSWD' /etc/sudoers /etc/sudoers.d/
grep -rEn '^[^#]*=\s*(\([^)]*\))?\s*(NOPASSWD:\s*)?ALL\s*$' /etc/sudoers /etc/sudoers.d/
sudo -l -U <conta>
```

Indicadores de exposição:

- Conta de serviço (aplicação, banco de dados, monitoramento) com `ALL`, com ou sem senha.
- `NOPASSWD` para contas usadas por pessoas.
- Regras com curingas nos argumentos (`*`) ou com caminho relativo.
- Comandos que permitem executar outros programas ou editar arquivos arbitrários: shells, interpretadores, editores, paginadores e gerenciadores de pacotes.
- Scripts permitidos no `sudo` que a própria conta pode alterar. Confira o dono e as permissões do arquivo e dos diretórios acima dele.

## Implementação

**1. Observar antes de restringir.** Use o registro do `sudo` para levantar o que cada conta de serviço executa de fato:

```bash
journalctl -t sudo --since "30 days ago" | grep 'COMMAND=' | grep '<conta>' | sed 's/.*COMMAND=//' | sort | uniq -c
```

**2. Escrever uma regra por conta**, em arquivo próprio dentro de `/etc/sudoers.d/`, com caminho completo e argumentos fixos:

```
# /etc/sudoers.d/ls-deploy-app
Cmnd_Alias LS_APP_SERVICO = /usr/bin/systemctl restart app.service, \
                            /usr/bin/systemctl status app.service
deploy-app ALL=(root) NOPASSWD: LS_APP_SERVICO
```

```bash
visudo -cf /etc/sudoers.d/ls-deploy-app
chmod 0440 /etc/sudoers.d/ls-deploy-app
```

Regras práticas:

- Um comando com argumentos listados só é aceito com exatamente esses argumentos.
- Para editar um arquivo específico, use `sudoedit <arquivo>` em vez de permitir um editor.
- Se a conta só precisa agir como outro usuário de serviço, use `(usuario)` em vez de `(root)`.
- `NOPASSWD` só para contas de serviço sem senha e com lista fechada de comandos.

**3. Remover a regra ampla** somente depois de validar a nova, e manter uma sessão privilegiada aberta durante a troca.

**4. Tratar a conta de automação à parte.** O Ansible executa módulos a partir de arquivos temporários com nome variável, e sua documentação afirma que a elevação de privilégio não pode ser limitada a comandos específicos. A conta usada pelo Ansible Automation Platform continua com `sudo` amplo; o que a protege é restringir de onde a chave é aceita ([LS-AAP-001](../aap/LS-AAP-001-chave-de-automacao-restrita.md)) e não reutilizar essa conta para mais nada.

## Validação

```bash
sudo -l -U deploy-app
sudo -u deploy-app sudo -n /usr/bin/systemctl status app.service    # permitido
sudo -u deploy-app sudo -n /usr/bin/id                              # deve ser recusado
```

O deploy e as rotinas da aplicação devem continuar funcionando. A tentativa recusada deve aparecer no log do `sudo`.

## Reversão

Restaure o arquivo anterior em `/etc/sudoers.d/` (guarde uma cópia antes da mudança, fora desse diretório) e valide com `visudo -c`. Um arquivo com erro de sintaxe em `/etc/sudoers.d/` pode impedir todo o uso de `sudo`; por isso a sessão privilegiada aberta.

## Impacto operacional

- Scripts que chamam `sudo` com comandos fora da lista passam a falhar. A observação prévia reduz o risco, mas rotinas mensais ou anuais podem escapar; mantenha a regra antiga comentada com data para consulta.
- Cada nova necessidade operacional vira uma mudança de regra. É o custo do controle, e é o que mantém as regras revisadas.
- Regras com argumentos fixos quebram quando o script muda a forma de chamar o comando.
- O ganho é parcial em servidores onde a conta de automação tem `sudo` amplo: proteja essa conta com os controles do Ansible Automation Platform.

## Detecção

O `sudo` registra as recusas no journal e em `/var/log/secure`:

```bash
journalctl -t sudo | grep -E 'command not allowed|NOT in sudoers|incorrect password|a password is required'
```

O texto exato das mensagens varia com a versão do `sudo`; confirme o padrão do alerta com a tentativa recusada da validação.

Uma conta de serviço tentando um comando fora da sua lista é comportamento anômalo: a aplicação não muda de hábito sozinha. Encaminhe essas mensagens ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)) e alerte. Alterações nas regras são registradas pela chave `ls_sudoers` do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md).

## Referências

- Documentação do RHEL: *Configuring basic system settings* (Managing sudo access).
- `sudoers(5)`, `visudo(8)`, `sudo(8)`.
- Documentação do Ansible: *Understanding privilege escalation: become* (Privilege escalation must be general).
