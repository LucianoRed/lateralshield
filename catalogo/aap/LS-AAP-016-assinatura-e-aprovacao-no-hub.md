---
id: LS-AAP-016
titulo: Assinar e aprovar conteúdo no private automation hub
tecnologia: aap
pilar: prevenir
impacto: alto
esforco: medio
versoes: Ansible Automation Platform 2.5 ou superior com private automation hub
status: rascunho
---

# LS-AAP-016 — Assinar e aprovar conteúdo no private automation hub

## Problema

Collections e execution environments são o código que o AAP executa nos servidores gerenciados. Sem assinatura e sem aprovação no private automation hub, qualquer publicação — erro humano, conta de CI comprometida ou registro público espelhado sem curadoria — vira o próximo playbook privilegiado.

Quem altera uma collection ou troca a tag de uma imagem usada pelos job templates de produção alcança, de uma vez, todos os inventários que consomem esse conteúdo. É movimentação lateral pela cadeia de suprimentos da automação: o invasor não precisa do System Administrator se o hub já distribui o que os nós de execução vão rodar.

## Benefício

Só entra em uso o conteúdo que a organização assinou e aprovou. Collections sem assinatura válida e imagens que não vêm do private hub deixam de ser o caminho silencioso para executar código em massa.

A operação passa a ter um gate explícito (Approval dashboard) e chaves públicas distribuídas aos consumidores (`ansible-galaxy`, builders e nós que puxam imagens).

## Pré-requisitos

- Private automation hub implantado e alcançável pelos controllers e nós de execução.
- Par de chaves GnuPG da organização, com a privada protegida e a pública distribuível.
- Acesso ao inventário de instalação para habilitar o serviço de assinatura e a aprovação obrigatória.
- Lista das execution environments usadas em produção e dos job templates que as referenciam.

## Avaliação

**1. Inventário de instalação do hub.** Verifique se o serviço de assinatura e a aprovação estão ligados. A documentação de conteúdo usa, entre outras:

```text
automationhub_create_default_collection_signing_service=True
automationhub_auto_sign_collections=True
automationhub_require_content_approval=True
automationhub_collection_signing_service_key=/caminho/para/galaxy_signing_service.gpg
automationhub_collection_signing_service_script=/caminho/para/collection_signing.sh
```

Na instalação em contêiner, os nomes equivalentes começam com `hub_` (por exemplo `hub_collection_auto_sign`). Ausência de aprovação obrigatória ou de assinatura automática/manual operacionalizada é **exposição**.

**2. Na interface.** Em **Automation Content > Collection Approvals**, confira se há fluxo de aprovação. Em **Automation Content > Signature Keys**, confira se existem chaves de collections e de containers. Em **Execution Environments**, veja se imagens de produção aparecem como assinadas.

**3. Nos consumidores.** Nos hosts que instalam collections (incluindo builds de EE) e nos nós de execução:

```bash
# keyring usado pelo ansible-galaxy (exemplo; o caminho é o da organização)
gpg --no-default-keyring --keyring ~/.ansible/pubring.kbx --list-keys
```

Job templates que apontam `registry.redhat.io`, `quay.io` ou registries fora do hub para EE de produção, sem política de assinatura no cliente de contêineres, são **exposição**.

## Implementação

**1. Configurar o serviço de assinatura no hub.** Crie o script de assinatura no formato exigido pelo Pulp (JSON com `file` e `signature`, assinatura detachada ASCII-armored com a chave em `PULP_SIGNING_KEY_FINGERPRINT`), referencie-o no inventário com a chave e rode o instalador conforme *Configuring content signing on private automation hub*.

**2. Exigir aprovação.** Com `automationhub_require_content_approval=True` (ou equivalente), collections enviadas ficam no dashboard de aprovação até alguém aprovar e assinar (**Automation Content > Collection Approvals**).

**3. Distribuir a chave pública.** Em **Signature Keys**, baixe a chave de collections (`collections-…`) e a de containers (`container-…`). Importe a de collections no keyring usado pelo `ansible-galaxy`:

```bash
gpg --import --no-default-keyring --keyring ~/.ansible/pubring.kbx chave-collections.asc
```

Passe a verificar na instalação:

```bash
ansible-galaxy collection install namespace.colecao -s https://aap.exemplo.com.br/api/galaxy/ \
  --keyring ~/.ansible/pubring.kbx
```

**4. Assinar e restringir execution environments.** Publique EEs de produção apenas no private automation hub; assine no push (`podman push … --sign-by <chave>`) ou pela ação **Sign execution environment** na UI. Nos clientes (nós de execução / builders), configure `/etc/containers/policy.json` para o endereço do hub com `signedBy` e a chave pública de containers, com `default` em `reject` para o que não for explicitamente confiável — conforme *Configure the client to verify signatures*.

**5. Atualizar job templates e projetos** para imagens cujo nome comece pelo FQDN do hub. Remova referências de produção a registries sem curadoria.

**6. Curadoria.** Conteúdo de terceiros só entra no hub depois de revisão e testes do time dono; a aprovação no hub é o registro dessa decisão, não o substituto dela.

## Validação

- Upload de uma collection de teste fica pendente até a aprovação; depois de aprovada, aparece assinada em **Collections**.
- `ansible-galaxy collection install` com o keyring correto verifica a assinatura; sem a chave, a instalação com verificação falha.
- Job de produção usa EE do private hub marcada como assinada.
- Pull de uma imagem sem assinatura válida a partir de um nó com `policy.json` restritivo é recusado.

## Reversão

- Desative temporariamente `automationhub_require_content_approval` e a verificação no cliente **somente** em emergência documentada; isso reabre o risco.
- Remover a política `signedBy` do `policy.json` nos nós de execução volta a aceitar imagens sem assinatura.
- A chave privada comprometida exige rotação: nova chave, reassinar conteúdo publicado e redistribuir a pública.

## Impacto operacional

- Todo release de collection passa pelo Approval dashboard; automatize só depois do gate humano ou de pipeline que represente a mesma decisão.
- Nós de execução precisam da política de contêineres e da confiança na CA/TLS do hub; `tls-verify=false` em exemplos da documentação é para laboratório, não para produção.
- Espelhos de conteúdo Red Hat Certified continuam úteis, mas o que os jobs de produção consomem deve ser a cópia aprovada no hub privado.

## Detecção

- Publicação ou aprovação de collection e assinatura de EE no activity stream / registros do hub — encaminhe ao agregador ([LS-AAP-007](LS-AAP-007-logs-e-activity-stream-em-agregador.md)).
- Job template que muda a EE para um registry fora do hub.
- Falhas de verificação de assinatura em `ansible-galaxy` ou no pull de imagem nos nós de execução: conteúdo adulterado ou chave não distribuída. Logs do host via [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).

## Referências

- Documentação do Ansible Automation Platform 2.5: *Managing automation content* (Content signing in private automation hub; Configuring Ansible-Galaxy CLI to verify collections; Working with signed containers; Configure the client to verify signatures).
- Documentação do Ansible Automation Platform 2.5: *RPM installation* / *Containerized installation* (Inventory file variables — `automationhub_auto_sign_collections`, `automationhub_require_content_approval` e equivalentes `hub_*`).
- Documentação do Ansible Automation Platform 2.5: *Creating and using execution environments* (publicação e uso de imagens a partir do private automation hub).
