---
id: LS-JBOSS-002
titulo: Limitar as conexões de saída do processo JBoss ao estritamente necessário
tecnologia: jboss-eap
pilar: conter
impacto: alto
esforco: baixo
versoes: JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9
status: rascunho
---

# LS-JBOSS-002 — Limitar as conexões de saída do processo JBoss ao estritamente necessário

## Problema

Um JBoss EAP legado que não pode ser atualizado precisa ser tratado como um servidor que **será** invadido. Quando isso acontece, o invasor herda tudo o que o processo Java pode fazer — e, por padrão, ele pode abrir conexões para qualquer endereço e porta da rede interna: SSH dos vizinhos, outros bancos de dados, consoles de gerenciamento, a API do OpenShift.

Um servidor de aplicação, porém, precisa falar com poucos destinos: o banco de dados, talvez uma fila, um serviço de autenticação, DNS. Este controle restringe a saída **do usuário de sistema do JBoss** a essa lista. A aplicação não muda, o JBoss não é reconfigurado e as conexões de entrada continuam funcionando.

É o controle com melhor relação custo-benefício do catálogo para middleware legado.

## Benefício

Um JBoss invadido passa a alcançar apenas o que já alcançava legitimamente: o seu banco de dados e as suas integrações. Varredura da rede interna, SSH para servidores vizinhos, acesso a outros bancos e download de ferramentas a partir da internet deixam de funcionar para o invasor.

O servidor legado continua vulnerável, mas deixa de ser trampolim. E como a aplicação nunca deveria tentar essas conexões, cada bloqueio é um alerta confiável de invasão em andamento. Tudo isso sem atualizar, reconfigurar ou reiniciar o JBoss.

## Pré-requisitos

- O JBoss roda com um usuário de sistema dedicado (por exemplo, `jboss`), e não como root. Se roda como root, corrija isso antes.
- Acesso root ao servidor.
- RHEL 8 ou 9 com `nftables` (instalado por padrão). Para RHEL 7, veja a variante com `iptables` ao final.
- Lista inicial dos destinos legítimos (datasources em `standalone.xml`/`domain.xml`, integrações conhecidas). Não precisa estar completa: o modo de auditoria revela o restante.

## Avaliação

Confirme o usuário do processo e veja para onde ele se conecta hoje:

```bash
ps -o user=,pid=,cmd= -C java | grep -i jboss
ss -tnp | grep java
```

Se não existe nenhuma regra de saída para esse usuário (`nft list ruleset | grep skuid` vazio), o processo pode alcançar toda a rede: **exposto**.

## Implementação

A automação está em [automacao/roles/jboss_egress](../../automacao/roles/jboss_egress). O procedimento manual equivalente é o seguinte.

**1. Crie `/etc/lateralshield/jboss-egress.nft` em modo de auditoria.**

```nft
table inet lateralshield_jboss
delete table inet lateralshield_jboss

table inet lateralshield_jboss {
  set destinos_permitidos {
    type ipv4_addr . inet_service
    elements = {
      198.51.100.10 . 5432,     # banco de dados
      198.51.100.20 . 61616     # mensageria
    }
  }

  chain saida {
    type filter hook output priority 0; policy accept;

    meta skuid != "jboss" accept
    oifname "lo" accept
    ct state established,related accept

    ip daddr 198.51.100.2 meta l4proto { tcp, udp } th dport 53 accept   # DNS
    ip daddr . tcp dport @destinos_permitidos accept

    limit rate 30/minute log prefix "LS-JBOSS-EGRESS: " level warning
    counter comment "modo auditoria: troque por 'counter drop' para bloquear"
  }
}
```

A regra `ct state established,related accept` mantém as respostas às conexões de **entrada** (os clientes da aplicação). Só são avaliadas as conexões que o próprio JBoss inicia.

**2. Carregue com uma unit dedicada**, independente do firewalld. Crie `/etc/systemd/system/lateralshield-jboss-egress.service`:

```ini
[Unit]
Description=LateralShield - filtro de saida do JBoss (LS-JBOSS-002)
After=network-pre.target
Before=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/lateralshield/jboss-egress.nft
ExecReload=/usr/sbin/nft -f /etc/lateralshield/jboss-egress.nft
ExecStop=/usr/sbin/nft delete table inet lateralshield_jboss

[Install]
WantedBy=multi-user.target
```

```bash
nft -c -f /etc/lateralshield/jboss-egress.nft     # verifica a sintaxe sem aplicar
systemctl daemon-reload
systemctl enable --now lateralshield-jboss-egress.service
```

A tabela é própria e não altera as regras do firewalld. Não use `nftables.service` para isso: ao parar, ele limpa todo o conjunto de regras do host.

**3. Observe por pelo menos um ciclo completo de negócio** (inclua rotinas noturnas e de fechamento):

```bash
journalctl -k -g 'LS-JBOSS-EGRESS' --since '-7d' | grep -o 'DST=[^ ]* .*DPT=[^ ]*' | sort | uniq -c | sort -rn
```

Inclua os destinos legítimos em `destinos_permitidos` e recarregue (`systemctl reload lateralshield-jboss-egress`). Repita até o log ficar vazio em operação normal.

**4. Passe para bloqueio.** Troque a última linha da chain por `counter drop` e recarregue.

### Variante para RHEL 7

O RHEL 7 usa `iptables`. A lógica é a mesma, com o módulo `owner`:

```bash
iptables -N LS_JBOSS
iptables -A OUTPUT -m owner --uid-owner jboss -j LS_JBOSS
iptables -A LS_JBOSS -o lo -j RETURN
iptables -A LS_JBOSS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -A LS_JBOSS -d 198.51.100.2 -p udp --dport 53 -j RETURN
iptables -A LS_JBOSS -d 198.51.100.10 -p tcp --dport 5432 -j RETURN
iptables -A LS_JBOSS -m limit --limit 30/min -j LOG --log-prefix "LS-JBOSS-EGRESS: "
# iptables -A LS_JBOSS -j DROP     # somente depois do período de auditoria
```

Com firewalld ativo, cadastre as mesmas regras como regras diretas (`firewall-cmd --permanent --direct --add-rule ipv4 filter OUTPUT ...`) para que persistam.

## Validação

Como o usuário do JBoss, um destino permitido deve conectar e um destino qualquer deve falhar:

```bash
sudo -u jboss timeout 5 bash -c '</dev/tcp/198.51.100.10/5432' && echo permitido
sudo -u jboss timeout 5 bash -c '</dev/tcp/<ip-de-outro-servidor>/22' || echo bloqueado
nft list table inet lateralshield_jboss      # o contador da última regra deve subir
```

Confirme que a aplicação atende requisições e que os datasources estão conectados.

## Reversão

```bash
systemctl disable --now lateralshield-jboss-egress.service
```

A tabela é removida imediatamente, sem reiniciar o JBoss. Para voltar apenas ao modo de auditoria, restaure a última linha da chain e recarregue.

## Impacto operacional

- Nenhum reinício do JBoss.
- Toda nova integração de saída exige incluir o destino na lista. É um custo deliberado: o servidor deixa de poder falar com o que ninguém autorizou.
- Destinos com IP variável (serviços atrás de DNS com vários endereços) precisam ter todos os endereços cadastrados ou ser acessados via proxy com IP fixo.
- Se o tráfego for IPv6, acrescente regras equivalentes com `ip6 daddr`.
- Limite conhecido: o filtro vale para o usuário do JBoss. Um invasor que escale privilégio para root no host contorna a regra — por isso o serviço não deve ter `sudo` nem rodar como root.

## Detecção

Em modo de bloqueio, cada linha `LS-JBOSS-EGRESS` no log do kernel é uma conexão que a aplicação não deveria fazer. Encaminhe essas mensagens ao agregador de logs e trate como **alerta de alta prioridade**: tentativas para as portas 22, 3389, 445, 5432, 1521, 6443 ou 9990 de outros servidores, ou sequências para muitos destinos, indicam movimentação lateral em andamento.

Combine com a auditoria de processos do [LS-JBOSS-003](LS-JBOSS-003-auditoria-de-processos.md).

## Referências

- Documentação do RHEL: *Configuring firewalls and packet filters* (Getting started with nftables).
- `nft(8)`: expressões `meta skuid`, conjuntos concatenados e `log`.
