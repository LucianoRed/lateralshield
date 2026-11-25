---
id: LS-RHEL-006
titulo: Manter o SELinux em modo enforcing
tecnologia: rhel
pilar: conter
impacto: alto
esforco: medio
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-006 — Manter o SELinux em modo enforcing

## Problema

O SELinux vem em modo `enforcing` no RHEL, e em muitos ambientes foi colocado em `permissive` ou desativado no dia em que uma aplicação não funcionou — e nunca mais voltou.

Sem ele, um serviço invadido pode fazer tudo o que as permissões de arquivo do seu usuário permitem: ler chaves SSH e arquivos de configuração de outros serviços, abrir conexões para qualquer destino, executar programas em diretórios temporários. Com o SELinux em `enforcing`, cada serviço fica preso ao seu domínio: um servidor web invadido não lê o diretório pessoal dos administradores nem inicia conexões que a política não prevê, mesmo que as permissões tradicionais deixem.

Há um caso que passa despercebido: o SELinux está em `enforcing`, mas o serviço exposto roda em domínio não confinado (`unconfined_service_t`), como costuma acontecer com software instalado em `/opt`. Para esse processo, a proteção quase não existe.

## Benefício

A invasão de um serviço deixa de dar ao invasor o alcance completo do usuário daquele serviço. Ler credenciais de outras aplicações, usar o servidor como ponto de partida para varreduras e instalar persistência ficam mais difíceis, e exigem uma segunda falha.

As tentativas não passam em silêncio: cada ação negada gera um registro de auditoria. Um serviço que de repente começa a ser negado em operações que nunca fez é um sinal de comprometimento de boa qualidade.

## Pré-requisitos

- Janela para reinicialização, se o SELinux estiver desativado (a reativação exige reetiquetar o sistema de arquivos).
- Lista dos serviços expostos do servidor e de quem responde por eles.
- `auditd` ativo, para registrar as negações.
- Pacote `policycoreutils-python-utils` (RHEL 8 e 9) ou `policycoreutils-python` (RHEL 7), que fornece o `semanage`.

## Avaliação

```bash
getenforce
grep -E '^SELINUX=' /etc/selinux/config
grep -oE '(selinux|enforcing)=[01]' /proc/cmdline
semanage permissive -l
ps -eZ | grep -E 'unconfined_service_t|initrc_t'
ausearch -m AVC,USER_AVC,SELINUX_ERR,USER_SELINUX_ERR -ts today | grep -c denied
```

- `Permissive` ou `Disabled`: **sem contenção**.
- `Enforcing` agora, mas `SELINUX=permissive` no arquivo ou `enforcing=0` na linha de comando do kernel: volta a ficar exposto na próxima reinicialização.
- Domínios listados por `semanage permissive -l`: serviços que escapam da política, um a um. Cada um precisa de dono e de justificativa.
- Processos em `unconfined_service_t` ou `initrc_t`: serviços sem confinamento. Se algum deles escuta na rede, é o primeiro a tratar.

## Implementação

**1. Sair de `Disabled`.** Coloque `SELINUX=permissive` em `/etc/selinux/config`, remova `selinux=0` da linha de comando do kernel se existir (`grubby --update-kernel ALL --remove-args selinux`), agende a reetiquetagem e reinicie:

```bash
fixfiles -F onboot
reboot
```

No RHEL 9, `SELINUX=disabled` no arquivo de configuração já não desativa o SELinux por completo; a desativação de fato é feita por `selinux=0` no kernel. Confira os dois lugares.

**2. Observar em `permissive`.** Nesse modo nada é bloqueado, mas tudo o que seria negado fica registrado. Deixe rodar por um ciclo completo da aplicação (incluindo rotinas noturnas e de fim de mês) e analise:

```bash
ausearch -m AVC,USER_AVC,SELINUX_ERR,USER_SELINUX_ERR -ts boot -i
```

**3. Corrigir a causa, nesta ordem de preferência:**

- contexto de arquivo errado, comum em dados fora do caminho padrão: `semanage fcontext -a -t <tipo> '<caminho>(/.*)?'` e `restorecon -Rv <caminho>`;
- porta fora do padrão: `semanage port -a -t <tipo_de_porta> -p tcp <porta>`;
- comportamento previsto pela política, mas desligado: `getsebool -a | grep <servico>` e `setsebool -P <booleano> on`;
- só em último caso, um módulo de política local. Revise o que ele libera antes de instalar; um módulo gerado automaticamente a partir das negações pode liberar exatamente o que o invasor faria.

**4. Ativar.**

```bash
setenforce 1
sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config
```

**5. Exceção por serviço, e não por servidor.** Se um único serviço ainda não funciona em `enforcing`, deixe apenas o domínio dele em modo permissivo, com prazo para correção:

```bash
semanage permissive -a <dominio>_t
```

O restante do sistema continua protegido, e as negações desse domínio continuam registradas.

## Validação

```bash
getenforce                                  # Enforcing
grep -E '^SELINUX=' /etc/selinux/config     # SELINUX=enforcing
ps -eZ | grep <processo-do-servico>         # domínio esperado, e não unconfined_service_t
ausearch -m AVC -ts recent
```

A aplicação deve funcionar normalmente, sem novas negações durante o uso. Reinicie o servidor em uma janela e confirme que ele volta em `Enforcing`.

## Reversão

```bash
setenforce 0        # imediato; vale até a próxima reinicialização
```

Prefira a reversão por domínio (`semanage permissive -a <dominio>_t`), que mantém o resto do sistema protegido. Para desfazer a exceção: `semanage permissive -d <dominio>_t`.

## Impacto operacional

- A reetiquetagem na reinicialização pode levar bastante tempo em sistemas de arquivos grandes.
- Aplicações com dados, logs ou portas fora do padrão param até que contextos e portas sejam ajustados. É o motivo da etapa em `permissive`.
- Software de terceiros sem política própria roda como `unconfined_service_t`: o `enforcing` não o quebra, mas também não o confina. Registre como lacuna conhecida.
- Arquivos movidos com `mv` mantêm o contexto de origem e causam negações depois de mudanças manuais; `restorecon` resolve.
- A equipe precisa saber ler uma negação. Sem isso, a primeira falha termina em `setenforce 0`.

## Detecção

As negações ficam em `/var/log/audit/audit.log` como registros `AVC` com `denied`, e seguem para o destino central pelo plugin de syslog do audit ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)). Alerte para:

- **mudança de modo**: registro `MAC_STATUS` no audit, gerado por `setenforce`. Fora de janela de mudança, é alguém desligando a proteção;
- **negações novas em serviço exposto**, principalmente de leitura de arquivos de outros serviços, execução em `/tmp` e conexões de rede (`name_connect`);
- **carga de política** (`MAC_POLICY_LOAD`) e novos domínios permissivos fora de janela.

Confirme os nomes dos registros na versão em uso com `ausearch -m MAC_STATUS,MAC_POLICY_LOAD -ts today`.

## Referências

- Documentação do RHEL: *Using SELinux* (Changing SELinux states and modes; Troubleshooting problems related to SELinux; Configuring SELinux for applications and services with non-standard configurations).
- Documentação do RHEL: *Considerations in adopting RHEL 9* (SELinux).
- `semanage-permissive(8)`, `semanage-fcontext(8)`, `ausearch(8)`.
