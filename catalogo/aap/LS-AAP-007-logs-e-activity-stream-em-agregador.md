---
id: LS-AAP-007
titulo: Enviar os logs e o activity stream para um agregador central
tecnologia: aap
pilar: detectar
impacto: alto
esforco: baixo
versoes: Ansible Automation Platform 2.4 e 2.5 ou superior
status: rascunho
---

# LS-AAP-007 — Enviar os logs e o activity stream para um agregador central

## Problema

O AAP registra quem alterou o quê no **activity stream**: criação de usuários, mudanças em credenciais, concessão de papéis, alteração de job templates. Registra também cada job executado e os eventos de cada tarefa. Por padrão, tudo isso fica no banco de dados e nos arquivos da própria plataforma.

Um invasor que assume uma conta com privilégio no AAP usa a automação para alcançar os servidores e, em seguida, pode apagar os jobs e limpar os registros. Mesmo sem apagar nada, um registro que só existe dentro da plataforma não é visto por quem monitora o ambiente: o uso indevido da automação aparece como mais um job entre centenas.

## Benefício

O uso da automação passa a ter um registro fora do alcance de quem controla a plataforma. Depois de um incidente, é possível responder quais jobs rodaram, com quais credenciais, contra quais servidores e a pedido de quem, mesmo que o AAP tenha sido alterado.

Os eventos mais sensíveis — uma credencial alterada, um novo administrador, um job fora de hora contra produção — passam a gerar alerta no mesmo lugar onde chegam os logs dos servidores, e podem ser correlacionados com eles.

## Pré-requisitos

- Um agregador de logs alcançável a partir dos nós do controller, com endereço, porta e protocolo definidos. Os exemplos usam TCP 514, como em [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).
- Conta de administrador no AAP.
- Estimativa de volume: os eventos de job são, de longe, a maior parte.

## Avaliação

No automation controller 2.4:

```bash
curl -s -H "Authorization: Bearer <token>" \
  https://aap.exemplo.com.br/api/v2/settings/logging/ \
  | jq '{LOG_AGGREGATOR_ENABLED, LOG_AGGREGATOR_HOST, LOG_AGGREGATOR_TYPE, LOG_AGGREGATOR_LOGGERS}'
```

Pela interface: **Settings > Logging settings** no AAP 2.4; **Settings > Automation Execution > Logging** no AAP 2.5 ou superior. Na 2.5 ou superior a API do controller fica atrás do gateway; confira o caminho na raiz `/api/` da instalação.

- `LOG_AGGREGATOR_ENABLED` igual a `false`, ou sem host definido: **sem detecção central.**
- `activity_stream` fora da lista de loggers: as alterações de configuração não saem da plataforma.
- **Enable Activity Stream** desativado nas configurações de sistema: o registro nem sequer é gerado.
- Configuração presente, mas apontando para um destino que não recebe: faça o teste da seção de validação.

## Implementação

**1. Manter o activity stream ativo.** Confirme **Enable Activity Stream** nas configurações de sistema.

**2. Configurar o agregador.** Na tela de logging, preencha o endereço, a porta, o tipo e o protocolo, selecione os loggers e ative **Enable External Logging**. Pela API do automation controller 2.4:

```bash
curl -s -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  https://aap.exemplo.com.br/api/v2/settings/logging/ -d '{
    "LOG_AGGREGATOR_HOST": "192.0.2.50",
    "LOG_AGGREGATOR_PORT": 514,
    "LOG_AGGREGATOR_TYPE": "other",
    "LOG_AGGREGATOR_PROTOCOL": "tcp",
    "LOG_AGGREGATOR_LOGGERS": ["awx", "activity_stream", "job_events", "system_tracking"],
    "LOG_AGGREGATOR_ENABLED": true
  }'
```

Os loggers disponíveis:

| Logger | Conteúdo |
|---|---|
| `activity_stream` | Quem alterou qual objeto da plataforma |
| `job_events` | Eventos das tarefas de cada job |
| `system_tracking` | Fatos coletados dos hosts |
| `awx` | Logs gerais do serviço |

O AAP 2.6 acrescenta `job_lifecycle`. Apenas o logger `awx` aceita ajuste de nível; os demais usam `INFO`. Se o volume for um problema, comece por `activity_stream` e `awx` e inclua `job_events` depois de dimensionar o destino.

**3. Preferir transporte cifrado.** Com TCP ou UDP simples, os eventos trafegam em claro. Use HTTPS quando o agregador aceitar, ou mantenha o destino em rede próxima e confiável.

**4. Cobrir o que este envio não cobre.** O envio acima é configurado no automation controller. No AAP 2.5 ou superior, o gateway mantém um activity stream próprio, com as alterações de usuários, organizações e autenticação (`/api/gateway/v1/activitystream/`); este controle não confirmou como exportá-lo de forma nativa, então verifique na versão em uso. Os logs dos demais serviços e do sistema operacional dos nós seguem pelo rsyslog do host, conforme [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).

## Validação

- Se a tela de logging da versão em uso tiver um botão de teste, use-o.
- Crie e apague um time de teste no AAP e procure os dois eventos no agregador, com o nome do usuário que fez a alteração.
- Execute um job de teste e confirme a chegada dos eventos.
- Se nada chegar com HTTP ou HTTPS, veja `/var/log/tower/rsyslog.err` no nó do controller. O arquivo só existe quando houve erro.

## Reversão

Desative **Enable External Logging** (`"LOG_AGGREGATOR_ENABLED": false`). Os registros continuam sendo gravados localmente.

## Impacto operacional

- Nenhum impacto nos jobs. Quando o destino fica indisponível, as mensagens são guardadas em disco no controller até um limite configurável (1 GB por padrão) e enviadas depois.
- `job_events` pode multiplicar o volume do agregador e carrega a saída das tarefas. Saída de tarefa pode conter dados sensíveis quando o playbook não usa `no_log`; trate o agregador com o mesmo cuidado dado aos servidores.
- Com UDP, mensagens se perdem sem aviso se o destino cair.
- A configuração de logging passa a ser, ela mesma, um ponto sensível: quem a altera desliga a detecção.

## Detecção

Com os eventos no agregador, alerte para:

- criação ou alteração de credenciais e associação de credencial a job template;
- usuário que passa a ser administrador, criação de usuário local e login de conta de emergência ([LS-AAP-003](LS-AAP-003-administrador-somente-break-glass.md));
- alteração nos métodos de autenticação ou na própria configuração de logging;
- comandos ad hoc e jobs contra produção fora do horário ou lançados por usuários que nunca o fizeram;
- **silêncio**: o AAP parar de enviar eventos é falha ou é alguém desligando o envio.

## Referências

- Documentação do Ansible Automation Platform 2.5: *Configuring automation execution* (Logging and Aggregation).
- Documentação do Ansible Automation Platform 2.4: *Automation controller administration guide* (Logging and Aggregation).
- Documentação do Ansible Automation Platform: *Hardening and compliance* (configuração de logging centralizado e do activity stream).
- Documentação do Ansible Automation Platform 2.5: *Access management and authentication* (activity stream do gateway).
