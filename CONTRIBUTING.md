# Contribuindo com o LateralShield

Qualquer profissional interessado pode contribuir. Não é preciso vínculo com a Red Hat nem com qualquer empresa.

## O que aceitamos

- Novos controles para OpenShift, RHEL, JBoss EAP e Ansible Automation Platform.
- Correções técnicas, relatos de validação em laboratório ou produção, e melhorias de reversão.
- Automação Ansible de avaliação e aplicação para controles existentes.
- Propostas de expansão para outras tecnologias Red Hat (abra uma issue antes).

## O que não aceitamos

- Conteúdo de vendas, posicionamento comercial ou geração de oportunidades.
- Controles que dependam de um produto comercial de terceiros sem alternativa nativa, salvo quando não houver outra forma de proteger o ambiente Red Hat.
- Controles sem procedimento de validação e de reversão.
- Material ofensivo: exploits, cargas ou passo a passo de ataque. Descreva o risco apenas no nível necessário para justificar e testar a defesa.

## Critérios de um controle

Um controle entra no catálogo quando:

1. Resolve um problema real em tecnologia Red Hat.
2. Pertence a um pilar: **prevenir**, **conter** ou **detectar**.
3. Passa no filtro 80/20 descrito na [metodologia](docs/metodologia.md): impacto alto ou médio com esforço baixo ou médio.
4. Usa, de preferência, recursos nativos da plataforma.
5. Segue o [modelo de controle](catalogo/_MODELO.md), com todas as seções preenchidas.

## Fluxo

1. Copie `catalogo/_MODELO.md` para a pasta da tecnologia, usando o próximo identificador livre (`LS-OCP-NNN`, `LS-RHEL-NNN`, `LS-JBOSS-NNN`, `LS-AAP-NNN`).
2. Preencha o cabeçalho e as seções. Novos controles entram com `status: rascunho`.
3. Rode `python3 scripts/catalogo.py` para validar e regenerar `catalogo/INDICE.md`.
4. Se houver automação, rode `ansible-playbook --syntax-check` e `yamllint automacao`.
5. Abra o pull request descrevendo onde e como o controle foi testado (versões, topologia).

## Contribuindo com agentes de IA

O uso de agentes de IA é bem-vindo. O arquivo [AGENTS.md](AGENTS.md) contém as instruções que eles devem seguir neste repositório. A responsabilidade pelo conteúdo enviado continua sendo de quem abre o pull request: revise o que o agente escreveu e informe o que foi de fato testado.

## Status dos controles

| Status | Significado |
|---|---|
| `rascunho` | Escrito e revisado em texto, sem validação prática registrada |
| `validado` | Aplicado e revertido com sucesso em laboratório, com versões registradas no controle |
| `em-producao` | Há pelo menos um relato de uso em produção |

## Idioma e estilo

- Documentação em português brasileiro. Nomes de comandos, parâmetros e produtos ficam no original.
- Frases diretas. Explique o porquê do controle em termos de movimentação lateral.
- Use endereços de exemplo das faixas de documentação (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) e nunca dados de ambientes reais.

## Vulnerabilidades

Não abra issue pública para vulnerabilidades em produtos. Reporte ao fornecedor (para produtos Red Hat: `secalert@redhat.com`). O LateralShield trata de configuração e arquitetura defensiva.
