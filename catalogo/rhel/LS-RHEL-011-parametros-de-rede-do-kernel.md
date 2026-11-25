---
id: LS-RHEL-011
titulo: Endurecer os parâmetros de rede do kernel
tecnologia: rhel
pilar: conter
impacto: medio
esforco: baixo
versoes: RHEL 7, 8 e 9
status: rascunho
---

# LS-RHEL-011 — Endurecer os parâmetros de rede do kernel

## Problema

Alguns parâmetros de rede do kernel existem para roteadores e ficam ativos, ou acabam ativados, em servidores comuns. Em uma rede onde um vizinho já foi invadido, eles ajudam o invasor de duas formas:

- **O servidor encaminha pacotes** (`ip_forward`). Um host com duas interfaces e encaminhamento ligado é uma ponte entre segmentos que o firewall de rede deveria separar. O encaminhamento costuma ter sido ligado para um teste, uma VPN antiga ou um contêiner, e ficou.
- **O servidor aceita instruções de roteamento de terceiros.** Redirecionamentos ICMP e pacotes com rota definida pela origem permitem que outra máquina do mesmo segmento desvie o tráfego do servidor para si, ou faça pacotes passarem por caminhos não previstos. Sem filtro de caminho reverso, o servidor também aceita pacotes com endereço de origem forjado.

São técnicas antigas, mas continuam funcionando em redes planas, e servem para interceptar credenciais em trânsito e contornar a segmentação.

## Benefício

Um servidor comum deixa de servir de ponte entre redes e deixa de aceitar que um vizinho invadido redirecione seu tráfego. A segmentação definida nos firewalls de rede passa a valer também para os hosts com mais de uma interface.

Pacotes com origem impossível passam a ser registrados, o que dá visibilidade a tentativas de falsificação de endereço dentro do segmento. A mudança é um arquivo de configuração, sem reinício de aplicação.

## Pré-requisitos

- Saber se o servidor **precisa** encaminhar pacotes: roteadores, gateways de VPN, balanceadores em modo de roteamento, hosts de virtualização e hosts que executam contêineres.
- Saber se há roteamento assimétrico ou múltiplas interfaces na mesma rede, o que afeta o filtro de caminho reverso.

Este controle é para servidores RHEL. Não aplique em nós do OpenShift: neles o encaminhamento é necessário e a configuração do sistema é gerenciada pelo cluster.

## Avaliação

```bash
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding
sysctl net.ipv4.conf.all.accept_redirects net.ipv4.conf.default.accept_redirects \
       net.ipv4.conf.all.secure_redirects net.ipv4.conf.all.send_redirects \
       net.ipv4.conf.all.accept_source_route net.ipv4.conf.all.rp_filter \
       net.ipv4.conf.all.log_martians \
       net.ipv6.conf.all.accept_redirects net.ipv6.conf.all.accept_source_route
ip -br addr
grep -rEs '^\s*net\.' /etc/sysctl.conf /etc/sysctl.d/ /usr/lib/sysctl.d/ /run/sysctl.d/
```

Indicadores de exposição:

- `ip_forward = 1` (ou `forwarding = 1` no IPv6) em servidor que não é roteador nem executa contêineres ou máquinas virtuais. Com mais de uma interface (`ip -br addr`), é uma ponte entre redes.
- `accept_redirects = 1`, `send_redirects = 1` ou `accept_source_route = 1`.
- `rp_filter = 0`.
- `log_martians = 0`: pacotes com origem impossível são descartados sem registro.

O último comando mostra de onde vêm os valores atuais. Um valor diferente do que está nos arquivos indica mudança feita em tempo de execução por alguém ou por algum software.

## Implementação

**1. Aplicar em tempo de execução.** Os valores valem até a próxima reinicialização; se algo parar, basta voltar o parâmetro ou reiniciar.

```bash
sysctl -w net.ipv4.conf.all.log_martians=1
sysctl -w net.ipv4.ip_forward=0
sysctl -w net.ipv4.conf.all.accept_redirects=0
sysctl -w net.ipv4.conf.all.send_redirects=0
```

Comece por `log_martians`, que só registra. Aplique os demais um a um em servidores com rede fora do comum.

**2. Tornar persistente.** Crie `/etc/sysctl.d/60-lateralshield-rede.conf`:

```
# O servidor não é roteador
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Não aceitar nem enviar redirecionamentos ICMP
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Não aceitar pacotes com rota definida pela origem
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Filtro de caminho reverso e registro de origens impossíveis
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
```

```bash
sysctl --system
```

Os valores `all` valem para as interfaces existentes e os `default`, para as que forem criadas depois. Arquivos de `/etc/sysctl.d/` são lidos em ordem alfabética, e o último valor prevalece. Confira com a avaliação que nenhum arquivo posterior, nem o `/etc/sysctl.conf`, desfaz a configuração.

Em servidores com roteamento assimétrico, use `rp_filter = 2` (modo flexível) em vez de `1`.

## Validação

```bash
sysctl --system | grep -A3 '60-lateralshield-rede'
sysctl net.ipv4.ip_forward net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.rp_filter
```

A aplicação e o monitoramento devem continuar alcançando o servidor por todas as interfaces. Reinicie em uma janela e repita a avaliação: os valores devem permanecer.

## Reversão

```bash
rm /etc/sysctl.d/60-lateralshield-rede.conf
sysctl --system
```

`sysctl --system` reaplica os arquivos restantes, mas não devolve ao padrão um parâmetro que deixou de estar em arquivo. Para efeito imediato, ajuste o parâmetro com `sysctl -w` ou reinicie o host.

## Impacto operacional

- **`ip_forward = 0` quebra hosts que encaminham de propósito**: roteadores, gateways de VPN, hosts com contêineres (Podman, Docker) ou máquinas virtuais em rede com NAT. Esses softwares costumam ligar o encaminhamento por conta própria; nesses hosts, retire as duas primeiras linhas do arquivo e registre a exceção.
- `rp_filter = 1` descarta tráfego legítimo em servidores com mais de uma interface e rotas assimétricas. O sintoma é uma conexão que funciona por uma interface e falha por outra.
- Desligar os redirecionamentos não afeta redes bem configuradas. Em redes que dependem deles para corrigir uma rota padrão errada, o tráfego fica menos eficiente ou para: corrija a tabela de rotas.
- `log_martians` pode gerar volume em redes com equipamentos mal configurados. O kernel limita a taxa dessas mensagens.
- Quem tem `root` no servidor reverte qualquer um desses parâmetros. O controle protege contra vizinhos invadidos e contra configuração esquecida, e não contra quem já tem privilégio total no próprio host.

## Detecção

Com `log_martians`, o kernel registra pacotes com origem impossível em mensagens que contêm `martian source`:

```bash
journalctl -k | grep -i 'martian'
```

Encaminhe ao destino central ([LS-RHEL-002](LS-RHEL-002-syslog-central.md)). Mensagens repetidas a partir de um mesmo segmento indicam falsificação de endereço ou erro de roteamento; os dois merecem investigação.

O sinal mais útil é a **mudança de configuração**: um servidor comum em que `ip_forward` voltou a `1` foi alterado por alguém. Repita a avaliação periodicamente e registre as alterações nos arquivos com o audit, acrescentando às regras do [LS-RHEL-003](LS-RHEL-003-auditd-identidade-sudo-e-modulos.md):

```
-w /etc/sysctl.conf -p wa -k ls_sysctl
-w /etc/sysctl.d/ -p wa -k ls_sysctl
```

Essas regras não registram mudanças feitas só em tempo de execução, com `sysctl -w`; para essas, a comparação periódica é o que detecta.

## Referências

- Documentação do kernel Linux: *IP Sysctl* (`ip_forward`, `accept_redirects`, `send_redirects`, `accept_source_route`, `rp_filter`, `log_martians`).
- Red Hat Customer Portal: *What IPv4 network hardening sysctls are available in RHEL?* (solução 7085277).
- `sysctl(8)`, `sysctl.d(5)`.
