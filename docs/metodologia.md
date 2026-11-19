# Metodologia

O LateralShield parte de uma premissa: **assuma o comprometimento**. Algum componente do ambiente será invadido em algum momento. A pergunta útil deixa de ser "como impedir toda invasão?" e passa a ser "o que o invasor consegue alcançar a partir daqui, e em quanto tempo eu percebo?".

## Os três pilares

Todo controle do catálogo pertence a um pilar principal.

| Pilar | Pergunta que responde | Exemplos |
|---|---|---|
| **Prevenir** | Como reduzo a chance do comprometimento inicial? | Fechar consoles de gerenciamento, remover componentes não usados, exigir autenticação |
| **Conter** | Se este componente for invadido, o que ele consegue alcançar? | Filtro de saída por processo, NetworkPolicy, restrição de SSH entre servidores, credenciais com escopo mínimo |
| **Detectar** | Em quanto tempo eu percebo? | Log de conexões bloqueadas, auditoria de execução de processos, acessos fora do padrão a portas internas |

Conter é o pilar que dá nome ao projeto e o que costuma estar mais abandonado: ambientes com bom perímetro e rede interna plana.

Um bom controle de contenção quase sempre gera detecção de graça. Uma regra que bloqueia a saída do JBoss para a rede interna também registra a tentativa — e um servidor de aplicação tentando abrir SSH para o vizinho é um sinal de altíssima qualidade.

## Filtro 80/20

Cada controle recebe duas notas:

- **Impacto** (`alto`, `medio`, `baixo`): quanto reduz a capacidade de movimentação lateral ou o tempo até a detecção.
- **Esforço** (`baixo`, `medio`, `alto`): trabalho de implantação e operação contínua, incluindo risco de indisponibilidade.

| | Esforço baixo | Esforço médio | Esforço alto |
|---|---|---|---|
| **Impacto alto** | Prioridade 1 | Prioridade 2 | Só com justificativa |
| **Impacto médio** | Prioridade 2 | Prioridade 3 | Fora do catálogo |
| **Impacto baixo** | Prioridade 3 | Fora do catálogo | Fora do catálogo |

Critérios práticos de esforço baixo: usa recurso nativo já instalado, não exige reinício da aplicação ou exige apenas um, pode ser aplicado em modo de observação antes de bloquear, e a reversão é um comando.

## Anatomia de um controle

Todo controle segue o [modelo](../catalogo/_MODELO.md) e responde, nesta ordem:

1. **Problema** — o que está exposto e como isso ajuda a movimentação lateral.
2. **Benefício** — o que muda para o invasor e para a operação depois da implementação.
3. **Pré-requisitos** — versões, acessos e informações necessárias.
4. **Avaliação** — como verificar, sem alterar nada, se o ambiente está exposto.
5. **Implementação** — passos reproduzíveis, preferindo modo de observação antes do bloqueio.
6. **Validação** — como confirmar que o controle funciona e que a aplicação continua funcionando.
7. **Reversão** — como desfazer rapidamente.
8. **Impacto operacional** — o que pode quebrar e o que muda na rotina.
9. **Detecção** — que sinal o controle gera e onde procurá-lo.
10. **Referências** — documentação oficial e fontes.

Um controle sem validação e reversão não entra no catálogo.

### O benefício precisa estar explícito

Todo controle declara, logo depois do problema, o benefício de implementá-lo. Quem decide aplicar um controle precisa entender em um minuto o que ganha, antes de ler qualquer comando. A seção deve:

- descrever o resultado, e não a configuração: o que o invasor deixa de conseguir e o que a operação passa a ter;
- ser concreta e proporcional — sem promessas como "elimina o risco";
- incluir um diagrama de antes e depois quando o controle muda quem pode falar com quem. O [LS-RHEL-001](../catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) é a referência.

## Ciclo de adoção

1. **Avaliar** — rodar as avaliações do catálogo e registrar a exposição atual.
2. **Priorizar** — ordenar por prioridade 80/20 e pelo que o [modelo de ameaça](modelo-de-ameaca.md) indica como caminho mais provável.
3. **Observar** — aplicar em modo de auditoria quando o controle permitir, e coletar o comportamento legítimo.
4. **Aplicar** — bloquear, em homologação e depois em produção, com a reversão testada.
5. **Verificar** — repetir a avaliação periodicamente; configuração de segurança se degrada com o tempo.

## Relação com outros referenciais

O LateralShield não substitui CIS Benchmarks, guias STIG, o Compliance Operator ou o OpenSCAP. Esses referenciais são amplos e voltados a conformidade. O LateralShield é estreito e voltado a um resultado: dificultar a movimentação lateral com poucas medidas de alto retorno. Quando um controle coincide com um item desses referenciais, o controle cita a referência.
