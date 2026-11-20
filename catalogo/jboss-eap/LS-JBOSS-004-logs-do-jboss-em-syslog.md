---
id: LS-JBOSS-004
titulo: Enviar os logs do JBoss EAP para um syslog central
tecnologia: jboss-eap
pilar: detectar
impacto: alto
esforco: baixo
versoes: JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9
status: rascunho
---

# LS-JBOSS-004 — Enviar os logs do JBoss EAP para um syslog central

## Problema

O `server.log` de um JBoss registra erros de desserialização, implantações inesperadas, falhas de autenticação e exceções que costumam acompanhar uma tentativa de exploração. Esse arquivo fica no diretório do próprio servidor, pertence ao usuário do JBoss e pode ser apagado ou alterado por quem invadir o processo.

Em um servidor legado, que se assume que será invadido, deixar o único registro sob controle do invasor é perder a evidência no momento em que ela mais importa.

## Benefício

O que o JBoss registra passa a ter uma cópia fora do servidor, que o invasor não alcança. A equipe consegue ver a tentativa de exploração enquanto ela acontece e, depois, reconstruir o incidente sem depender do host comprometido.

Há duas formas de fazer, e a primeira **não exige nenhuma alteração no JBoss** — o que a torna aplicável mesmo aos servidores mais antigos e intocáveis.

## Pré-requisitos

- O servidor já encaminha logs para um destino central: [LS-RHEL-002](../rhel/LS-RHEL-002-syslog-central.md).
- Caminho do log do JBoss (por exemplo, `$JBOSS_HOME/standalone/log/server.log`; no EAP 5, `$JBOSS_HOME/server/<perfil>/log/server.log`).

## Avaliação

```bash
grep -rEsh 'imfile|server\.log' /etc/rsyslog.conf /etc/rsyslog.d/ || echo "rsyslog não lê o log do JBoss"
```

No EAP 6 e 7, verifique também se há um handler de syslog configurado:

```bash
$JBOSS_HOME/bin/jboss-cli.sh --connect --command='/subsystem=logging:read-children-names(child-type=syslog-handler)'
```

Sem leitura pelo rsyslog e sem handler de syslog, o log do JBoss existe apenas no servidor: **sem detecção central**.

## Implementação

### Opção A — rsyslog lê o arquivo (qualquer versão, sem tocar no JBoss)

Crie `/etc/rsyslog.d/80-lateralshield-jboss.conf`:

```
module(load="imfile")
input(type="imfile"
      File="/opt/jboss-eap/standalone/log/server.log"
      Tag="jboss-eap:"
      Severity="info"
      Facility="local1")
```

```bash
rsyslogd -N1 && systemctl restart rsyslog
```

O rsyslog acompanha o arquivo e envia cada linha nova pelo encaminhamento já configurado no LS-RHEL-002. O JBoss não é reiniciado nem reconfigurado. Use um arquivo `input` por instância quando houver mais de uma.

### Opção B — handler de syslog do próprio JBoss (EAP 6 e 7)

O subsistema de logging do EAP tem um handler que envia direto para um servidor syslog, por UDP:

```
/subsystem=logging/syslog-handler=LS_SYSLOG:add(server-address=192.0.2.50, port=514, app-name=jboss-eap, facility=local-use-1, syslog-format=RFC5424, level=INFO)
/subsystem=logging/root-logger=ROOT:add-handler(name=LS_SYSLOG)
```

Em modo domain, prefixe os comandos com `/profile=<perfil>`. A alteração vale em tempo de execução, sem reinício.

A opção B envia os registros diretamente da JVM, sem passar por arquivo. A opção A é a recomendada para legado: funciona em todas as versões, usa TCP com fila em disco e mantém o JBoss intocado.

### Complementos

- **Log de acesso HTTP.** O EAP não registra requisições por padrão. No EAP 7: `/subsystem=undertow/server=default-server/host=default-host/setting=access-log:add`. Inclua o arquivo gerado (`access_log.log`) em outro `input` do rsyslog.
- **Auditoria de gerenciamento** (EAP 6 e 7): veja a seção de detecção do [LS-JBOSS-001](LS-JBOSS-001-interfaces-de-gerenciamento.md).

## Validação

Provoque um registro — por exemplo, uma requisição a uma URL inexistente da aplicação ou a reimplantação de um artefato em homologação — e confirme que a linha correspondente do `server.log` aparece no destino central, marcada com `jboss-eap`.

## Reversão

- Opção A: `rm /etc/rsyslog.d/80-lateralshield-jboss.conf && systemctl restart rsyslog`.
- Opção B:

  ```
  /subsystem=logging/root-logger=ROOT:remove-handler(name=LS_SYSLOG)
  /subsystem=logging/syslog-handler=LS_SYSLOG:remove
  ```

## Impacto operacional

- Opção A: nenhum impacto no JBoss. Com SELinux em `enforcing`, o rsyslog pode não ter permissão para ler arquivos fora de `/var/log`; verifique com `ausearch -m avc -ts recent` e, se necessário, ajuste o contexto do diretório de logs (`semanage fcontext` com o tipo `var_log_t`, seguido de `restorecon`).
- Stack traces de várias linhas chegam como várias mensagens. Para agrupá-las, use o parâmetro `startmsg.regex` do `imfile`.
- Opção B: o envio é por UDP e sem fila; mensagens se perdem se o destino estiver fora do ar.
- JBoss com nível de log `DEBUG` gera volume alto. Encaminhe a partir de `INFO`.

## Detecção

Com o log no destino central, alerte para:

- exceções de desserialização e de classe não encontrada em sequência (`InvalidClassException`, `ClassNotFoundException` em invocadores);
- implantações fora de janela de mudança (`Deployed`, `Starting deployment`);
- falhas repetidas de autenticação no realm de gerenciamento;
- **silêncio**: um JBoss em produção que para de enviar logs.

Combinado com [LS-JBOSS-002](LS-JBOSS-002-egress-por-usuario.md) e [LS-JBOSS-003](LS-JBOSS-003-auditoria-de-processos.md), dá a sequência completa de um ataque: a requisição que explorou, o comando executado e a conexão que tentou sair.

## Referências

- Documentação do JBoss EAP: *Configuration Guide* (Logging; Configure a syslog handler).
- Documentação do rsyslog: módulo `imfile`.
