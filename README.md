# LateralShield

**Segurança pragmática para tecnologias Red Hat.**

**Prevenir. Conter. Detectar.**

*Assuma o comprometimento. Contenha o impacto.*

O LateralShield é um projeto open source que reúne tecnologias, métodos, processos, recomendações e automações simples de implementar para prevenir ataques, conter movimentações laterais e detectar atividades suspeitas em ambientes baseados em soluções Red Hat.

Inspirado no princípio 80/20, busca identificar medidas de alto impacto e baixa complexidade, capazes de melhorar significativamente a postura de segurança sem exigir grandes projetos ou investimentos.

> O LateralShield é uma iniciativa comunitária independente. **Não é um produto oficial nem suportado pela Red Hat.** Red Hat, OpenShift, RHEL, JBoss e Ansible são marcas da Red Hat, Inc., citadas aqui apenas para identificar as tecnologias protegidas.

## O problema

A maioria dos incidentes graves não termina no primeiro servidor invadido. O atacante entra por um ponto fraco — um JBoss EAP legado que não pode ser atualizado, uma credencial vazada, um pod vulnerável — e a partir dali se move para dentro: banco de dados, outros servidores, o plano de controle do cluster.

Dois exemplos que motivaram o projeto:

- **JBoss EAP legado.** Há servidores que não podem ser atualizados no curto prazo. Se não é possível impedir toda invasão, é possível impedir que o processo do JBoss abra conexões para qualquer destino além do banco de dados que ele realmente usa. Ver [LS-JBOSS-002](catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md).
- **OpenShift.** O Machine Config Server (portas 22623/22624) entrega a configuração Ignition dos nós sem autenticação para quem alcançar a porta na rede local. Ver [LS-OCP-001](catalogo/openshift/LS-OCP-001-machine-config-server.md).

## Escopo tecnológico

| Tecnologia | Foco |
|---|---|
| **Red Hat OpenShift** | Infraestrutura do cluster, serviços internos, workloads, redes, identidades e interfaces administrativas |
| **Red Hat Enterprise Linux (RHEL)** | Hardening do sistema operacional, segmentação, controle de acesso, serviços e monitoramento |
| **Red Hat JBoss EAP** | Proteção de middleware, especialmente versões legadas que não podem ser atualizadas imediatamente |
| **Red Hat Ansible Automation Platform** | Automação de assessments, aplicação de controles e verificação de conformidade |

Outras tecnologias Red Hat podem entrar no escopo conforme a relevância dos riscos e a disponibilidade de contribuições. Ferramentas de terceiros são aceitas quando necessárias para proteger ambientes Red Hat, sem desviar o foco do projeto.

## Princípios

1. **Foco Red Hat** — problemas reais de segurança em ambientes que utilizam tecnologias Red Hat.
2. **Segurança 80/20** — o maior benefício de segurança com o menor esforço e complexidade possíveis.
3. **Prevenir, Conter e Detectar** — todo controle pertence a um desses três pilares.
4. **Simplicidade operacional** — funcionalidades nativas, configurações existentes e procedimentos reproduzíveis.
5. **Segurança na implementação** — todo controle documenta pré-requisitos, impactos, validação e reversão.
6. **Independência comercial** — sem conteúdo de vendas, posicionamento comercial ou geração de oportunidades.
7. **Colaboração aberta** — contribuições de qualquer profissional interessado.
8. **Português brasileiro** — toda a documentação pública em pt-BR.

## Como usar

1. Leia a [metodologia](docs/metodologia.md) e o [modelo de ameaça](docs/modelo-de-ameaca.md).
2. Escolha controles no [catálogo](catalogo/INDICE.md), começando pelos de impacto alto e esforço baixo.
3. Rode a etapa de **avaliação** de cada controle antes de mudar qualquer coisa.
4. Aplique em laboratório ou homologação, valide e só então leve para produção. Todo controle traz a reversão.
5. Use a [automação Ansible](automacao/README.md) para repetir avaliação e aplicação em escala.

## Estrutura do repositório

| Caminho | Conteúdo |
|---|---|
| [docs/](docs/) | Metodologia, modelo de ameaça e roadmap |
| [catalogo/](catalogo/) | Controles, um arquivo por controle, organizados por tecnologia |
| [automacao/](automacao/) | Playbooks e roles Ansible de avaliação e aplicação |
| [scripts/](scripts/) | Validação do catálogo e geração do índice |

## Estado atual

Projeto em fase inicial. Os controles publicados estão com status `rascunho`: foram escritos a partir de documentação e experiência de campo, mas **ainda não passaram pela validação em laboratório** exigida pela metodologia. Teste antes de aplicar em produção. O [roadmap](docs/roadmap.md) lista o que vem a seguir.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Relatos de campo, correções e novos controles são bem-vindos.

## Licença

[Apache License 2.0](LICENSE).
