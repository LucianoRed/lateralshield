# Automação

Playbooks e roles Ansible para avaliar e aplicar controles do LateralShield em tecnologias Red Hat. Funcionam com `ansible-core` na linha de comando e como projeto no Ansible Automation Platform.

Execute os comandos a partir desta pasta (`automacao/`).

## Avaliação (somente leitura)

Os playbooks de avaliação não alteram os sistemas. Para cada controle, informam se o ambiente está exposto.

| Playbook | Controles | Alvo |
|---|---|---|
| `playbooks/avaliar_rhel_jboss.yml` | LS-RHEL-001, LS-JBOSS-001, LS-JBOSS-002, LS-JBOSS-003, LS-AAP-001 | Hosts RHEL, com ou sem JBoss EAP |
| `playbooks/avaliar_openshift.yml` | LS-OCP-001, LS-OCP-002 | Cluster OpenShift, via `oc` autenticado |

```bash
ansible-playbook -i inventario/meu-inventario.yml playbooks/avaliar_rhel_jboss.yml

ansible-playbook playbooks/avaliar_openshift.yml -e ls_ocp_api_int=api-int.cluster.exemplo.com.br
```

O teste do LS-OCP-001 mede a exposição **a partir do host que executa o playbook**. Rode de um host que não seja nó do cluster, em cada rede que interessa.

## Aplicação

| Playbook | Controle | Observações |
|---|---|---|
| `playbooks/aplicar_jboss_egress.yml` | [LS-JBOSS-002](../catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) | RHEL 8 e 9. Começa em modo de auditoria |

Sequência recomendada para o LS-JBOSS-002:

```bash
# 1. Auditoria: registra as conexões fora da lista, sem bloquear
ansible-playbook -i inventario/meu-inventario.yml playbooks/aplicar_jboss_egress.yml

# 2. Depois de completar a lista de destinos a partir dos logs: bloqueio
ansible-playbook -i inventario/meu-inventario.yml playbooks/aplicar_jboss_egress.yml \
  -e ls_jboss_egress_modo=bloquear

# Reversão
ansible-playbook -i inventario/meu-inventario.yml playbooks/aplicar_jboss_egress.yml \
  -e ls_jboss_egress_estado=ausente
```

As variáveis estão documentadas em [roles/jboss_egress/defaults/main.yml](roles/jboss_egress/defaults/main.yml) e exemplificadas em [inventario/exemplo.yml](inventario/exemplo.yml).

## Estado

A automação foi verificada com `ansible-playbook --syntax-check`, `ansible-lint` e `yamllint`. **Ainda não foi executada contra hosts reais** — faz parte da validação em laboratório prevista no [roadmap](../docs/roadmap.md). Use primeiro em ambiente de teste.
