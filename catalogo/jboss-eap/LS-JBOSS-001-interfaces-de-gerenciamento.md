---
id: LS-JBOSS-001
titulo: Fechar as interfaces de gerenciamento do JBoss EAP para a rede
tecnologia: jboss-eap
pilar: prevenir
impacto: alto
esforco: baixo
versoes: JBoss EAP 5.x, 6.x, 7.x
status: rascunho
---

# LS-JBOSS-001 — Fechar as interfaces de gerenciamento do JBoss EAP para a rede

## Problema

As interfaces de gerenciamento do JBoss EAP permitem implantar aplicações e alterar a configuração do servidor, o que equivale a executar código no host. Em versões legadas, é comum estarem expostas para toda a rede interna, com credenciais fracas ou, no EAP 5, sem autenticação.

Para quem já invadiu um servidor vizinho, um console de gerenciamento acessível é o caminho mais curto para o próximo.

| Versão | Interfaces e portas padrão |
|---|---|
| EAP 7.x | Gerenciamento HTTP/console 9990, HTTPS 9993 |
| EAP 6.x | Console 9990, gerenciamento nativo 9999 |
| EAP 5.x | `jmx-console`, `web-console`, `admin-console` e invocadores HTTP na porta da aplicação (8080); JNDI/RMI 1098, 1099; invocadores 4444, 4445, 4446 |

## Benefício

O caminho mais simples para tomar um JBoss — implantar uma aplicação pelo console — deixa de existir para quem está na rede. Um servidor invadido não consegue mais usar o gerenciamento dos vizinhos para se espalhar, e ataques conhecidos contra consoles de versões legadas perdem o alvo, mesmo sem atualizar o produto.

A administração continua possível, agora por um caminho único e registrado.

## Pré-requisitos

- Acesso root ao servidor.
- Saber de onde o gerenciamento é feito de fato (bastion, domain controller, ferramenta de deploy).

## Avaliação

No servidor:

```bash
ss -tlnp | grep -E ':(9990|9993|9999|1098|1099|4444|4445|4446)\s'
```

Qualquer linha escutando em `0.0.0.0`, `*`, `[::]` ou em um IP de rede (diferente de `127.0.0.1`) indica interface exposta.

No EAP 5, verifique também os consoles implantados:

```bash
ls $JBOSS_HOME/server/*/deploy | grep -E 'jmx-console|web-console|admin-console|management|http-invoker'
```

A partir de outro servidor da rede, confirme o que é alcançável:

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 http://<servidor>:9990/management
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 http://<servidor>:8080/jmx-console/
```

## Implementação

**EAP 6.x e 7.x, modo standalone.** Mantenha o gerenciamento em `127.0.0.1` (é o padrão; a exposição costuma vir de `-bmanagement=0.0.0.0` ou de `jboss.bind.address.management` no script de serviço ou em `standalone.conf`). Remova o parâmetro e reinicie. A administração remota passa a ser feita por túnel SSH a partir do bastion:

```bash
ssh -L 9990:127.0.0.1:9990 <usuario>@<servidor>
```

**EAP 6.x e 7.x, modo domain.** Os host controllers precisam alcançar o domain controller. Mantenha o gerenciamento em uma interface de rede administrativa e limite a origem com firewalld:

```bash
firewall-cmd --permanent --new-zone=ls-jboss-adm
firewall-cmd --permanent --zone=ls-jboss-adm --add-source=<ip-do-host-controller>/32
firewall-cmd --permanent --zone=ls-jboss-adm --add-port=9999/tcp   # EAP 6; use 9990/tcp no EAP 7
firewall-cmd --reload
```

Confirme que a porta de gerenciamento não está liberada na zona padrão. A zona de origem passa a valer para todo o tráfego desses IPs: adicione também as demais portas que eles precisam alcançar.

**EAP 5.x.** Remova do diretório `deploy` do perfil em uso o que não é utilizado: `jmx-console.war`, `management/` (web-console), `admin-console.war` e `http-invoker.sar`. Guarde uma cópia fora do diretório `deploy`. Para as portas 1098, 1099 e 4444–4446, bloqueie no firewall do host tudo que não venha dos membros do cluster ou dos clientes EJB conhecidos.

**Em todos os casos.** Confirme que nenhum usuário de gerenciamento usa senha padrão ou compartilhada entre servidores (`mgmt-users.properties`).

## Validação

- Repita a avaliação: as portas devem escutar apenas em `127.0.0.1` ou responder apenas às origens administrativas.
- Do bastion, pelo túnel ou pela origem permitida, o console e o CLI (`jboss-cli.sh --connect`) devem funcionar.
- A aplicação deve responder normalmente na porta de negócio.

## Reversão

- Restaure o parâmetro de bind anterior e reinicie o serviço.
- firewalld: `firewall-cmd --permanent --delete-zone=ls-jboss-adm && firewall-cmd --reload`.
- EAP 5: devolva os diretórios removidos para `deploy`.

## Impacto operacional

- Exige um reinício do JBoss quando o bind é alterado.
- Ferramentas de deploy e monitoramento que usam a API de gerenciamento pela rede precisam ser incluídas nas origens permitidas ou passar a usar túnel.
- No EAP 5, alguns monitoramentos antigos consultam o `jmx-console`; confirme antes de remover.

## Detecção

- Registre no firewall tentativas de conexão às portas de gerenciamento vindas de origens não permitidas.
- No EAP 7, ative o log de auditoria de gerenciamento (`/core-service=management/access=audit/logger=audit-log:write-attribute(name=enabled,value=true)`) e encaminhe-o ao agregador de logs.

## Referências

- Documentação do JBoss EAP: *Configuration Guide* (Management interfaces; Interfaces and socket bindings).
- Documentação do JBoss EAP: *How to Configure Server Security* (Securing the management interfaces; Management audit logging).
