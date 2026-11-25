---
id: LS-AAP-005
titulo: Proteger a SECRET_KEY e manter cópia de segurança
tecnologia: aap
pilar: conter
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior (os caminhos variam entre instalação RPM, em contêiner e por operador)
status: rascunho
---

# LS-AAP-005 — Proteger a SECRET_KEY e manter cópia de segurança

## Problema

O automation controller guarda senhas, chaves SSH e tokens cifrados no banco de dados. A chave que cifra esses campos é a `SECRET_KEY`. Quem tem a chave e uma cópia do banco tem todas as credenciais que a automação usa, sem precisar passar pela interface.

A chave fica em um arquivo no servidor, sem criptografia, porque o serviço precisa lê-la ao iniciar. E os backups gerados pelo instalador incluem a chave junto com o banco: um arquivo de backup esquecido em um diretório compartilhado equivale a entregar todas as credenciais.

Há também o risco inverso: se a chave se perde, os campos cifrados do banco ficam inacessíveis, e todas as credenciais precisam ser cadastradas de novo.

## Benefício

A cópia do banco e os backups deixam de ser, sozinhos, um caminho para as credenciais do ambiente: sem a chave, o conteúdo cifrado não serve ao invasor, e a chave passa a existir apenas onde precisa estar.

Do lado da operação, a recuperação da plataforma depois de uma falha deixa de depender de sorte: existe uma cópia conhecida da chave, guardada em local controlado, e um procedimento de troca para o caso de suspeita de vazamento.

## Pré-requisitos

- Acesso de administrador aos nós do controller.
- O inventário usado na instalação.
- Um local de guarda com acesso restrito e registrado, separado dos backups do banco.

## Avaliação

Instalação RPM, em cada nó do controller:

```bash
stat -c '%U:%G %a %n' /etc/tower/SECRET_KEY
find / -xdev -name 'SECRET_KEY*' -not -path '/proc/*' 2>/dev/null
```

Instalação em contêiner, com o usuário da instalação:

```bash
podman secret ls
ls -l ~/.local/share/containers/storage/secrets/filedriver/secretsdata.json
```

Em todos os casos, localize os arquivos de backup da plataforma e veja quem consegue lê-los.

Indicadores de exposição:

- O arquivo da chave legível por alguém além de `root` e da conta de serviço `awx`.
- Cópias da chave fora do local original: diretórios pessoais, pastas do instalador, repositórios.
- Backups em área compartilhada, sem criptografia, ou acessíveis a quem não administra a plataforma.
- Ninguém sabe onde está a cópia de segurança da chave, ou ela só existe dentro dos próprios nós.

Na instalação em contêiner, o arquivo dos Podman secrets guarda os valores em base64, e não cifrados. A proteção é a permissão do arquivo e o acesso à conta, tratados em [LS-AAP-004](LS-AAP-004-acesso-ao-so-dos-nos.md).

## Implementação

**1. Conferir as permissões.** O arquivo da chave deve ser legível apenas por `root` e pela conta de serviço. Remova as cópias soltas encontradas na avaliação.

**2. Guardar uma cópia fora da plataforma.** Guarde um backup completo recente, que inclui a chave, em local cifrado e com acesso restrito. A documentação do AAP recomenda exatamente isso para os arquivos de backup. Registre quem pode retirá-lo.

**3. Proteger os backups de rotina.** Envie-os para armazenamento cifrado, com retenção definida, e apague os arquivos antigos deixados no diretório do instalador.

**4. Trocar a chave quando houver suspeita de vazamento.** Na instalação RPM, faça um backup do banco e execute o instalador com o mesmo inventário da instalação:

```bash
./setup.sh -k
```

Uma cópia da chave anterior é mantida em `/etc/tower/`. Depois da troca, os backups antigos continuam cifrados com a chave antiga: guarde-os ou descarte-os de acordo com isso. Para a instalação em contêiner e por operador, este controle não confirmou o procedimento de troca; consulte o guia da versão em uso.

Na instalação por operador, a chave fica em um Secret do Kubernetes no namespace da plataforma. Restrinja por RBAC quem pode ler Secrets nesse namespace ([LS-OCP-011](../openshift/LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md)) e inclua o Secret no backup.

## Validação

- A avaliação não mostra cópias soltas nem permissões abertas.
- Em laboratório, restaure o backup guardado em um ambiente isolado e confirme que um job consegue usar uma credencial armazenada. Backup que nunca foi restaurado não é garantia.

## Reversão

- Guarda e permissões não exigem reversão.
- Troca de chave: restaure o backup feito imediatamente antes da troca, que traz o banco e a chave anterior.

## Impacto operacional

- Perder a `SECRET_KEY` sem cópia torna irrecuperáveis as credenciais armazenadas. A plataforma volta, mas todas as senhas, chaves e tokens precisam ser cadastrados de novo.
- A troca de chave deve ser feita em janela de manutenção, com backup recente. Em instalações com vários nós de controller, todos usam a mesma chave.
- Trocar a chave não troca as credenciais. Se a chave vazou junto com uma cópia do banco, as senhas e chaves SSH guardadas também precisam ser substituídas nos sistemas de destino.

## Detecção

Registre a leitura do arquivo da chave por sessões interativas. Os serviços da plataforma leem o arquivo sem identificador de login e não disparam a regra:

```
-a always,exit -F path=/etc/tower/SECRET_KEY -F perm=r -F auid>=1000 -F auid!=unset -k ls-aap-secret-key
```

Coloque a regra em `/etc/audit/rules.d/` (veja [LS-RHEL-003](../rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md)) e procure com `ausearch -k ls-aap-secret-key`. Fora de uma manutenção registrada, uma pessoa lendo esse arquivo é um alerta.

Monitore também o acesso ao local onde ficam os backups. Os eventos precisam chegar ao destino central ([LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md)).

## Referências

- Documentação do Ansible Automation Platform: *Configuring automation execution* (2.5) e *Automation controller administration guide* (2.4), capítulo *Secret handling and connection security*.
- Documentação do Ansible Automation Platform 2.4: *Automation controller administration guide* (Backup and restore).
- Documentação do Ansible Automation Platform: *Hardening and compliance* e *Containerized installation* (segredos operacionais e Podman secrets).
- `audit.rules(7)`.
