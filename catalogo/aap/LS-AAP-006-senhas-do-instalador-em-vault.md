---
id: LS-AAP-006
titulo: Guardar as senhas do inventário de instalação em Ansible Vault
tecnologia: aap
pilar: conter
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior, instalação RPM e em contêiner
status: rascunho
---

# LS-AAP-006 — Guardar as senhas do inventário de instalação em Ansible Vault

## Problema

O instalador do AAP recebe as senhas da plataforma como variáveis do arquivo de inventário: a do usuário `admin`, a do banco de dados, a do registro de imagens e as dos demais componentes. O exemplo de inventário da documentação traz essas variáveis em texto claro, e é assim que o arquivo costuma ficar.

Esse inventário não é descartado depois da instalação. Ele é necessário em upgrades, backups e restaurações, e por isso permanece no servidor de instalação, em diretórios pessoais, em cópias de trabalho e, muitas vezes, em um repositório Git. Quem lê o arquivo obtém a conta de administrador da plataforma e a senha do banco onde estão as credenciais.

## Benefício

O inventário deixa de ser uma credencial. Ele pode ser versionado, copiado e revisado sem expor a plataforma, porque as senhas ficam em um arquivo cifrado à parte.

Um invasor que alcance o servidor de instalação ou o repositório encontra a topologia do AAP, mas não as senhas que permitiriam assumir o controle dele.

## Pré-requisitos

- Acesso ao inventário usado na instalação e a todas as cópias conhecidas dele.
- Um local seguro para a senha do vault. Ela é exigida em toda execução do instalador, inclusive em backups.
- `ansible-vault`, disponível com o `ansible-core` no servidor de instalação.

## Avaliação

No diretório do instalador e em qualquer lugar onde o inventário esteja copiado:

```bash
grep -nEi '^[^#]*(password|secret|token)[a-z_]*[[:space:]]*=' inventory
head -1 credentials.yml 2>/dev/null
git log --oneline -- inventory 2>/dev/null | head
```

- Variáveis de senha com valor no inventário: **exposto**. Exemplos de nomes: `admin_password`, `pg_password` e `registry_password` na instalação RPM; `controller_admin_password` e `gateway_admin_password` na instalação em contêiner. A lista completa varia por versão e por componente.
- Arquivo de credenciais cuja primeira linha não começa com `$ANSIBLE_VAULT`: está em texto claro.
- Inventário com senhas no histórico do Git: as senhas continuam expostas mesmo depois de removidas do arquivo atual.

## Implementação

**1. Criar o arquivo de credenciais.** Mova as variáveis de senha do inventário para um arquivo YAML:

```yaml
admin_password: <senha>
pg_password: <senha>
registry_password: <senha>
```

**2. Cifrar o arquivo.**

```bash
ansible-vault encrypt credentials.yml
```

**3. Remover as senhas do inventário.** As variáveis cifradas não devem continuar definidas também no inventário.

**4. Executar o instalador com o arquivo cifrado.** Na instalação RPM:

```bash
./setup.sh -e @credentials.yml -- --ask-vault-pass
```

O guia da versão 2.5 mostra o comando sem o separador `--`. Na instalação em contêiner, o arquivo é passado ao playbook do instalador:

```bash
ansible-playbook -i inventory ansible.containerized_installer.install -e @credentials.yml --ask-vault-pass
```

Confira a forma exata no guia de instalação da versão em uso.

**5. Trocar as senhas que já circularam.** Se o inventário em texto claro esteve em repositório, compartilhamento ou backup, considere as senhas expostas: troque-as e limpe as cópias antigas. Cifrar o arquivo a partir de agora não protege o que já foi copiado.

**6. Guardar a senha do vault.** Em local com acesso restrito e registrado, fora do servidor de instalação.

## Validação

```bash
head -1 credentials.yml                          # $ANSIBLE_VAULT;1.1;AES256
grep -nEi '^[^#]*(password|secret|token)[a-z_]*[[:space:]]*=' inventory
ansible-vault view credentials.yml               # pede a senha do vault
```

O `grep` não deve retornar variáveis com valor. Em seguida, execute uma operação de rotina do instalador, como um backup, passando o arquivo cifrado, e confirme que ela conclui.

## Reversão

```bash
ansible-vault decrypt credentials.yml
```

O arquivo volta a texto claro e pode ser usado como antes. Não é recomendado.

## Impacto operacional

- Toda execução do instalador passa a pedir a senha do vault: upgrade, backup, restauração, inclusão de nós.
- Perder a senha do vault não derruba a plataforma, mas impede o uso do arquivo. Será preciso recriá-lo com as senhas atuais, o que só é possível se elas estiverem guardadas em outro lugar.
- Rotinas automáticas de backup que chamam o instalador precisam receber a senha do vault de forma protegida, e não em um arquivo legível ao lado do inventário.

## Detecção

Este controle remove uma exposição e gera pouco sinal próprio. O que vale monitorar:

- login da conta `admin` local fora de um procedimento registrado ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md));
- conexões ao banco de dados vindas de fora dos nós da plataforma ([LS-AAP-010](LS-AAP-010-segmentacao-de-rede-dos-nos.md));
- acesso ao servidor de instalação e leitura do diretório do instalador por quem não mantém a plataforma ([LS-AAP-004](LS-AAP-004-acesso-ao-so-dos-nos.md)).

Esses sinais dependem dos logs chegarem ao destino central: [LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md) e [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).

## Referências

- Documentação do Ansible Automation Platform 2.4: *Ansible Automation Platform 1.2 to 2 Migration Guide*, apêndice *Creating an encrypted credentials.yml file*.
- Documentação do Ansible Automation Platform 2.4: *Red Hat Ansible Automation Platform planning guide* (About the installer inventory file).
- Documentação do Ansible Automation Platform 2.5: *Hardening and compliance* (uso de Ansible Vault com o inventário do instalador) e *Containerized installation*.
- Documentação do Ansible: `ansible-vault`.
