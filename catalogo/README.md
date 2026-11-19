# Catálogo de controles

O catálogo reúne os controles do LateralShield para tecnologias Red Hat. Cada controle é um arquivo Markdown com cabeçalho de metadados e as seções definidas na [metodologia](../docs/metodologia.md).

**[Ver o índice completo](INDICE.md)** (gerado por `python3 scripts/catalogo.py`).

## Organização

| Pasta | Tecnologia | Prefixo |
|---|---|---|
| [openshift/](openshift/) | Red Hat OpenShift | `LS-OCP-` |
| [rhel/](rhel/) | Red Hat Enterprise Linux | `LS-RHEL-` |
| [jboss-eap/](jboss-eap/) | Red Hat JBoss EAP | `LS-JBOSS-` |
| [aap/](aap/) | Red Hat Ansible Automation Platform | `LS-AAP-` |

## Metadados

| Campo | Valores |
|---|---|
| `id` | Prefixo da tecnologia e número sequencial, igual ao início do nome do arquivo |
| `titulo` | Título curto |
| `tecnologia` | `openshift`, `rhel`, `jboss-eap`, `aap` |
| `pilar` | `prevenir`, `conter`, `detectar` |
| `impacto` | `alto`, `medio`, `baixo` |
| `esforco` | `baixo`, `medio`, `alto` |
| `versoes` | Texto livre com as versões aplicáveis |
| `status` | `rascunho`, `validado`, `em-producao` |

Para propor um controle, copie [_MODELO.md](_MODELO.md) e siga o [guia de contribuição](../CONTRIBUTING.md).
