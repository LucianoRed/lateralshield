---
id: LS-OCP-003
titulo: Enviar o log de acesso do ingress para um syslog central
tecnologia: openshift
pilar: detectar
impacto: alto
esforco: baixo
versoes: OpenShift 4.5 ou superior
status: rascunho
---

# LS-OCP-003 — Enviar o log de acesso do ingress para um syslog central

## Problema

O ingress é a porta de entrada de quase todas as aplicações do cluster, e por padrão o roteador do OpenShift **não registra as requisições que atende**. Quando uma aplicação é invadida pela web, não há como responder às perguntas mais básicas: de onde veio a requisição, qual rota foi atingida, quando começou.

Sem esse registro, o ponto de entrada do invasor fica invisível, e toda a investigação começa um passo atrasada.

## Benefício

Toda requisição que entra no cluster passa a ficar registrada fora dele, com origem, rota, código de resposta e horário. Depois de um incidente, é possível identificar a requisição que iniciou a invasão e quais outras aplicações receberam o mesmo tipo de tentativa.

É uma única alteração de configuração, feita uma vez, que vale para todas as aplicações publicadas pelo ingress — sem mexer em nenhuma delas.

## Pré-requisitos

- Um destino syslog alcançável a partir dos nós onde o roteador roda. O campo de endereço aceita **IP**, não nome.
- Permissão de administração do cluster.
- Saber quais IngressControllers existem (`oc get ingresscontroller -n openshift-ingress-operator`).

## Avaliação

```bash
oc get ingresscontroller -n openshift-ingress-operator \
  -o custom-columns='NOME:.metadata.name,LOG_DE_ACESSO:.spec.logging.access.destination.type'
```

- `<none>`: o roteador não registra acessos. **Sem detecção.**
- `Container`: registra, mas apenas em um contêiner auxiliar dentro do cluster; só é útil se os logs do cluster forem coletados e enviados para fora.
- `Syslog`: registra e envia para um destino externo.

## Implementação

```bash
oc patch ingresscontroller default -n openshift-ingress-operator --type=merge -p '
spec:
  logging:
    access:
      destination:
        type: Syslog
        syslog:
          address: 192.0.2.50
          port: 514
'
```

Repita para cada IngressController adicional. O operador recria os pods do roteador de forma gradual.

O formato padrão do HAProxy já traz origem, rota, código de resposta e tempos. Para personalizar, use o campo `spec.logging.access.httpLogFormat`.

Este controle cobre o ingress. Para o log de auditoria da API, veja o [LS-OCP-006](LS-OCP-006-auditoria-da-api-fora-do-cluster.md), que usa o operador OpenShift Logging com um `ClusterLogForwarder`. O mesmo encaminhador atende os logs de aplicações e de infraestrutura.

## Validação

```bash
oc get pods -n openshift-ingress          # os pods do roteador devem estar Running após a troca
curl -sk -o /dev/null https://<alguma-rota-do-cluster>/
```

A requisição deve aparecer no destino syslog em poucos segundos, com o IP de origem e o nome da rota.

## Reversão

```bash
oc patch ingresscontroller default -n openshift-ingress-operator --type=json \
  -p '[{"op":"remove","path":"/spec/logging"}]'
```

## Impacto operacional

- Os pods do roteador são reiniciados de forma gradual na aplicação e na reversão. Com mais de uma réplica não há interrupção perceptível; faça em janela se houver apenas uma.
- O envio é feito por UDP: mensagens podem se perder se o destino estiver indisponível, e o tráfego não é cifrado. Mantenha o destino em rede próxima e confiável.
- O volume é proporcional ao tráfego. Dimensione o destino para clusters com muitas requisições.
- Atrás de balanceador externo, o IP de origem registrado só é o do cliente real se o balanceador preservar a origem (PROXY protocol ou cabeçalho `X-Forwarded-For`).

## Detecção

Com o log de acesso no destino central, alerte para:

- picos de respostas `4xx` e `5xx` em uma mesma rota vindos de uma única origem (varredura ou tentativa de exploração);
- requisições a caminhos administrativos conhecidos (`/jmx-console`, `/management`, `/actuator`, `/console`);
- rotas internas recebendo acesso de origens externas inesperadas.

## Referências

- Documentação do OpenShift Container Platform: *Ingress Operator* (Enabling Ingress access logging).
- Documentação do OpenShift Container Platform: *Logging* (ClusterLogForwarder, saída syslog).
