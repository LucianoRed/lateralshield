---
id: LS-AAP-001
titulo: Restringir a chave de automação aos nós de execução do AAP
tecnologia: aap
pilar: conter
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.x; hosts gerenciados RHEL 7, 8 e 9
status: rascunho
---

# LS-AAP-001 — Restringir a chave de automação aos nós de execução do AAP

## Problema

O Ansible Automation Platform acessa os servidores gerenciados com uma credencial de máquina, em geral uma chave SSH de uma conta de serviço com `sudo`. A chave pública correspondente está em **todos** os servidores, quase sempre sem restrição.

Se a chave privada vazar — de um backup, de um repositório, de uma estação — ela funciona a partir de qualquer ponto da rede e dá acesso privilegiado ao ambiente inteiro. É a credencial de movimentação lateral mais valiosa que existe em um ambiente automatizado.

Restringir a chave à origem legítima faz com que ela só tenha valor para quem já controla um nó de execução do AAP.

## Benefício

A credencial mais poderosa do ambiente deixa de funcionar fora do lugar onde deveria estar. Uma cópia da chave privada obtida em um backup, repositório ou estação passa a não servir para nada, porque os servidores só a aceitam a partir dos nós de execução do AAP.

O vazamento da chave deixa de ser um incidente que compromete o ambiente inteiro e passa a ser um evento detectável: a primeira tentativa de uso fora do AAP fica registrada em cada servidor.

## Pré-requisitos

- IPs dos nós de execução do AAP (e do controller, se ele executa jobs).
- Nome da conta de serviço usada pela automação nos hosts gerenciados.
- Confirmar que nenhum outro sistema usa a mesma chave.

## Avaliação

Em um host gerenciado:

```bash
grep -vE '^\s*(#|$)' ~<conta-de-automacao>/.ssh/authorized_keys | grep -v 'from='
```

Cada linha retornada é uma chave aceita de qualquer origem: **exposta**.

No AAP, verifique quantos inventários e ambientes usam a mesma credencial de máquina. Uma única credencial para produção e não produção amplia o alcance de qualquer vazamento.

## Implementação

**1. Restringir a origem em `authorized_keys`.** Prefixe a chave da automação com as opções:

```
from="192.0.2.20,192.0.2.21",no-agent-forwarding,no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAA... automacao-aap
```

Com Ansible, usando a própria automação para distribuir a mudança:

```yaml
- name: Restringir a chave de automacao aos nos de execucao do AAP
  ansible.posix.authorized_key:
    user: "{{ ls_aap_conta }}"
    key: "{{ ls_aap_chave_publica }}"
    key_options: 'from="{{ ls_aap_origens | join(",") }}",no-agent-forwarding,no-port-forwarding,no-X11-forwarding'
    state: present
```

Aplique primeiro em um grupo pequeno e rode um job de teste antes de expandir.

**2. Separar credenciais por ambiente.** Use pares de chaves distintos para produção e não produção, cada um em sua credencial de máquina no AAP, associada apenas aos job templates do ambiente correspondente.

**3. Guardar a chave privada somente no AAP.** Remova cópias de estações, repositórios e compartilhamentos. Se houver dúvida sobre cópias antigas, gere um novo par e substitua.

## Validação

- Um job do AAP contra os hosts alterados executa normalmente.
- De qualquer outro host, com a mesma chave privada (em teste controlado), a conexão é recusada. No destino, o log do sshd registra a recusa por origem não autorizada.

## Reversão

Remova as opções do início da linha em `authorized_keys`, ou reaplique a tarefa acima sem `key_options`.

## Impacto operacional

- Ao adicionar ou trocar nós de execução, atualize a lista de origens **antes** de colocar o novo nó em uso; caso contrário, os jobs a partir dele falham.
- Execuções manuais de `ansible-playbook` a partir de estações com a chave da automação deixam de funcionar. É o efeito desejado: a automação privilegiada passa pelo AAP, com registro e controle de acesso.
- Com nós atrás de NAT, a origem vista pelo host é o IP traduzido.

## Detecção

No host gerenciado, o sshd registra tentativas com a chave correta a partir de origem não permitida:

```bash
journalctl -u sshd | grep -i 'not allowed because\|Authentication tried for .* with correct key but not from a permitted host'
```

Esse evento significa que **alguém possui a chave privada da automação fora do AAP**. Trate como incidente: gere novo par de chaves e investigue a origem.

## Referências

- `sshd(8)`, seção *AUTHORIZED_KEYS FILE FORMAT* (opção `from=`).
- Documentação do Ansible Automation Platform: gerenciamento de credenciais no automation controller.
- Coleção `ansible.posix`, módulo `authorized_key`.
