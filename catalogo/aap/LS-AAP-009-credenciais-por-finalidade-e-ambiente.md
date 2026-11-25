---
id: LS-AAP-009
titulo: Separar as credenciais por finalidade e ambiente
tecnologia: aap
pilar: conter
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.x; hosts gerenciados RHEL 7, 8 e 9
status: rascunho
---

# LS-AAP-009 — Separar as credenciais por finalidade e ambiente

## Problema

É comum existir no AAP uma única credencial de máquina, usada em todos os job templates: a mesma chave SSH, da mesma conta com `sudo`, vale em desenvolvimento, homologação e produção, para aplicar correções, publicar aplicações e coletar inventário.

Com isso, qualquer pessoa que possa usar essa credencial em um job template de desenvolvimento pode, na prática, executar comandos em produção. O comprometimento da conta de um desenvolvedor, ou de um repositório de playbooks de um ambiente de testes, alcança os servidores mais críticos. A separação entre ambientes que existe na rede deixa de existir na automação.

## Benefício

O alcance de uma credencial passa a ser o de um ambiente e de uma finalidade. Quem compromete a automação de desenvolvimento chega aos servidores de desenvolvimento, e não aos de produção. Uma chave vazada obriga a trocar um par de chaves em um grupo de servidores, e não em todos.

A operação ganha clareza: olhando o nome da credencial em um job template, sabe-se onde ele pode agir e com qual privilégio.

## Pré-requisitos

- Inventários já separados por ambiente, ou ao menos grupos que permitam separar.
- Lista das finalidades reais da automação (por exemplo: correções do sistema, publicação de aplicações, coleta de dados).
- Permissão para criar contas de serviço e distribuir chaves nos hosts gerenciados.

## Avaliação

No AAP, liste as credenciais e veja em quantos job templates e ambientes cada uma é usada. Pela interface, em **Credentials**; no automation controller 2.4, pela API:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://aap.exemplo.com.br/api/v2/job_templates/?page_size=200" \
  | jq -r '.results[] | [.name, .summary_fields.inventory.name, ([.summary_fields.credentials[].name] | join(","))] | @tsv'
```

Em um host de produção e em um de não produção, compare as chaves aceitas pela conta de automação:

```bash
ssh-keygen -lf ~<conta-de-automacao>/.ssh/authorized_keys
```

Indicadores de exposição:

- A mesma credencial de máquina em job templates de inventários de ambientes diferentes.
- A mesma impressão digital de chave em hosts de produção e de não produção.
- Uma única conta de automação, com `sudo` irrestrito, usada para todas as finalidades.
- Credenciais de outros tipos (repositório de código, registro de imagens, nuvem) com privilégio de escrita onde só a leitura é necessária.

## Implementação

**1. Definir a matriz.** Uma credencial por combinação de ambiente e finalidade que realmente exista. Comece pelo corte mais importante, produção e não produção, e refine depois. Adote um padrão de nome que mostre os dois eixos (por exemplo, `maquina-prod-correcoes`).

**2. Criar pares de chaves e contas distintos.** Cada credencial de máquina usa seu próprio par de chaves. Para finalidades com privilégios diferentes, use contas de serviço diferentes nos hosts, cada uma com o `sudo` de que precisa ([LS-RHEL-005](../rhel/LS-RHEL-005-sudo-de-menor-privilegio.md)). Restrinja cada chave à origem ([LS-AAP-001](LS-AAP-001-chave-de-automacao-restrita.md)).

**3. Distribuir as novas chaves em paralelo com a antiga.** Instale as novas chaves públicas nos hosts de cada ambiente, mantendo a antiga por enquanto. Esse é o período de observação.

**4. Trocar a credencial nos job templates.** Um ambiente por vez, começando por não produção. Rode os jobs e confirme.

**5. Limitar quem usa cada credencial.** Conceda o papel de uso da credencial de produção apenas aos times que operam produção ([LS-AAP-011](LS-AAP-011-credenciais-com-propriedade-central.md)). Organizações separadas por ambiente tornam esse limite mais difícil de errar.

**6. Retirar a chave antiga.** Antes, confirme nos logs do sshd dos hosts que ela não é mais usada: o registro de cada login por chave traz a impressão digital. Depois, remova a chave pública antiga de todos os hosts e apague a credencial antiga do AAP.

## Validação

- Os jobs de cada ambiente executam com a credencial nova.
- Em teste controlado, a chave de não produção é recusada em um host de produção.
- A consulta da avaliação não mostra nenhuma credencial usada em inventários de ambientes diferentes.
- Um usuário de um time de desenvolvimento não consegue selecionar a credencial de produção em um job template.

## Reversão

Enquanto a chave antiga estiver instalada nos hosts (até o passo 6), basta associar de novo a credencial antiga ao job template. Depois do passo 6, a reversão exige redistribuir a chave pública antiga, o que não é recomendado.

## Impacto operacional

- Mais credenciais para cadastrar e rotacionar. O padrão de nomes e a propriedade central reduzem a confusão.
- Workflows que atravessam ambientes precisam de um job template por ambiente, cada um com sua credencial.
- Job templates que pedem a credencial no lançamento passam a oferecer mais opções; revise quem pode lançá-los.
- Cópias de job templates entre ambientes deixam de funcionar sem ajuste. É o efeito desejado.

## Detecção

- No AAP: alteração da credencial associada a um job template e concessão de papéis em credenciais de produção, registradas no activity stream ([LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md)).
- Nos hosts: tentativa de login com a chave de outro ambiente aparece no log do sshd como falha de chave pública para a conta de automação. Depois da separação, isso indica erro de configuração ou uso indevido de uma chave.
- Uso da chave antiga depois de retirada.

Os logs do sshd precisam chegar ao destino central: [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Using automation execution* (Managing user credentials).
- Documentação do Ansible Automation Platform 2.4: *Automation controller user guide* (credenciais) e *Automation controller administration guide* (Multi-Credential Assignment).
- Documentação do Ansible Automation Platform: *Hardening and compliance* (conta de serviço dedicada nos hosts gerenciados).
- `ssh-keygen(1)`, `sshd(8)`.
