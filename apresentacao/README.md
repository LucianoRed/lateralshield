# Apresentação do LateralShield

Deck de apresentação do projeto, em um único arquivo: [index.html](index.html). Abra no navegador; não há dependências além das fontes do Google Fonts.

Navegação: setas ← →, clique ou swipe. Nos slides com estágios, → avança o estágio antes de trocar de slide. O menu "Ir para" no rodapé salta para qualquer slide.

## Estrutura

| # | Slide | Conteúdo |
|---|---|---|
| 1 | Capa | Nome, os três pilares e o aviso de iniciativa independente |
| 2 | O problema | Diagrama em dois estágios: rede plana × rede contida |
| 3 | Método | 80/20, três pilares, quatro tecnologias |
| 4 | Controles | Mapa navegável: um card por tecnologia |
| 5 | JBoss EAP | Os três controles para o legado que não pode ser atualizado |
| 6 | RHEL | Diagrama em dois estágios: SSH antes e depois do bastion |
| 7 | OpenShift | Machine Config Server e isolamento entre namespaces |
| 8 | Ansible Automation Platform | Chave de automação restrita à origem |
| 9 | Estado atual | Controles escritos, validados e candidatos; fases do roadmap |
| 10 | Como participar | Validar, contribuir, relatar |

## Manutenção

- Os números dos slides 4 e 9 (controles escritos, validados, candidatos no roadmap) vêm de [catalogo/INDICE.md](../catalogo/INDICE.md) e de [docs/roadmap.md](../docs/roadmap.md). Atualize o deck quando eles mudarem.
- O layout segue o template "Red Hat moderno": um slide, uma ideia; pouco texto; diagramas em SVG. O CSS e o JavaScript são os do template; a única adição é a regra `.lever-grid.two`, no fim do `<style>`.
- Os diagramas foram desenhados para projetor. No celular os slides funcionam, mas o texto dentro dos diagramas fica pequeno.

## Marca

O deck usa o logotipo da Red Hat, que é marca registrada. O LateralShield é uma iniciativa comunitária independente e não é um produto oficial nem suportado pela Red Hat — o aviso está na capa. Confirme se o uso do logotipo é adequado ao contexto antes de publicar ou distribuir o deck.
