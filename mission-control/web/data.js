// Gerado por scripts/mission_control.py a partir de catalogo/ e docs/. Não edite manualmente.
window.LS_DADOS = {
 "aviso": "Gerado por scripts/mission_control.py a partir de catalogo/ e docs/. Não edite manualmente.",
 "repositorio": "https://github.com/LucianoRed/lateralshield",
 "tecnologias": [
  {
   "id": "openshift",
   "nome": "Red Hat OpenShift",
   "curto": "OpenShift"
  },
  {
   "id": "rhel",
   "nome": "Red Hat Enterprise Linux",
   "curto": "RHEL"
  },
  {
   "id": "jboss-eap",
   "nome": "Red Hat JBoss EAP",
   "curto": "JBoss EAP"
  },
  {
   "id": "aap",
   "nome": "Red Hat Ansible Automation Platform",
   "curto": "AAP"
  }
 ],
 "controles": [
  {
   "id": "LS-OCP-001",
   "titulo": "Restringir o acesso ao Machine Config Server",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-001-machine-config-server.md",
   "problema": "O Machine Config Server (MCS) roda nos nós de plano de controle e atende nas portas **22623/TCP e 22624/TCP**, normalmente atrás do endereço `api-int`. Ele entrega a configuração Ignition a máquinas que estão entrando no cluster e, por isso, **não exige autenticação**: uma máquina nova ainda não tem identidade.",
   "beneficio": "O pull secret, o kubeconfig de bootstrap e os arquivos de configuração dos nós deixam de estar disponíveis para qualquer host da rede interna. Um invasor que comprometa um servidor vizinho ao cluster perde uma fonte de credenciais que hoje não exige nenhum esforço, e o cluster deixa de ser alcançável a partir de um incidente que começou fora dele.",
   "avaliacao": "A partir de um host que **não** é nó do cluster — repita de cada rede relevante (servidores, estações, VPN):\n\n```bash\ncurl -sk -o /dev/null -w '%{http_code}\\n' --max-time 5 \\\n  -H 'Accept: application/vnd.coreos.ignition+json;version=3.2.0' \\\n  https://api-int.<cluster>.<dominio>:22623/config/worker\n```\n\n- `200`: o MCS está acessível dessa origem. **Exposto.**\n- Tempo esgotado ou conexão recusada: a origem está bloqueada.\n\nTeste também o IP de cada nó de plano de controle diretamente, pois o balanceador pode estar protegido e os nós não.\n\nVerifique ainda se há segredos em MachineConfigs, pois eles são servidos pelo MCS:\n\n```bash\noc get machineconfig -o name\noc get machineconfig <nome> -o yaml   # procure senhas, chaves e tokens em arquivos e units\n```"
  },
  {
   "id": "LS-OCP-002",
   "titulo": "Aplicar NetworkPolicy de negação padrão nos namespaces de aplicação",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.x com OVN-Kubernetes",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md",
   "problema": "Sem NetworkPolicy, a rede de pods do OpenShift é plana: qualquer pod alcança qualquer outro pod de qualquer namespace. Um invasor que compromete uma aplicação pouco importante consegue falar diretamente com o banco de dados, o cache e as APIs internas de todas as outras.",
   "beneficio": "A invasão de uma aplicação fica restrita ao namespace dela. Bancos de dados, caches e APIs internas das demais aplicações deixam de ser alcançáveis a partir de um pod comprometido, mesmo que não tenham autenticação.",
   "avaliacao": "Liste os namespaces de aplicação sem nenhuma NetworkPolicy:\n\n```bash\nfor ns in $(oc get ns -o jsonpath='{.items[*].metadata.name}'); do\n  case \"$ns\" in openshift*|kube-*|default) continue ;; esac\n  [ \"$(oc get networkpolicy -n \"$ns\" --no-headers 2>/dev/null | wc -l)\" -eq 0 ] && echo \"$ns\"\ndone\n```\n\nTodo namespace listado aceita conexões de qualquer pod do cluster."
  },
  {
   "id": "LS-OCP-003",
   "titulo": "Enviar o log de acesso do ingress para um syslog central",
   "tecnologia": "openshift",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.5 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md",
   "problema": "O ingress é a porta de entrada de quase todas as aplicações do cluster, e por padrão o roteador do OpenShift **não registra as requisições que atende**. Quando uma aplicação é invadida pela web, não há como responder às perguntas mais básicas: de onde veio a requisição, qual rota foi atingida, quando começou.",
   "beneficio": "Toda requisição que entra no cluster passa a ficar registrada fora dele, com origem, rota, código de resposta e horário. Depois de um incidente, é possível identificar a requisição que iniciou a invasão e quais outras aplicações receberam o mesmo tipo de tentativa.",
   "avaliacao": "```bash\noc get ingresscontroller -n openshift-ingress-operator \\\n  -o custom-columns='NOME:.metadata.name,LOG_DE_ACESSO:.spec.logging.access.destination.type'\n```\n\n- `<none>`: o roteador não registra acessos. **Sem detecção.**\n- `Container`: registra, mas apenas em um contêiner auxiliar dentro do cluster; só é útil se os logs do cluster forem coletados e enviados para fora.\n- `Syslog`: registra e envia para um destino externo."
  },
  {
   "id": "LS-OCP-004",
   "titulo": "Remover o usuário kubeadmin",
   "tecnologia": "openshift",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-004-remover-kubeadmin.md",
   "problema": "A instalação do OpenShift cria o usuário `kubeadmin`, com o papel `cluster-admin` e uma senha gerada uma única vez, gravada no diretório de instalação (`auth/kubeadmin-password`). É uma conta local e compartilhada: não passa pelo provedor de identidade, não tem segundo fator e não identifica a pessoa que a usou.",
   "beneficio": "A senha de instalação deixa de valer. Cópias antigas do arquivo `kubeadmin-password`, onde quer que estejam, passam a não servir para nada.",
   "avaliacao": "```bash\noc get secret kubeadmin -n kube-system --ignore-not-found -o name\noc get oauth cluster -o jsonpath='{range .spec.identityProviders[*]}{.name}{\"\\t\"}{.type}{\"\\n\"}{end}'\noc get clusterrolebindings -o json | jq -r '\n  .items[] | select(.roleRef.name == \"cluster-admin\") | .subjects[]? | \"\\(.kind)\\t\\(.name)\"' | sort -u\n```\n\n- O primeiro comando retorna `secret/kubeadmin`: o usuário de instalação ainda existe. **Exposto.**\n- O segundo não lista nenhum provedor de identidade: o `kubeadmin` é a única forma de entrar. Configure o provedor antes de qualquer outra coisa.\n- O terceiro precisa mostrar ao menos um usuário ou grupo nominal além de `system:masters`, `system:cluster-admins` e `system:admin`, que são vínculos padrão da plataforma.\n\nProcure também cópias do arquivo `auth/kubeadmin-password` no host de onde a instalação foi feita, em repositórios e em documentação interna."
  },
  {
   "id": "LS-OCP-005",
   "titulo": "Restringir o papel cluster-admin a poucas contas nominais",
   "tecnologia": "openshift",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-005-restringir-cluster-admin.md",
   "problema": "O papel `cluster-admin` permite qualquer ação em qualquer projeto: ler todos os Secrets, executar comandos em qualquer pod, criar workloads privilegiados nos nós e alterar a própria configuração de segurança do cluster. Com o tempo, ele se acumula: é concedido \"temporariamente\" a desenvolvedores, a contas de integração, a service accounts de ferramentas e a grupos inteiros do diretório.",
   "beneficio": "O número de credenciais capazes de entregar o cluster inteiro cai de dezenas para um punhado conhecido. A invasão de uma conta comum, de um pipeline ou de uma ferramenta passa a render apenas o que aquela conta precisa para trabalhar.",
   "avaliacao": "Liste todos os sujeitos vinculados ao papel `cluster-admin` em todo o cluster:\n\n```bash\noc get clusterrolebindings -o json | jq -r '\n  .items[] | select(.roleRef.name == \"cluster-admin\")\n  | .metadata.name as $vinculo\n  | .subjects[]? | \"\\($vinculo)\\t\\(.kind)\\t\\(.namespace // \"-\")\\t\\(.name)\"'\n```\n\nPara cada grupo listado, veja quem são os membros:\n\n```bash\noc get groups\n```\n\nComo interpretar:\n\n- `system:masters`, `system:cluster-admins` e `system:admin` são vínculos padrão da plataforma.\n- **Usuários** listados individualmente: confirme um a um se administram o cluster hoje.\n- **Grupos**: o risco é o tamanho do grupo. Um grupo amplo do diretório com `cluster-admin` equivale a dar o papel a todos os seus membros.\n- **Service accounts** fora dos namespaces `openshift-*` e `kube-*`: quase sempre são ferramentas (pipelines, GitOps, backup) que receberam mais do que precisam. O token de cada uma vale o cluster inteiro.\n- `kube:admin` ainda existente: veja [LS-OCP-004](catalogo/openshift/LS-OCP-004-remover-kubeadmin.md).\n\nUm vínculo local (`RoleBinding`) com o papel `cluster-admin` dá administração total apenas daquele namespace, e não do cluster. Ainda assim, vale revisar:\n\n```bash\noc get rolebindings -A -o json | jq -r '\n  .items[] | select(.roleRef.name == \"cluster-admin\")\n  | \"\\(.metadata.namespace)\\t\\(.metadata.name)\\t\\([.subjects[]?.name] | join(\",\"))\"'\n```"
  },
  {
   "id": "LS-OCP-006",
   "titulo": "Enviar o log de auditoria da API para fora do cluster",
   "tecnologia": "openshift",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.x com o operador Red Hat OpenShift Logging 5.x ou 6.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-006-auditoria-da-api-fora-do-cluster.md",
   "problema": "Tudo o que acontece no OpenShift passa pela API: quem leu um Secret, quem criou um vínculo de `cluster-admin`, quem abriu um terminal em um pod. O log de auditoria registra cada uma dessas requisições, mas por padrão ele fica apenas nos nós de control plane, em arquivos locais com rotação, e não é enviado a lugar nenhum.",
   "beneficio": "Cada requisição à API passa a ter uma cópia fora do cluster, em um destino que o invasor não controla. Depois de um incidente, é possível reconstruir o que uma conta ou um token comprometido fez: quais Secrets leu, o que criou, em quais pods entrou.",
   "avaliacao": "```bash\noc get apiserver cluster -o jsonpath='{.spec.audit.profile}{\"\\n\"}'\n\nfor api in observability.openshift.io logging.openshift.io; do\n  oc get \"clusterlogforwarders.$api\" -A -o json 2>/dev/null | jq -r '\n    .items[] | \"\\(.metadata.namespace)/\\(.metadata.name)\\t\"\n    + ([.spec.pipelines[]? | select((.inputRefs // []) | index(\"audit\")) | .outputRefs[]?] | join(\",\"))'\ndone\n```\n\n- Perfil `None`: a API não registra nada. **Sem auditoria.** Vazio ou `Default` é o padrão e registra os metadados de cada requisição.\n- Nenhum `ClusterLogForwarder` listado, ou segunda coluna vazia: o log de auditoria não sai dos nós de control plane. **Sem detecção.**\n- Saída listada: confira o tipo e o endereço (`oc get clusterlogforwarder <nome> -n <namespace> -o yaml`). Se o único destino for o armazenamento de logs do próprio cluster, o registro continua ao alcance de quem comprometer o cluster.\n\nO grupo de API do `ClusterLogForwarder` é `observability.openshift.io` no Logging 6.x e `logging.openshift.io` no Logging 5.x; o laço acima consulta os dois.\n\nPara confirmar que o log existe localmente, sem alterar nada:\n\n```bash\noc adm node-logs --role=master --path=kube-apiserver/\n```"
  },
  {
   "id": "LS-OCP-007",
   "titulo": "Alertar sobre mudanças em RBAC, SCC e Secrets",
   "tecnologia": "openshift",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-007-alertas-de-rbac-scc-e-secrets.md",
   "problema": "Dentro de um cluster, a movimentação lateral quase sempre passa por três tipos de objeto: o invasor lê **Secrets** para obter credenciais, altera **RBAC** para ampliar o próprio acesso ou criar persistência, e usa ou afrouxa uma **SCC** para sair do contêiner em direção ao nó.",
   "beneficio": "As poucas ações que mudam quem pode o quê no cluster deixam de passar despercebidas. Um novo vínculo com `cluster-admin`, uma SCC alterada ou uma listagem de Secrets por uma conta que nunca fez isso chegam à equipe em minutos, e não na investigação feita semanas depois.",
   "avaliacao": "Verifique primeiro se existem regras de alerta no destino central para os eventos da tabela da seção *Implementação*. Se o log de auditoria nem chega ao destino, o resultado é **sem detecção**.\n\nPara conhecer a linha de base antes de criar as regras, consulte o log local de um nó de control plane. O comando é somente leitura:\n\n```bash\noc adm node-logs <no-de-control-plane> --path=kube-apiserver/audit.log | jq -c '\n  select(.objectRef.apiGroup == \"rbac.authorization.k8s.io\"\n         and (.verb | IN(\"create\", \"update\", \"patch\", \"delete\")))\n  | [.requestReceivedTimestamp, .user.username, .verb,\n     .objectRef.resource, (.objectRef.namespace // \"-\"), .objectRef.name, .responseStatus.code]'\n```\n\nO resultado mostra quem altera RBAC hoje. Contas inesperadas na lista já são um achado. Repita trocando o filtro pelos demais eventos da tabela para medir o ruído de cada regra."
  },
  {
   "id": "LS-OCP-008",
   "titulo": "Reservar as SCCs privileged e anyuid a workloads justificados",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.11 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-008-scc-privilegiadas-so-com-justificativa.md",
   "problema": "As Security Context Constraints (SCCs) decidem o que um pod pode pedir ao nó. Por padrão, um workload comum é admitido pela `restricted-v2`: sem root, sem capacidades, sem acesso ao host. O problema começa quando uma aplicação não sobe e alguém resolve com `oc adm policy add-scc-to-user anyuid` ou, pior, `privileged`.",
   "beneficio": "A invasão de uma aplicação comum fica presa ao contêiner. Sem SCC privilegiada, o invasor não tem root, não monta diretórios do host e não enxerga os processos do nó: o caminho do pod para o nó deixa de existir para a grande maioria dos workloads.",
   "avaliacao": "**1. Quais pods de aplicação rodam fora da SCC restrita.** A anotação `openshift.io/scc` de cada pod informa a SCC que o admitiu:\n\n```bash\noc get pods -A -o json | jq -r '\n  .items[]\n  | select(.metadata.namespace | test(\"^(openshift.*|kube-.*|default)$\") | not)\n  | [.metadata.namespace, .metadata.name, .spec.serviceAccountName,\n     (.metadata.annotations[\"openshift.io/scc\"] // \"-\")] | @tsv' \\\n  | grep -Ev '[[:space:]]restricted(-v2)?$'\n```\n\n**2. Quem pode usar as SCCs privilegiadas.**\n\n```bash\noc adm policy who-can use scc privileged\noc adm policy who-can use scc anyuid\noc get scc privileged anyuid hostaccess hostnetwork hostmount-anyuid \\\n  -o custom-columns='SCC:.metadata.name,USUARIOS:.users,GRUPOS:.groups'\noc get rolebindings,clusterrolebindings -A -o wide | grep 'system:openshift:scc:'\n```\n\nComo interpretar:\n\n- Cada pod listado no passo 1 é uma exceção. Sem um motivo conhecido, é um achado.\n- Service accounts chamadas `default` com SCC privilegiada dão o privilégio a **todos** os pods do namespace que não declaram outra conta. Veja [LS-OCP-010](catalogo/openshift/LS-OCP-010-service-account-dedicada-por-workload.md).\n- Grupos amplos (`system:authenticated`, `system:serviceaccounts`) com `use` em `anyuid` ou `privileged` anulam a proteção para o cluster inteiro.\n- Confira a sintaxe de `who-can` com `oc adm policy who-can --help` na versão do cliente em uso."
  },
  {
   "id": "LS-OCP-009",
   "titulo": "Executar contêineres sem root e sem hostNetwork, hostPath e hostPorts",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.11 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-009-conteineres-sem-root-e-sem-acesso-ao-host.md",
   "problema": "O isolamento de um contêiner depende do que o pod pede ao nó. Quatro pedidos desfazem esse isolamento:",
   "beneficio": "O comprometimento de uma aplicação fica restrito ao contêiner e à rede de pods, onde os demais controles atuam. O invasor não tem root, não lê o sistema de arquivos do nó e não alcança serviços que escutam apenas na rede dos nós.",
   "avaliacao": "**1. Pods de aplicação que pedem acesso ao host ou root explícito:**\n\n```bash\noc get pods -A -o json | jq -r '\n  .items[]\n  | select(.metadata.namespace | test(\"^(openshift.*|kube-.*|default)$\") | not)\n  | . as $p\n  | [ (if .spec.hostNetwork then \"hostNetwork\" else empty end),\n      (if .spec.hostPID then \"hostPID\" else empty end),\n      (if .spec.hostIPC then \"hostIPC\" else empty end),\n      (if any(.spec.volumes[]?; .hostPath != null) then \"hostPath\" else empty end),\n      (if any(.spec.containers[].ports[]?; .hostPort != null) then \"hostPort\" else empty end),\n      (if any(.spec.containers[]; .securityContext.privileged == true) then \"privileged\" else empty end),\n      (if any(.spec.containers[];\n              (.securityContext.runAsUser // $p.spec.securityContext.runAsUser) == 0)\n       then \"runAsUser=0\" else empty end) ]\n  | select(length > 0)\n  | \"\\($p.metadata.namespace)/\\($p.metadata.name)\\t\\(join(\",\"))\"'\n```\n\n**2. Perfil de segurança de pods aplicado a cada namespace:**\n\n```bash\noc get namespaces -L pod-security.kubernetes.io/enforce \\\n  -L pod-security.kubernetes.io/audit -L pod-security.kubernetes.io/warn\n```\n\nComo interpretar:\n\n- Cada pod listado no passo 1 tem um caminho direto para o nó. Sem justificativa registrada, é um achado.\n- Um contêiner pode rodar como root **sem** declarar `runAsUser: 0`: basta ser admitido pela SCC `anyuid` e a imagem ter root como usuário padrão. Esses casos aparecem na avaliação de [LS-OCP-008](catalogo/openshift/LS-OCP-008-scc-privilegiadas-so-com-justificativa.md).\n- Namespace de aplicação com `enforce` em `privileged`, ou sem o rótulo: o cluster aceita ali qualquer pedido que as SCCs permitirem."
  },
  {
   "id": "LS-OCP-010",
   "titulo": "Usar uma service account dedicada por workload, com papéis mínimos",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-010-service-account-dedicada-por-workload.md",
   "problema": "Todo pod roda com uma service account, e o token dessa conta é montado dentro do contêiner por padrão. Quando o manifesto não declara nenhuma, o pod usa a conta `default` do namespace — a mesma para todos os workloads que também não declararam.",
   "beneficio": "O token obtido em um pod invadido passa a valer apenas o que aquele workload precisa — na maioria dos casos, nada, porque a maior parte das aplicações não fala com a API do cluster.",
   "avaliacao": "**1. Pods de aplicação usando a conta `default`:**\n\n```bash\noc get pods -A -o json | jq -r '\n  .items[]\n  | select(.metadata.namespace | test(\"^(openshift.*|kube-.*|default)$\") | not)\n  | select(.spec.serviceAccountName == \"default\")\n  | \"\\(.metadata.namespace)\\t\\(.metadata.name)\"'\n```\n\n**2. Papéis concedidos a contas `default` e a grupos de service accounts:**\n\n```bash\noc get rolebindings,clusterrolebindings -A -o json | jq -r '\n  .items[]\n  | select(any(.subjects[]?;\n        (.kind == \"ServiceAccount\" and .name == \"default\")\n        or (.kind == \"Group\" and (.name | startswith(\"system:serviceaccounts\")))))\n  | \"\\(.kind)\\t\\(.metadata.namespace // \"-\")\\t\\(.metadata.name)\\t\\(.roleRef.name)\"'\n```\n\n**3. O que uma conta específica consegue fazer:**\n\n```bash\noc auth can-i --list --as=system:serviceaccount:<namespace>:<conta> -n <namespace>\n```\n\nComo interpretar:\n\n- Pods com a conta `default` compartilham identidade. Isoladamente é uma fraqueza; somado a qualquer vínculo listado no passo 2, é **exposição**.\n- Vínculos para `default` com papéis como `edit`, `admin` ou `cluster-admin`, ou com SCCs (`system:openshift:scc:*`), valem para todos os pods do namespace.\n- Vínculos para os grupos `system:serviceaccounts` ou `system:serviceaccounts:<namespace>` valem para todas as contas, atuais e futuras. Os vínculos padrão `system:image-pullers`, `system:image-builders` e `system:deployers` de cada projeto são da plataforma.\n- No passo 3, uma aplicação que não usa a API deveria listar apenas as permissões básicas de descoberta."
  },
  {
   "id": "LS-OCP-011",
   "titulo": "Restringir o acesso a Secrets com RBAC",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-011-acesso-a-secrets-restrito-por-rbac.md",
   "problema": "Os Secrets de um namespace guardam o que o invasor procura para dar o próximo passo: senhas de banco de dados, chaves de API, certificados, credenciais de registries e tokens de outras contas. O conteúdo é apenas codificado em base64; quem tem permissão de leitura na API tem a credencial.",
   "beneficio": "A invasão de uma aplicação ou de uma conta comum deixa de render as credenciais das demais. Cada workload alcança apenas os Secrets de que precisa, e a maior parte das pessoas trabalha sem ler nenhum.",
   "avaliacao": "**1. Quem lê Secrets em um namespace, e em todos:**\n\n```bash\noc adm policy who-can get secrets -n <namespace>\noc adm policy who-can list secrets -n <namespace>\noc adm policy who-can list secrets --all-namespaces\n```\n\n**2. Papéis de cluster que dão leitura de Secrets:**\n\n```bash\noc get clusterroles -o json | jq -r '\n  .items[]\n  | select(any(.rules[]?;\n        ((.apiGroups // []) | (index(\"\") != null or index(\"*\") != null))\n        and ((.resources // []) | (index(\"secrets\") != null or index(\"*\") != null))\n        and ((.verbs // []) | (index(\"get\") != null or index(\"list\") != null\n                               or index(\"watch\") != null or index(\"*\") != null))))\n  | .metadata.name'\n```\n\n**3. Service accounts de aplicação com leitura de Secrets:**\n\n```bash\noc auth can-i list secrets --as=system:serviceaccount:<namespace>:<conta> -n <namespace>\n```\n\nComo interpretar:\n\n- No passo 1, grupos amplos (todos os desenvolvedores, `system:authenticated`, `system:serviceaccounts`) com leitura de Secrets são **exposição**. A consulta com `--all-namespaces` deveria listar apenas administradores do cluster e contas da plataforma. Confira as opções de `who-can` com `oc adm policy who-can --help` na versão do cliente em uso.\n- No passo 2, a lista inclui papéis da plataforma. O que importa é cruzá-la com os vínculos: quais desses papéis estão ligados a pessoas, grupos e contas de aplicação.\n- No passo 3, a resposta esperada para uma aplicação comum é `no`. Um pod não precisa de permissão na API para usar um Secret montado como volume ou injetado como variável."
  },
  {
   "id": "LS-OCP-012",
   "titulo": "Aplicar AdminNetworkPolicy para regras que o tenant não sobrescreve",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.16 ou superior com OVN-Kubernetes",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-012-adminnetworkpolicy.md",
   "problema": "A NetworkPolicy ([LS-OCP-002](catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md)) pertence ao namespace. Quem administra o namespace pode criar uma política que libera tudo, ou apagar a de negação padrão — e um invasor com o token de uma conta com papel `admin` ou `edit` no namespace pode fazer o mesmo. A segmentação do cluster fica dependendo de cada time manter as próprias regras.",
   "beneficio": "As regras que protegem a infraestrutura passam a ser do cluster, e não do tenant. Um pod de aplicação invadido deixa de alcançar a rede dos nós e os metadados de nuvem, e nenhuma NetworkPolicy criada no namespace — por engano ou por um invasor — consegue reabrir esse caminho.",
   "avaliacao": "```bash\noc get network.config cluster -o jsonpath='{.status.networkType}{\"\\n\"}'\noc get adminnetworkpolicy\noc get baselineadminnetworkpolicy\n```\n\n- Tipo de rede diferente de `OVNKubernetes`: o recurso não está disponível.\n- Nenhuma AdminNetworkPolicy: toda a segmentação do cluster pode ser desfeita por quem administra um namespace, e a saída dos pods para a rede dos nós não tem restrição de cluster. **Exposto.**\n\nPara confirmar a exposição a partir de um pod de aplicação já existente, sem alterar nada, teste a porta do kubelet em um nó:\n\n```bash\noc exec -n <namespace> <pod> -- curl -sk -o /dev/null -w '%{http_code}\\n' --max-time 5 \\\n  https://<ip-de-um-no>:10250/healthz\n```\n\nQualquer código HTTP (o esperado é `401`, porque o kubelet exige autenticação), em vez de `000` por tempo esgotado, mostra que o pod alcança a rede dos nós."
  },
  {
   "id": "LS-OCP-013",
   "titulo": "Eliminar credenciais embutidas em manifestos, imagens e variáveis",
   "tecnologia": "openshift",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "OpenShift 4.x",
   "status": "rascunho",
   "arquivo": "catalogo/openshift/LS-OCP-013-sem-credenciais-embutidas.md",
   "problema": "Senhas, tokens e chaves acabam em lugares que não foram feitos para guardá-los: no campo `value` de uma variável de ambiente do Deployment, em um ConfigMap, em uma camada da imagem, no repositório Git que guarda os manifestos.",
   "beneficio": "O acesso de leitura a um namespace, a um registry ou a um repositório deixa de entregar credenciais. Para obter a senha do banco de dados, o invasor passa a precisar de permissão explícita sobre o Secret — um conjunto pequeno de identidades, controlado e auditado.",
   "avaliacao": "Os comandos mostram apenas **onde** há suspeita, sem exibir os valores.\n\n**1. Variáveis de ambiente com valor literal e nome de credencial:**\n\n```bash\noc get deployments,statefulsets,daemonsets,cronjobs -A -o json | jq -r '\n  .items[]\n  | select(.metadata.namespace | test(\"^(openshift.*|kube-.*|default)$\") | not)\n  | . as $w\n  | [.. | objects | select(has(\"containers\")) | .containers[], (.initContainers // [])[]]\n  | .[] | .name as $c | .env[]?\n  | select(.value != null and .value != \"\"\n           and (.name | test(\"PASS|PWD|SECRET|TOKEN|CREDENTIAL|API_?KEY|PRIVATE\"; \"i\")))\n  | \"\\($w.kind)\\t\\($w.metadata.namespace)/\\($w.metadata.name)\\t\\($c)\\t\\(.name)\"' | sort -u\n```\n\n**2. ConfigMaps com chaves ou conteúdo que parecem credenciais:**\n\n```bash\noc get configmaps -A -o json | jq -r '\n  .items[]\n  | select(.metadata.namespace | test(\"^(openshift.*|kube-.*|default)$\") | not)\n  | . as $cm | (.data // {}) | to_entries[]\n  | select((.key + \"\\n\" + .value)\n           | test(\"passw(or)?d\\\\s*[=:]|secret\\\\s*[=:]|token\\\\s*[=:]|BEGIN [A-Z ]*PRIVATE KEY\"; \"i\"))\n  | \"\\($cm.metadata.namespace)/\\($cm.metadata.name)\\t\\(.key)\"' | sort -u\n```\n\n**3. Imagens.** Para as imagens construídas internamente, liste os nomes das variáveis definidas e os comandos de construção:\n\n```bash\npodman image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' <imagem> | cut -d= -f1\npodman history --no-trunc --format '{{.CreatedBy}}' <imagem> | grep -iE 'pass|secret|token|key' | cut -c1-120\n```\n\n**4. Repositórios.** Procure nos manifestos versionados, inclusive no histórico, objetos `kind: Secret` com dados e os mesmos padrões de nome dos passos 1 e 2.\n\nComo interpretar: cada linha é um candidato, e não uma confirmação — há falsos positivos (por exemplo, uma variável que guarda o caminho de um arquivo de senha). Toda credencial confirmada em claro deve ser considerada **exposta**: não há como saber quem já a leu."
  },
  {
   "id": "LS-RHEL-001",
   "titulo": "Aceitar SSH somente de origens administrativas",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md",
   "problema": "Em muitas redes, todo servidor aceita SSH de todo outro servidor. Somado a chaves privadas esquecidas, encaminhamento de agente e senhas reutilizadas, isso torna o SSH o principal meio de movimentação lateral em ambientes Linux: quem invade um servidor salta para os demais com as credenciais que encontrar.",
   "beneficio": "Um servidor invadido deixa de conseguir abrir SSH para os demais. Chaves privadas esquecidas, senhas reutilizadas e agentes encaminhados perdem o valor para o invasor, porque a porta simplesmente não responde a partir de outro servidor. O principal meio de movimentação lateral em ambientes Linux é fechado com uma regra de firewall por host.",
   "avaliacao": "```bash\nfirewall-cmd --list-all-zones | grep -B8 -E 'services:.*\\bssh\\b' | grep -E '^\\S|sources:|services:'\nsshd -T | grep -E '^(passwordauthentication|permitrootlogin|allowagentforwarding|allowtcpforwarding) '\nfind /root /home -maxdepth 3 -path '*/.ssh/*' -type f ! -name '*.pub' ! -name 'authorized_keys' ! -name 'known_hosts*' ! -name 'config' 2>/dev/null\n```\n\nIndicadores de exposição:\n\n- `ssh` liberado em uma zona sem `sources` definidos (aceita de qualquer origem).\n- `passwordauthentication yes`, `permitrootlogin yes`, `allowagentforwarding yes`.\n- Chaves privadas no servidor (terceiro comando): cada uma é uma credencial para outro sistema."
  },
  {
   "id": "LS-RHEL-002",
   "titulo": "Encaminhar os logs do sistema para um syslog central",
   "tecnologia": "rhel",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-002-syslog-central.md",
   "problema": "Log que fica apenas no servidor só serve enquanto o servidor é confiável. Quem invade um host e obtém privilégio apaga ou altera os registros locais, e a equipe fica sem saber por onde o invasor entrou, o que executou e para onde foi.",
   "beneficio": "Os registros passam a existir fora do alcance do invasor: mesmo que ele limpe o servidor, a cópia central permanece. A investigação de um incidente deixa de depender do host comprometido, e é possível reconstruir o caminho percorrido entre servidores a partir de um único lugar.",
   "avaliacao": "```bash\nsystemctl is-active rsyslog\ngrep -rEsh '^[^#]*(@@?[A-Za-z0-9\\[(]|omfwd)' /etc/rsyslog.conf /etc/rsyslog.d/ || echo \"sem encaminhamento configurado\"\n```\n\n- Nenhuma linha de encaminhamento: os logs existem apenas no servidor. **Sem detecção central.**\n- Havendo encaminhamento, confirme que ele funciona de fato: gere uma mensagem (`logger -t lateralshield teste`) e procure-a no destino. Configuração apontando para um servidor desativado é um achado comum."
  },
  {
   "id": "LS-RHEL-003",
   "titulo": "Auditar identidade, sudo e módulos de kernel com o auditd",
   "tecnologia": "rhel",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-003-auditd-identidade-sudo-e-modulos.md",
   "problema": "O `auditd` vem ativo no RHEL, mas quase sem regras. Sem regras, três ações típicas de quem já obteve privilégio em um servidor não deixam registro confiável:",
   "beneficio": "Cada mudança em contas, grupos, regras de `sudo` e módulos de kernel passa a gerar um evento com horário, usuário de origem da sessão e comando. Ações que quase nunca acontecem fora de uma janela de mudança viram alertas de alta precisão.",
   "avaliacao": "```bash\nsystemctl is-active auditd\nauditctl -s | grep -E '^(enabled|failure|lost|backlog)'\nauditctl -l\nauditctl -l | grep -cE '/etc/(passwd|shadow|group|sudoers)|init_module'\n```\n\n- `auditctl -l` retorna `No rules`: o audit está ligado, mas não registra nada do que interessa. **Sem detecção.**\n- O último comando conta as regras que cobrem identidade, `sudo` e módulos. Zero significa que esses eventos não são auditados.\n- `enabled 2` indica regras imutáveis: qualquer alteração só vale depois de reiniciar o host.\n- `lost` diferente de zero indica eventos descartados; revise `backlog_limit` antes de acrescentar regras."
  },
  {
   "id": "LS-RHEL-004",
   "titulo": "Bloquear o login de root e usar contas nominais com sudo",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-004-sem-login-de-root.md",
   "problema": "Quando a equipe administra os servidores entrando diretamente como `root`, a mesma credencial vale para várias pessoas e, quase sempre, para vários servidores. Quem obtém essa senha ou essa chave em um host — em um script, em um histórico de shell, em um backup — entra nos demais com privilégio total.",
   "beneficio": "A senha de `root` deixa de ser uma credencial que abre vários servidores. Para chegar a privilégio total, o invasor precisa comprometer a conta de uma pessoa específica, que tem autenticação própria e pode ser bloqueada sozinha, sem trocar senha em todo o ambiente.",
   "avaliacao": "```bash\npasswd -S root\nsshd -T | grep -E '^permitrootlogin '\nawk -F: '$3 == 0 {print $1}' /etc/passwd\ngrep -cvE '^\\s*(#|$)' /root/.ssh/authorized_keys 2>/dev/null\nlast -n 10 root\ngetent group wheel\ngrep -E '^\\s*auth\\s+required\\s+pam_wheel' /etc/pam.d/su || echo \"su liberado para qualquer usuário\"\n```\n\nIndicadores de exposição:\n\n- `passwd -S root` mostra senha utilizável (`PS`) e ninguém sabe dizer se ela é única deste servidor.\n- `permitrootlogin` diferente de `no`.\n- Mais de uma conta com UID 0.\n- Chaves em `/root/.ssh/authorized_keys`: cada uma é um login direto como `root`.\n- `last` mostra logins recentes de `root` vindos da rede.\n- Grupo `wheel` vazio, ou com contas genéricas e de serviço."
  },
  {
   "id": "LS-RHEL-005",
   "titulo": "Aplicar sudo de menor privilégio",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-005-sudo-de-menor-privilegio.md",
   "problema": "Regras de `sudo` crescem por conveniência. A conta do servidor de aplicação ganha `ALL` para que um script de deploy funcione; o time de suporte ganha `NOPASSWD: ALL` para não digitar senha; ninguém revisa depois.",
   "beneficio": "A invasão de uma conta de serviço fica restrita ao que essa conta faz. O invasor não vira `root` pelo `sudo`, não lê as credenciais das demais aplicações do servidor e precisa de outra falha para subir de privilégio — o que dá tempo à detecção.",
   "avaliacao": "```bash\nvisudo -c\ngrep -rEn '^[^#]*NOPASSWD' /etc/sudoers /etc/sudoers.d/\ngrep -rEn '^[^#]*=\\s*(\\([^)]*\\))?\\s*(NOPASSWD:\\s*)?ALL\\s*$' /etc/sudoers /etc/sudoers.d/\nsudo -l -U <conta>\n```\n\nIndicadores de exposição:\n\n- Conta de serviço (aplicação, banco de dados, monitoramento) com `ALL`, com ou sem senha.\n- `NOPASSWD` para contas usadas por pessoas.\n- Regras com curingas nos argumentos (`*`) ou com caminho relativo.\n- Comandos que permitem executar outros programas ou editar arquivos arbitrários: shells, interpretadores, editores, paginadores e gerenciadores de pacotes.\n- Scripts permitidos no `sudo` que a própria conta pode alterar. Confira o dono e as permissões do arquivo e dos diretórios acima dele."
  },
  {
   "id": "LS-RHEL-006",
   "titulo": "Manter o SELinux em modo enforcing",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-006-selinux-em-enforcing.md",
   "problema": "O SELinux vem em modo `enforcing` no RHEL, e em muitos ambientes foi colocado em `permissive` ou desativado no dia em que uma aplicação não funcionou — e nunca mais voltou.",
   "beneficio": "A invasão de um serviço deixa de dar ao invasor o alcance completo do usuário daquele serviço. Ler credenciais de outras aplicações, usar o servidor como ponto de partida para varreduras e instalar persistência ficam mais difíceis, e exigem uma segunda falha.",
   "avaliacao": "```bash\ngetenforce\ngrep -E '^SELINUX=' /etc/selinux/config\ngrep -oE '(selinux|enforcing)=[01]' /proc/cmdline\nsemanage permissive -l\nps -eZ | grep -E 'unconfined_service_t|initrc_t'\nausearch -m AVC,USER_AVC,SELINUX_ERR,USER_SELINUX_ERR -ts today | grep -c denied\n```\n\n- `Permissive` ou `Disabled`: **sem contenção**.\n- `Enforcing` agora, mas `SELINUX=permissive` no arquivo ou `enforcing=0` na linha de comando do kernel: volta a ficar exposto na próxima reinicialização.\n- Domínios listados por `semanage permissive -l`: serviços que escapam da política, um a um. Cada um precisa de dono e de justificativa.\n- Processos em `unconfined_service_t` ou `initrc_t`: serviços sem confinamento. Se algum deles escuta na rede, é o primeiro a tratar."
  },
  {
   "id": "LS-RHEL-007",
   "titulo": "Exigir chave ou MFA no SSH e restringir o acesso com AllowGroups",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-007-ssh-por-chave-ou-mfa-e-allowgroups.md",
   "problema": "Por padrão, toda conta com shell válido e senha pode entrar por SSH. Isso inclui contas de serviço, contas de aplicação, contas de teste esquecidas e qualquer usuário do diretório central que resolva no servidor.",
   "beneficio": "Uma senha roubada deixa de ser suficiente para abrir sessão: o servidor exige uma chave ou um segundo fator. E mesmo com a credencial certa, só entra quem pertence ao grupo de acesso; contas de serviço e contas esquecidas ficam de fora por construção.",
   "avaliacao": "```bash\nsshd -T | grep -E '^(passwordauthentication|kbdinteractiveauthentication|challengeresponseauthentication|pubkeyauthentication|authenticationmethods|permitemptypasswords|allowgroups|allowusers|denygroups|denyusers) '\nawk -F: '$7 !~ /(nologin|false)$/ {print $1}' /etc/passwd\njournalctl -u sshd --since \"30 days ago\" | grep -oE 'Accepted \\S+ for \\S+' | sort | uniq -c\n```\n\nIndicadores de exposição:\n\n- Nenhuma linha `allowgroups` ou `allowusers`: qualquer conta com shell entra.\n- `passwordauthentication yes` com `authenticationmethods any`: uma senha sozinha basta.\n- Contas de serviço com shell válido na saída do segundo comando.\n- O terceiro comando mostra quem entra de fato e por qual método. Contas que aparecem ali e não deveriam são achado; as demais formam a lista inicial do grupo.\n\nQuando há blocos `Match`, confira o resultado para um usuário específico com `sshd -T -C user=<usuario>,host=<nome>,addr=<ip-de-origem>`."
  },
  {
   "id": "LS-RHEL-008",
   "titulo": "Liberar no firewalld somente os serviços e portas necessários",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-008-firewalld-somente-o-necessario.md",
   "problema": "Em redes internas, o firewall do host costuma estar desligado ou aberto demais: \"já existe firewall no perímetro\". O resultado é que todo serviço que escuta em um servidor — banco de dados, console de administração, agente de monitoramento, porta de depuração esquecida — fica acessível a qualquer outro servidor do mesmo segmento.",
   "beneficio": "Um servidor invadido passa a enxergar, em cada vizinho, apenas as portas que aquele vizinho realmente oferece a ele. Serviços internos, como banco de dados e consoles, deixam de responder a quem não é cliente legítimo, mesmo estando no mesmo segmento de rede.",
   "avaliacao": "```bash\nsystemctl is-active firewalld\nfirewall-cmd --get-default-zone\nfirewall-cmd --get-active-zones\nfirewall-cmd --list-all-zones | grep -A14 '(active)'\nss -tulnp\n```\n\nIndicadores de exposição:\n\n- firewalld inativo, sem outro filtro no host: **sem contenção**.\n- Interface na zona `trusted`, ou zona com `target: ACCEPT`: tudo é aceito.\n- Serviços ou portas liberados sem `sources`, para algo que só alguns clientes usam.\n- Porta liberada no firewall sem nenhum processo escutando nela (compare com `ss`): regra obsoleta.\n- Serviços padrão que ninguém usa, como `cockpit` e `dhcpv6-client` na zona `public`.\n- Processo escutando em todas as interfaces (`0.0.0.0` ou `[::]`) quando só atende conexões locais."
  },
  {
   "id": "LS-RHEL-009",
   "titulo": "Registrar e revisar o uso de sudo",
   "tecnologia": "rhel",
   "pilar": "detectar",
   "impacto": "medio",
   "esforco": "baixo",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-009-uso-de-sudo-registrado-e-revisado.md",
   "problema": "O `sudo` já registra cada comando por padrão, mas esse registro costuma ter dois defeitos: fica só no servidor, onde quem virou `root` pode apagá-lo, e ninguém o lê.",
   "beneficio": "O uso de privilégio passa a ter um registro fora do alcance de quem o exerceu, e alguém olhando para ele em intervalo definido. Uma conta de serviço que usa `sudo` pela primeira vez, um administrador ativo de madrugada em servidores que não são seus, uma sequência de tentativas recusadas: tudo isso passa a ser visto em dias, e não descoberto na investigação de um incidente maior.",
   "avaliacao": "```bash\ngrep -rEn '^\\s*Defaults.*(syslog|logfile|log_input|log_output|iolog)' /etc/sudoers /etc/sudoers.d/\njournalctl -t sudo --since \"7 days ago\" | grep -c 'COMMAND='\njournalctl -t sudo --since \"7 days ago\" | grep -cE 'COMMAND=.*(/bin/(ba)?sh|/bin/su)\\b'\n```\n\n- `Defaults !syslog` ou equivalente: o registro foi desligado. **Sem detecção.**\n- Há comandos registrados localmente (segundo comando), mas eles não aparecem no destino central: o registro existe e pode ser apagado.\n- O terceiro comando conta as aberturas de shell de `root`. Se o número é alto e não há gravação de sessão (`log_output`), a maior parte da atividade privilegiada não está registrada.\n- Pergunte quem leu esses registros no último mês. \"Ninguém\" é o achado mais comum."
  },
  {
   "id": "LS-RHEL-010",
   "titulo": "Desabilitar core dumps e restringir o ptrace",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "medio",
   "esforco": "baixo",
   "prioridade": 2,
   "versoes": "RHEL 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-010-core-dumps-e-ptrace.md",
   "problema": "Credenciais não ficam só em arquivos. Elas estão na memória dos processos: a senha do banco de dados dentro do servidor de aplicação, chaves carregadas em um agente SSH, tokens de sessão, segredos lidos de um cofre na partida.",
   "beneficio": "Uma conta de serviço invadida deixa de conseguir ler a memória dos processos vizinhos, e o servidor deixa de acumular cópias de memória em disco. As credenciais que só existem em memória ficam fora do alcance de quem não é `root`.",
   "avaliacao": "```bash\nsysctl kernel.yama.ptrace_scope fs.suid_dumpable kernel.core_pattern\ngrep -Ehv '^\\s*(#|$)' /etc/systemd/coredump.conf /etc/systemd/coredump.conf.d/*.conf 2>/dev/null\ngrep -rEhs '^[^#]*\\bcore\\b' /etc/security/limits.conf /etc/security/limits.d/\nsystemctl show --property=DefaultLimitCORE\ngrep -i 'core file' /proc/<pid-do-servico>/limits\ncoredumpctl list --no-pager 2>/dev/null | tail -n 5\nls -la /var/lib/systemd/coredump/ 2>/dev/null\n```\n\nIndicadores de exposição:\n\n- `kernel.yama.ptrace_scope = 0`: qualquer processo se anexa a outro do mesmo usuário.\n- `fs.suid_dumpable` diferente de `0`: programas com privilégio elevado também geram core dump.\n- `kernel.core_pattern` apontando para o `systemd-coredump` sem `Storage=none` em `coredump.conf`: as cópias de memória são guardadas em `/var/lib/systemd/coredump/`.\n- Limite de core diferente de `0` para o processo de um serviço exposto (quinto comando), em geral por um `LimitCORE=` na unidade do serviço ou por um ajuste feito em uma depuração antiga.\n- Arquivos já existentes nesse diretório: verifique de quais processos são e remova-os depois de avaliar."
  },
  {
   "id": "LS-RHEL-011",
   "titulo": "Endurecer os parâmetros de rede do kernel",
   "tecnologia": "rhel",
   "pilar": "conter",
   "impacto": "medio",
   "esforco": "baixo",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-011-parametros-de-rede-do-kernel.md",
   "problema": "Alguns parâmetros de rede do kernel existem para roteadores e ficam ativos, ou acabam ativados, em servidores comuns. Em uma rede onde um vizinho já foi invadido, eles ajudam o invasor de duas formas:",
   "beneficio": "Um servidor comum deixa de servir de ponte entre redes e deixa de aceitar que um vizinho invadido redirecione seu tráfego. A segmentação definida nos firewalls de rede passa a valer também para os hosts com mais de uma interface.",
   "avaliacao": "```bash\nsysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding\nsysctl net.ipv4.conf.all.accept_redirects net.ipv4.conf.default.accept_redirects \\\n       net.ipv4.conf.all.secure_redirects net.ipv4.conf.all.send_redirects \\\n       net.ipv4.conf.all.accept_source_route net.ipv4.conf.all.rp_filter \\\n       net.ipv4.conf.all.log_martians \\\n       net.ipv6.conf.all.accept_redirects net.ipv6.conf.all.accept_source_route\nip -br addr\ngrep -rEs '^\\s*net\\.' /etc/sysctl.conf /etc/sysctl.d/ /usr/lib/sysctl.d/ /run/sysctl.d/\n```\n\nIndicadores de exposição:\n\n- `ip_forward = 1` (ou `forwarding = 1` no IPv6) em servidor que não é roteador nem executa contêineres ou máquinas virtuais. Com mais de uma interface (`ip -br addr`), é uma ponte entre redes.\n- `accept_redirects = 1`, `send_redirects = 1` ou `accept_source_route = 1`.\n- `rp_filter = 0`.\n- `log_martians = 0`: pacotes com origem impossível são descartados sem registro.\n\nO último comando mostra de onde vêm os valores atuais. Um valor diferente do que está nos arquivos indica mudança feita em tempo de execução por alguém ou por algum software."
  },
  {
   "id": "LS-RHEL-012",
   "titulo": "Verificar a integridade de arquivos com o AIDE",
   "tecnologia": "rhel",
   "pilar": "detectar",
   "impacto": "medio",
   "esforco": "baixo",
   "prioridade": 2,
   "versoes": "RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/rhel/LS-RHEL-012-integridade-de-arquivos-com-aide.md",
   "problema": "Quem obtém privilégio em um servidor raramente se contenta com o acesso do momento. Para voltar depois e para capturar as credenciais de quem administra a máquina, o invasor altera o próprio sistema: troca um binário por uma versão modificada, acrescenta um módulo de autenticação, uma unidade do systemd, uma tarefa agendada, uma chave em `authorized_keys`.",
   "beneficio": "Alterações em binários, bibliotecas e arquivos de configuração do sistema passam a ser percebidas em até um dia, em vez de permanecerem por meses. A persistência do invasor, que depende de não ser notada, perde essa garantia.",
   "avaliacao": "```bash\nrpm -q aide\nls -l /var/lib/aide/\ngrep -rs 'aide' /etc/crontab /etc/cron.d/ /etc/cron.daily/ /etc/cron.weekly/ /var/spool/cron/ 2>/dev/null\nsystemctl list-timers --all 2>/dev/null | grep -i aide\n```\n\n- Pacote ausente, ou instalado sem `/var/lib/aide/aide.db.gz`: **sem detecção** de adulteração.\n- Base existente, mas sem agendamento: a verificação nunca roda.\n- Base com data muito antiga em servidor que recebe atualizações: toda verificação acusa centenas de diferenças, e ninguém mais lê o resultado."
  },
  {
   "id": "LS-JBOSS-001",
   "titulo": "Fechar as interfaces de gerenciamento do JBoss EAP para a rede",
   "tecnologia": "jboss-eap",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "JBoss EAP 5.x, 6.x, 7.x",
   "status": "rascunho",
   "arquivo": "catalogo/jboss-eap/LS-JBOSS-001-interfaces-de-gerenciamento.md",
   "problema": "As interfaces de gerenciamento do JBoss EAP permitem implantar aplicações e alterar a configuração do servidor, o que equivale a executar código no host. Em versões legadas, é comum estarem expostas para toda a rede interna, com credenciais fracas ou, no EAP 5, sem autenticação.",
   "beneficio": "O caminho mais simples para tomar um JBoss — implantar uma aplicação pelo console — deixa de existir para quem está na rede. Um servidor invadido não consegue mais usar o gerenciamento dos vizinhos para se espalhar, e ataques conhecidos contra consoles de versões legadas perdem o alvo, mesmo sem atualizar o produto.",
   "avaliacao": "No servidor:\n\n```bash\nss -tlnp | grep -E ':(9990|9993|9999|1098|1099|4444|4445|4446)\\s'\n```\n\nQualquer linha escutando em `0.0.0.0`, `*`, `[::]` ou em um IP de rede (diferente de `127.0.0.1`) indica interface exposta.\n\nNo EAP 5, verifique também os consoles implantados:\n\n```bash\nls $JBOSS_HOME/server/*/deploy | grep -E 'jmx-console|web-console|admin-console|management|http-invoker'\n```\n\nA partir de outro servidor da rede, confirme o que é alcançável:\n\n```bash\ncurl -s -o /dev/null -w '%{http_code}\\n' --max-time 5 http://<servidor>:9990/management\ncurl -s -o /dev/null -w '%{http_code}\\n' --max-time 5 http://<servidor>:8080/jmx-console/\n```"
  },
  {
   "id": "LS-JBOSS-002",
   "titulo": "Limitar as conexões de saída do processo JBoss ao estritamente necessário",
   "tecnologia": "jboss-eap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md",
   "problema": "Um JBoss EAP legado que não pode ser atualizado precisa ser tratado como um servidor que **será** invadido. Quando isso acontece, o invasor herda tudo o que o processo Java pode fazer — e, por padrão, ele pode abrir conexões para qualquer endereço e porta da rede interna: SSH dos vizinhos, outros bancos de dados, consoles de gerenciamento, a API do OpenShift.",
   "beneficio": "Um JBoss invadido passa a alcançar apenas o que já alcançava legitimamente: o seu banco de dados e as suas integrações. Varredura da rede interna, SSH para servidores vizinhos, acesso a outros bancos e download de ferramentas a partir da internet deixam de funcionar para o invasor.",
   "avaliacao": "Confirme o usuário do processo e veja para onde ele se conecta hoje:\n\n```bash\nps -o user=,pid=,cmd= -C java | grep -i jboss\nss -tnp | grep java\n```\n\nSe não existe nenhuma regra de saída para esse usuário (`nft list ruleset | grep skuid` vazio), o processo pode alcançar toda a rede: **exposto**."
  },
  {
   "id": "LS-JBOSS-003",
   "titulo": "Auditar a execução de processos pelo usuário do JBoss",
   "tecnologia": "jboss-eap",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/jboss-eap/LS-JBOSS-003-auditoria-de-processos.md",
   "problema": "Depois de explorar um JBoss, o invasor quase sempre executa comandos do sistema: um shell, `id`, `whoami`, `curl`, `wget`, `ssh`. Um servidor de aplicação saudável raramente faz isso depois de iniciado. Essa diferença é um sinal de detecção barato e de alta precisão, e na maioria dos ambientes ninguém o está coletando.",
   "beneficio": "A invasão de um JBoss passa a ser percebida no primeiro comando que o invasor executa, e não semanas depois, pelo dano causado. O alerta tem pouquíssimos falsos positivos, porque um servidor de aplicação em operação normal quase não executa programas.",
   "avaliacao": "```bash\nsystemctl is-active auditd\nauditctl -l | grep -E 'ls_jboss_exec' || echo \"sem regra de auditoria para o JBoss\"\n```\n\nSem regra, a execução de comandos pelo JBoss não deixa rastro: **sem detecção**."
  },
  {
   "id": "LS-JBOSS-004",
   "titulo": "Enviar os logs do JBoss EAP para um syslog central",
   "tecnologia": "jboss-eap",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "JBoss EAP 5.x, 6.x, 7.x sobre RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md",
   "problema": "O `server.log` de um JBoss registra erros de desserialização, implantações inesperadas, falhas de autenticação e exceções que costumam acompanhar uma tentativa de exploração. Esse arquivo fica no diretório do próprio servidor, pertence ao usuário do JBoss e pode ser apagado ou alterado por quem invadir o processo.",
   "beneficio": "O que o JBoss registra passa a ter uma cópia fora do servidor, que o invasor não alcança. A equipe consegue ver a tentativa de exploração enquanto ela acontece e, depois, reconstruir o incidente sem depender do host comprometido.",
   "avaliacao": "```bash\ngrep -rEsh 'imfile|server\\.log' /etc/rsyslog.conf /etc/rsyslog.d/ || echo \"rsyslog não lê o log do JBoss\"\n```\n\nNo EAP 6 e 7, verifique também se há um handler de syslog configurado:\n\n```bash\n$JBOSS_HOME/bin/jboss-cli.sh --connect --command='/subsystem=logging:read-children-names(child-type=syslog-handler)'\n```\n\nSem leitura pelo rsyslog e sem handler de syslog, o log do JBoss existe apenas no servidor: **sem detecção central**."
  },
  {
   "id": "LS-AAP-001",
   "titulo": "Restringir a chave de automação aos nós de execução do AAP",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.x; hosts gerenciados RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-001-chave-de-automacao-restrita.md",
   "problema": "O Ansible Automation Platform acessa os servidores gerenciados com uma credencial de máquina, em geral uma chave SSH de uma conta de serviço com `sudo`. A chave pública correspondente está em **todos** os servidores, quase sempre sem restrição.",
   "beneficio": "A credencial mais poderosa do ambiente deixa de funcionar fora do lugar onde deveria estar. Uma cópia da chave privada obtida em um backup, repositório ou estação passa a não servir para nada, porque os servidores só a aceitam a partir dos nós de execução do AAP.",
   "avaliacao": "Em um host gerenciado:\n\n```bash\ngrep -vE '^\\s*(#|$)' ~<conta-de-automacao>/.ssh/authorized_keys | grep -v 'from='\n```\n\nCada linha retornada é uma chave aceita de qualquer origem: **exposta**.\n\nNo AAP, verifique quantos inventários e ambientes usam a mesma credencial de máquina. Uma única credencial para produção e não produção amplia o alcance de qualquer vazamento."
  },
  {
   "id": "LS-AAP-002",
   "titulo": "Exigir MFA no provedor de identidade usado pelo AAP",
   "tecnologia": "aap",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior, com autenticação externa",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-002-mfa-no-provedor-de-identidade.md",
   "problema": "O Ansible Automation Platform dispara jobs com credenciais que alcançam quase todos os servidores do ambiente. Quando o login na plataforma depende apenas de usuário e senha, uma senha obtida por phishing, reutilizada de outro serviço ou lida em uma estação comprometida basta para que o invasor execute automação privilegiada em nome de um operador.",
   "beneficio": "Uma senha vazada, sozinha, deixa de abrir o AAP. Para chegar à automação o invasor passa a precisar também do segundo fator do usuário. Phishing simples de senha e reutilização de senha de outro serviço deixam de ser suficientes.",
   "avaliacao": "1. Liste os métodos de autenticação ativos. No AAP 2.5 ou superior: **Access Management > Authentication Methods**. No AAP 2.4: **Settings > Authentication** do automation controller.\n2. Para cada método externo, verifique no provedor de identidade se a política aplicada à aplicação do AAP exige segundo fator.\n3. Faça o teste direto: entre com um usuário de teste que não tenha segundo fator cadastrado.\n\nInterpretação:\n\n- Só existe o método local, ou o login externo conclui sem pedir segundo fator: **exposto**.\n- O método externo é do tipo em que a senha é digitada na tela do próprio AAP (LDAP, por exemplo): o segundo fator depende do que o serviço de diretório oferece e, em geral, não é aplicado. Trate como exposto até provar o contrário.\n- MFA exigido só para alguns grupos: verifique se todos os usuários com acesso a credenciais e job templates de produção estão cobertos."
  },
  {
   "id": "LS-AAP-003",
   "titulo": "Reservar o System Administrator a contas de emergência",
   "tecnologia": "aap",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-003-administrador-somente-break-glass.md",
   "problema": "Um usuário do tipo System Administrator (no AAP 2.5 ou superior, **Ansible Automation Platform Administrator**) tem leitura e escrita sobre toda a instalação: todas as organizações, todos os inventários, todas as credenciais e todas as configurações. Com essa conta é possível executar qualquer comando em qualquer servidor gerenciado.",
   "beneficio": "O comprometimento da conta de um operador passa a dar ao invasor apenas o que aquele operador podia fazer: os job templates e inventários do time dele, e não a plataforma inteira.",
   "avaliacao": "No automation controller 2.4:\n\n```bash\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  \"https://aap.exemplo.com.br/api/v2/users/?is_superuser=true\" | jq -r '.results[].username'\n```\n\nNo AAP 2.5 ou superior, os usuários passaram para a API do gateway (`/api/gateway/v1/users/`). O caminho mais seguro é a tela **Access Management > Users**, coluna **User type**. Contas migradas de versões anteriores podem aparecer como *Normal* e ainda assim ter administração de um serviço (Automation Execution, Automation Decisions ou Automation Content): abra o usuário para conferir.\n\nVerifique também se algum mapeamento do provedor de identidade concede privilégio de administrador a um grupo inteiro.\n\nInterpretação:\n\n- Mais administradores do que contas de emergência previstas (uma ou duas): **exposto**.\n- Usuários nominais de uso diário como administradores: **exposto**.\n- A conta `admin` usada por mais de uma pessoa, ou com `last_login` recente sem incidente registrado: **exposto**."
  },
  {
   "id": "LS-AAP-004",
   "titulo": "Restringir o acesso ao sistema operacional dos nós do AAP",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior, instalado em RHEL 8 e 9 (RPM ou contêiner)",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-004-acesso-ao-so-dos-nos.md",
   "problema": "Os controles de acesso da interface do AAP não valem para quem entra no sistema operacional dos nós. Nesses servidores estão a chave que decifra as credenciais guardadas no banco, a senha do banco de dados e os certificados da plataforma. Esses arquivos ficam sem criptografia, porque os serviços precisam lê-los ao iniciar, e são protegidos apenas por permissões UNIX: `root` e a conta de serviço `awx` conseguem lê-los.",
   "beneficio": "O caminho para as credenciais da automação passa a ser um só: a interface e a API do AAP, com autenticação, papéis e registro. Comprometer uma conta comum de sistema operacional em um nó da plataforma deixa de dar acesso à chave e ao banco.",
   "avaliacao": "Em cada nó da plataforma (controller, banco de dados, hub, gateway, nós de execução):\n\n```bash\ngetent group wheel\ngrep -rEs '^[^#]*\\b(awx|postgres)\\b' /etc/sudoers /etc/sudoers.d/\nsudo -l -U awx\nsudo -l -U postgres\npasswd -S awx postgres\nls -l ~awx/.ssh/authorized_keys ~postgres/.ssh/authorized_keys 2>/dev/null\nawk -F: '$7 !~ /(nologin|false)$/ {print $1}' /etc/passwd\n```\n\nIndicadores de exposição:\n\n- Membros de `wheel`, ou de outro grupo com `sudo`, que não mantêm a plataforma.\n- Qualquer regra de `sudo` em que `awx` ou `postgres` aparecem: seja concedendo privilégio a essas contas, seja permitindo que outro usuário se torne uma delas (`(awx)`, `(postgres)`).\n- `awx` ou `postgres` com senha definida (o esperado em `passwd -S` é `LK`) ou com `authorized_keys`.\n- Contas com shell de login além das de serviço e das dos administradores.\n\nNa instalação em contêiner, os serviços rodam no Podman de um usuário dedicado, e os segredos da plataforma ficam nos Podman secrets desse usuário. Aplique as mesmas perguntas a essa conta."
  },
  {
   "id": "LS-AAP-005",
   "titulo": "Proteger a SECRET_KEY e manter cópia de segurança",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior (os caminhos variam entre instalação RPM, em contêiner e por operador)",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-005-protecao-da-secret-key.md",
   "problema": "O automation controller guarda senhas, chaves SSH e tokens cifrados no banco de dados. A chave que cifra esses campos é a `SECRET_KEY`. Quem tem a chave e uma cópia do banco tem todas as credenciais que a automação usa, sem precisar passar pela interface.",
   "beneficio": "A cópia do banco e os backups deixam de ser, sozinhos, um caminho para as credenciais do ambiente: sem a chave, o conteúdo cifrado não serve ao invasor, e a chave passa a existir apenas onde precisa estar.",
   "avaliacao": "Instalação RPM, em cada nó do controller:\n\n```bash\nstat -c '%U:%G %a %n' /etc/tower/SECRET_KEY\nfind / -xdev -name 'SECRET_KEY*' -not -path '/proc/*' 2>/dev/null\n```\n\nInstalação em contêiner, com o usuário da instalação:\n\n```bash\npodman secret ls\nls -l ~/.local/share/containers/storage/secrets/filedriver/secretsdata.json\n```\n\nEm todos os casos, localize os arquivos de backup da plataforma e veja quem consegue lê-los.\n\nIndicadores de exposição:\n\n- O arquivo da chave legível por alguém além de `root` e da conta de serviço `awx`.\n- Cópias da chave fora do local original: diretórios pessoais, pastas do instalador, repositórios.\n- Backups em área compartilhada, sem criptografia, ou acessíveis a quem não administra a plataforma.\n- Ninguém sabe onde está a cópia de segurança da chave, ou ela só existe dentro dos próprios nós.\n\nNa instalação em contêiner, o arquivo dos Podman secrets guarda os valores em base64, e não cifrados. A proteção é a permissão do arquivo e o acesso à conta, tratados em [LS-AAP-004](catalogo/aap/LS-AAP-004-acesso-ao-so-dos-nos.md)."
  },
  {
   "id": "LS-AAP-006",
   "titulo": "Guardar as senhas do inventário de instalação em Ansible Vault",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior, instalação RPM e em contêiner",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-006-senhas-do-instalador-em-vault.md",
   "problema": "O instalador do AAP recebe as senhas da plataforma como variáveis do arquivo de inventário: a do usuário `admin`, a do banco de dados, a do registro de imagens e as dos demais componentes. O exemplo de inventário da documentação traz essas variáveis em texto claro, e é assim que o arquivo costuma ficar.",
   "beneficio": "O inventário deixa de ser uma credencial. Ele pode ser versionado, copiado e revisado sem expor a plataforma, porque as senhas ficam em um arquivo cifrado à parte.",
   "avaliacao": "No diretório do instalador e em qualquer lugar onde o inventário esteja copiado:\n\n```bash\ngrep -nEi '^[^#]*(password|secret|token)[a-z_]*[[:space:]]*=' inventory\nhead -1 credentials.yml 2>/dev/null\ngit log --oneline -- inventory 2>/dev/null | head\n```\n\n- Variáveis de senha com valor no inventário: **exposto**. Exemplos de nomes: `admin_password`, `pg_password` e `registry_password` na instalação RPM; `controller_admin_password` e `gateway_admin_password` na instalação em contêiner. A lista completa varia por versão e por componente.\n- Arquivo de credenciais cuja primeira linha não começa com `$ANSIBLE_VAULT`: está em texto claro.\n- Inventário com senhas no histórico do Git: as senhas continuam expostas mesmo depois de removidas do arquivo atual."
  },
  {
   "id": "LS-AAP-007",
   "titulo": "Enviar os logs e o activity stream para um agregador central",
   "tecnologia": "aap",
   "pilar": "detectar",
   "impacto": "alto",
   "esforco": "baixo",
   "prioridade": 1,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-007-logs-e-activity-stream-em-agregador.md",
   "problema": "O AAP registra quem alterou o quê no **activity stream**: criação de usuários, mudanças em credenciais, concessão de papéis, alteração de job templates. Registra também cada job executado e os eventos de cada tarefa. Por padrão, tudo isso fica no banco de dados e nos arquivos da própria plataforma.",
   "beneficio": "O uso da automação passa a ter um registro fora do alcance de quem controla a plataforma. Depois de um incidente, é possível responder quais jobs rodaram, com quais credenciais, contra quais servidores e a pedido de quem, mesmo que o AAP tenha sido alterado.",
   "avaliacao": "No automation controller 2.4:\n\n```bash\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  https://aap.exemplo.com.br/api/v2/settings/logging/ \\\n  | jq '{LOG_AGGREGATOR_ENABLED, LOG_AGGREGATOR_HOST, LOG_AGGREGATOR_TYPE, LOG_AGGREGATOR_LOGGERS}'\n```\n\nPela interface: **Settings > Logging settings** no AAP 2.4; **Settings > Automation Execution > Logging** no AAP 2.5 ou superior. Na 2.5 ou superior a API do controller fica atrás do gateway; confira o caminho na raiz `/api/` da instalação.\n\n- `LOG_AGGREGATOR_ENABLED` igual a `false`, ou sem host definido: **sem detecção central.**\n- `activity_stream` fora da lista de loggers: as alterações de configuração não saem da plataforma.\n- **Enable Activity Stream** desativado nas configurações de sistema: o registro nem sequer é gerado.\n- Configuração presente, mas apontando para um destino que não recebe: faça o teste da seção de validação."
  },
  {
   "id": "LS-AAP-008",
   "titulo": "Autenticar pelo IdP corporativo, sem contas locais compartilhadas",
   "tecnologia": "aap",
   "pilar": "prevenir",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "Ansible Automation Platform 2.4 (por componente) e 2.5 ou superior (platform gateway)",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-008-idp-corporativo-sem-contas-compartilhadas.md",
   "problema": "Contas locais do AAP têm vida própria: não seguem a política de senhas da empresa, não são desativadas quando a pessoa sai e não passam pelo segundo fator. Quando, além disso, são compartilhadas — o `admin` que o time inteiro conhece, o usuário `operador` usado por três turnos —, a senha circula em mensagens e planilhas, e o registro de quem fez o quê deixa de existir.",
   "beneficio": "O acesso ao AAP passa a seguir o ciclo de vida da identidade corporativa: quem sai da empresa ou muda de função perde o acesso no mesmo momento, e a política de senha e o segundo fator ([LS-AAP-002](catalogo/aap/LS-AAP-002-mfa-no-provedor-de-identidade.md)) valem para todos.",
   "avaliacao": "No automation controller 2.4:\n\n```bash\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  \"https://aap.exemplo.com.br/api/v2/users/?page_size=200\" \\\n  | jq -r '.results[] | [.username, (.external_account // \"local\"), (.ldap_dn // \"\"), (.last_login // \"nunca\")] | @tsv'\n```\n\nNo AAP 2.5 ou superior, use **Access Management > Users** e **Access Management > Authentication Methods**. Os usuários ficam na API do gateway (`/api/gateway/v1/users/`).\n\nIndicadores de exposição:\n\n- Nenhum método de autenticação externo configurado.\n- Contas locais com nome genérico (`operador`, `suporte`, `ansible`, `deploy`) e login recente.\n- A conta `admin` com uso frequente.\n- Contas locais de pessoas que já não fazem parte do time."
  },
  {
   "id": "LS-AAP-009",
   "titulo": "Separar as credenciais por finalidade e ambiente",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "Ansible Automation Platform 2.x; hosts gerenciados RHEL 7, 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-009-credenciais-por-finalidade-e-ambiente.md",
   "problema": "É comum existir no AAP uma única credencial de máquina, usada em todos os job templates: a mesma chave SSH, da mesma conta com `sudo`, vale em desenvolvimento, homologação e produção, para aplicar correções, publicar aplicações e coletar inventário.",
   "beneficio": "O alcance de uma credencial passa a ser o de um ambiente e de uma finalidade. Quem compromete a automação de desenvolvimento chega aos servidores de desenvolvimento, e não aos de produção. Uma chave vazada obriga a trocar um par de chaves em um grupo de servidores, e não em todos.",
   "avaliacao": "No AAP, liste as credenciais e veja em quantos job templates e ambientes cada uma é usada. Pela interface, em **Credentials**; no automation controller 2.4, pela API:\n\n```bash\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  \"https://aap.exemplo.com.br/api/v2/job_templates/?page_size=200\" \\\n  | jq -r '.results[] | [.name, .summary_fields.inventory.name, ([.summary_fields.credentials[].name] | join(\",\"))] | @tsv'\n```\n\nEm um host de produção e em um de não produção, compare as chaves aceitas pela conta de automação:\n\n```bash\nssh-keygen -lf ~<conta-de-automacao>/.ssh/authorized_keys\n```\n\nIndicadores de exposição:\n\n- A mesma credencial de máquina em job templates de inventários de ambientes diferentes.\n- A mesma impressão digital de chave em hosts de produção e de não produção.\n- Uma única conta de automação, com `sudo` irrestrito, usada para todas as finalidades.\n- Credenciais de outros tipos (repositório de código, registro de imagens, nuvem) com privilégio de escrita onde só a leitura é necessária."
  },
  {
   "id": "LS-AAP-010",
   "titulo": "Segmentar a rede dos nós do AAP",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior, instalado em RHEL 8 e 9",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-010-segmentacao-de-rede-dos-nos.md",
   "problema": "Os nós do AAP expõem serviços que só interessam à própria plataforma: o PostgreSQL com as credenciais cifradas, a malha de automação (receptor) que distribui jobs e, no AAP 2.5 ou superior, o Redis. Quando esses servidores ficam em uma rede comum, qualquer host invadido da mesma rede pode tentar o banco de dados, a malha e o SSH dos nós.",
   "beneficio": "Um servidor invadido em outra parte do ambiente deixa de alcançar o banco de dados, a malha e o SSH da plataforma. O único serviço do AAP visível fora dos seus nós passa a ser a interface HTTPS, e apenas para as redes de onde os usuários realmente acessam.",
   "avaliacao": "Em cada nó:\n\n```bash\nss -tlnp\nfirewall-cmd --get-active-zones\nfirewall-cmd --list-all-zones | grep -E '^\\S|sources:|services:|ports:|rich rules:'\n```\n\nDe um servidor que **não** faz parte da plataforma, verifique o que responde:\n\n```bash\nfor porta in 22 443 5432 6379 27199; do\n  timeout 3 bash -c \"<\/dev/tcp/192.0.2.30/$porta\" 2>/dev/null && echo \"$porta aberta\"\ndone\n```\n\nInterpretação: de um servidor comum, o esperado é que nenhuma dessas portas responda. De uma estação de usuário, apenas a 443. Qualquer resposta em 5432, 6379 ou 27199 fora dos nós da plataforma é **exposição**."
  },
  {
   "id": "LS-AAP-011",
   "titulo": "Centralizar a propriedade das credenciais e conceder aos times apenas o papel Use",
   "tecnologia": "aap",
   "pilar": "conter",
   "impacto": "alto",
   "esforco": "medio",
   "prioridade": 2,
   "versoes": "Ansible Automation Platform 2.4 e 2.5 ou superior",
   "status": "rascunho",
   "arquivo": "catalogo/aap/LS-AAP-011-credenciais-com-propriedade-central.md",
   "problema": "No AAP, quem administra uma credencial pode alterá-la, trocar o segredo, associá-la a outros job templates e conceder acesso a outras pessoas. Quando cada time cria e administra as próprias credenciais, ou quando elas pertencem a usuários individuais, ninguém sabe ao certo quantas credenciais com acesso a produção existem, quem pode usá-las e quem pode repassá-las.",
   "beneficio": "O número de contas capazes de alterar ou redistribuir credenciais cai para o do time da plataforma. Comprometer a conta de um operador dá ao invasor o uso das credenciais daquele time, nos job templates daquele time, mas não a capacidade de ampliar esse acesso nem de trocar segredos.",
   "avaliacao": "Pela interface, abra cada credencial e veja as abas de acesso de usuários e de times. No automation controller 2.4, pela API:\n\n```bash\n# credenciais sem organização (pertencem a usuários)\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  \"https://aap.exemplo.com.br/api/v2/credentials/?organization__isnull=true\" | jq -r '.results[].name'\n\n# quem tem acesso a uma credencial, e com quais papéis\ncurl -s -H \"Authorization: Bearer <token>\" \\\n  \"https://aap.exemplo.com.br/api/v2/credentials/<id>/access_list/\" \\\n  | jq -r '.results[] | [.username, ([.summary_fields.direct_access[].role.name] | join(\",\"))] | @tsv'\n```\n\nNo AAP 2.5 ou superior, os nomes dos papéis e os caminhos da API mudam; use as abas de acesso da credencial e confira os caminhos na raiz `/api/` da instalação.\n\nIndicadores de exposição:\n\n- Credenciais sem organização, pertencentes a usuários individuais.\n- Papel de administração de credenciais nas mãos de usuários ou times fora do time da plataforma.\n- Papéis concedidos diretamente a usuários, e não a times.\n- Credenciais duplicadas com o mesmo segredo em organizações diferentes."
  }
 ],
 "logs": [
  {
   "camada": "Sistema operacional",
   "id": "LS-RHEL-002"
  },
  {
   "camada": "Ingress do OpenShift",
   "id": "LS-OCP-003"
  },
  {
   "camada": "API do OpenShift (auditoria)",
   "id": "LS-OCP-006"
  },
  {
   "camada": "JBoss EAP",
   "id": "LS-JBOSS-004"
  },
  {
   "camada": "Ansible Automation Platform",
   "id": "LS-AAP-007"
  }
 ],
 "processos": {
  "arquivo": "docs/avaliacao-de-processos.md",
  "chave": [
   1,
   14,
   15
  ],
  "blocos": [
   {
    "nome": "Resposta a incidentes",
    "central": "Se um servidor for invadido hoje, quem é acionado e quem decide?",
    "perguntas": [
     {
      "id": "PROC-01",
      "n": 1,
      "pergunta": "Existe um time ou uma pessoa responsável por responder a incidentes de segurança?",
      "sim": "Nomes, um substituto e um contato que funciona fora do horário comercial",
      "porque": "Sem responsável, as primeiras horas se perdem descobrindo quem deveria agir, e são elas que definem até onde o invasor chega",
      "primeiro_passo": "Nomear uma pessoa e um substituto, com contato fora do horário e autoridade para isolar um componente. O time vem depois"
     },
     {
      "id": "PROC-02",
      "n": 2,
      "pergunta": "Está definido quem decide entre manter o serviço no ar e conter?",
      "sim": "Um papel nomeado, com autoridade reconhecida pela área de negócio",
      "porque": "Isolar um componente derruba o serviço que ele presta. Sem alguém que decida, o isolamento espera uma reunião",
      "primeiro_passo": "Nomear uma pessoa e um substituto, com contato fora do horário e autoridade para isolar um componente. O time vem depois"
     },
     {
      "id": "PROC-03",
      "n": 3,
      "pergunta": "Existe um plano de resposta escrito, e ele já foi usado?",
      "sim": "Um documento que a equipe sabe localizar e a data do último simulado ou incidente real em que foi seguido",
      "porque": "Plano nunca exercitado falha nos detalhes: contato desatualizado, acesso que não funciona, canal que depende do ambiente afetado",
      "primeiro_passo": "Escrever uma página: quem acionar, quem decide, qual é o canal alternativo e onde estão os logs. As [recomendações gerais para incidentes](docs/recomendacoes-para-incidentes.md) servem de base"
     },
     {
      "id": "PROC-04",
      "n": 4,
      "pergunta": "Depois de um incidente, alguém registra o que aconteceu e o que muda?",
      "sim": "O relatório do último incidente, com ações, responsáveis e prazos",
      "porque": "É o que transforma o caminho percorrido pelo invasor em controle permanente",
      "primeiro_passo": ""
     }
    ]
   },
   {
    "nome": "Segurança e políticas",
    "central": "Quem define o que é aceitável e confere se está sendo cumprido?",
    "perguntas": [
     {
      "id": "PROC-05",
      "n": 5,
      "pergunta": "Existe um time ou uma pessoa de segurança que define as políticas e acompanha a aplicação?",
      "sim": "Um responsável nomeado e políticas escritas que a operação conhece e usa, como uma linha de base de configuração por plataforma",
      "porque": "Sem dono, cada equipe decide sozinha o que é aceitável, e o padrão do ambiente passa a ser o do servidor mais fraco",
      "primeiro_passo": "Nomear um responsável e adotar como primeira linha de base escrita os controles do catálogo já aplicados"
     },
     {
      "id": "PROC-06",
      "n": 6,
      "pergunta": "Alguém verifica periodicamente se as políticas estão sendo cumpridas?",
      "sim": "Uma verificação com data e resultado guardado, manual ou automatizada",
      "porque": "Configuração de segurança se degrada com o tempo. Os playbooks `avaliar_*` da [automação](automacao/README.md) servem a essa verificação para os controles do catálogo",
      "primeiro_passo": "Agendar a execução dos playbooks `avaliar_*` e guardar o resultado de cada rodada"
     },
     {
      "id": "PROC-07",
      "n": 7,
      "pergunta": "As exceções são registradas com dono, justificativa e prazo de revisão?",
      "sim": "Uma lista de exceções consultável, com data da última revisão",
      "porque": "Exceção sem registro vira exposição permanente. Exceção registrada, como um JBoss EAP legado que não pode ser atualizado, é candidata a controle de contenção ([LS-JBOSS-002](catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md))",
      "primeiro_passo": "Abrir uma lista com sistema, motivo, dono e data de revisão, começando pelos sistemas que não podem ser atualizados"
     },
     {
      "id": "PROC-08",
      "n": 8,
      "pergunta": "Existe um inventário dos sistemas, com um responsável por cada um?",
      "sim": "Uma lista atualizada em que cada servidor, cluster e aplicação tem dono",
      "porque": "Não se contém o que não se sabe que existe, e sistema sem dono é o que fica sem correção",
      "primeiro_passo": "Começar pelo que está exposto à internet e pelos pontos de controle central: Ansible Automation Platform e plano de controle do OpenShift"
     }
    ]
   },
   {
    "nome": "Operação",
    "central": "Quem opera as plataformas sabe mantê-las seguras?",
    "perguntas": [
     {
      "id": "PROC-09",
      "n": 9,
      "pergunta": "As equipes que operam as plataformas têm conhecimento de segurança, ou alguém a quem recorrer?",
      "sim": "Em cada plataforma (OpenShift, RHEL, JBoss EAP, Ansible Automation Platform), uma pessoa de referência em segurança ou um canal direto com o time de segurança",
      "porque": "É a operação que aplica e mantém os controles. Quem não entende por que uma regra existe a remove no primeiro chamado",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-10",
      "n": 10,
      "pergunta": "Há um processo para acompanhar e aplicar correções de segurança, com prazo?",
      "sim": "Alguém acompanha os avisos de segurança do fornecedor, há prazo definido por severidade e a data da última rodada de correções é conhecida",
      "porque": "Vulnerabilidade sem correção é a primeira forma de entrada citada no [modelo de ameaça](docs/modelo-de-ameaca.md)",
      "primeiro_passo": "Definir quem acompanha os avisos de segurança do fornecedor e um prazo para as correções de severidade crítica"
     },
     {
      "id": "PROC-11",
      "n": 11,
      "pergunta": "Os acessos administrativos são individuais e revisados?",
      "sim": "Contas nominais, remoção quando a pessoa sai ou muda de função e uma revisão com data",
      "porque": "Conta compartilhada e acesso esquecido são credenciais prontas para a movimentação lateral, e impedem saber quem fez o quê. Relacionado: [LS-RHEL-001](catalogo/rhel/LS-RHEL-001-ssh-somente-de-origens-administrativas.md) e [LS-AAP-001](catalogo/aap/LS-AAP-001-chave-de-automacao-restrita.md)",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-12",
      "n": 12,
      "pergunta": "As mudanças em produção são registradas e revisadas por outra pessoa?",
      "sim": "Um registro consultável que inclui regras de firewall, permissões e acessos",
      "porque": "Durante um incidente, é o registro de mudanças que separa o que a equipe fez do que o invasor fez",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-13",
      "n": 13,
      "pergunta": "A restauração de backup já foi testada?",
      "sim": "Um teste de restauração com data, e cópias que as credenciais do ambiente de produção não alcançam",
      "porque": "Backup acessível com as mesmas credenciais do ambiente invadido é apagado junto com ele",
      "primeiro_passo": ""
     }
    ]
   },
   {
    "nome": "Monitoramento e detecção",
    "central": "Alguém vê o alerta, e em quanto tempo?",
    "perguntas": [
     {
      "id": "PROC-14",
      "n": 14,
      "pergunta": "Os logs saem dos servidores para um destino central, com retenção definida?",
      "sim": "O encaminhamento funcionando em cada camada e um prazo de retenção escrito",
      "porque": "É a [primeira verificação](docs/metodologia.md#a-primeira-verificação-os-logs-saem-do-servidor) da metodologia: [LS-RHEL-002](catalogo/rhel/LS-RHEL-002-syslog-central.md), [LS-OCP-003](catalogo/openshift/LS-OCP-003-log-de-acesso-do-ingress-em-syslog.md) e [LS-JBOSS-004](catalogo/jboss-eap/LS-JBOSS-004-logs-do-jboss-em-syslog.md)",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-15",
      "n": 15,
      "pergunta": "Alguém é responsável por olhar os alertas, e em quanto tempo?",
      "sim": "Um nome ou uma escala, um tempo esperado até a primeira análise e a regra para fora do horário comercial",
      "porque": "Os controles de contenção geram sinais de alta qualidade. Sem destinatário, o bloqueio continua funcionando, mas a detecção se perde",
      "primeiro_passo": "Começar com poucos alertas, os de bloqueio dos controles de contenção, e um destinatário nomeado"
     },
     {
      "id": "PROC-16",
      "n": 16,
      "pergunta": "Cada alerta tem uma instrução do que fazer?",
      "sim": "Para os alertas dos controles já aplicados, uma instrução curta: o que significa, o que conferir e quem acionar",
      "porque": "Alerta sem instrução é ignorado ou escalado para a pessoa errada",
      "primeiro_passo": "Começar com poucos alertas, os de bloqueio dos controles de contenção, e um destinatário nomeado"
     }
    ]
   },
   {
    "nome": "Desenvolvimento",
    "central": "Quem escreve as aplicações sabe o que as expõe?",
    "perguntas": [
     {
      "id": "PROC-17",
      "n": 17,
      "pergunta": "As equipes de desenvolvimento recebem orientação de segurança?",
      "sim": "Treinamento ou material com data, voltado às linguagens e aos frameworks que a equipe realmente usa",
      "porque": "Falha na aplicação aparece em dois pontos de entrada do modelo de ameaça: o JBoss EAP legado e o pod de aplicação",
      "primeiro_passo": "Fazer uma sessão curta sobre as falhas já encontradas nas aplicações do próprio ambiente"
     },
     {
      "id": "PROC-18",
      "n": 18,
      "pergunta": "Dependências e imagens são verificadas quanto a vulnerabilidades conhecidas?",
      "sim": "Uma verificação automática no pipeline ou periódica, com alguém responsável por tratar o resultado",
      "porque": "Vulnerabilidade em biblioteca é um dos motivos pelos quais o pod de aplicação é ponto de entrada comum, e uma verificação sem dono só produz relatórios",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-19",
      "n": 19,
      "pergunta": "Senhas, chaves e tokens ficam fora do código e dos repositórios?",
      "sim": "Segredos em cofre ou em recurso próprio da plataforma, e uma busca por segredos nos repositórios com data",
      "porque": "Credencial em repositório é lida por qualquer pessoa ou processo com acesso ao código, e liga sistemas que a rede não liga",
      "primeiro_passo": ""
     },
     {
      "id": "PROC-20",
      "n": 20,
      "pergunta": "A equipe de desenvolvimento sabe dizer com quais destinos cada aplicação precisa falar?",
      "sim": "Para cada aplicação, a lista de bancos de dados e integrações que ela usa",
      "porque": "É a informação que os controles de contenção exigem: a lista de destinos do [LS-JBOSS-002](catalogo/jboss-eap/LS-JBOSS-002-egress-por-usuario.md) e as regras do [LS-OCP-002](catalogo/openshift/LS-OCP-002-networkpolicy-negacao-padrao.md)",
      "primeiro_passo": ""
     }
    ]
   }
  ]
 },
 "incidentes": {
  "arquivo": "docs/recomendacoes-para-incidentes.md",
  "itens": [
   {
    "titulo": "Aceitar entrada apenas do Brasil",
    "link": "docs/recomendacoes-para-incidentes.md#aceitar-entrada-apenas-do-brasil-no-perímetro",
    "efeito": "Menos origens conseguem alcançar os serviços publicados",
    "tipo": "Reduz ruído"
   },
   {
    "titulo": "Fechar interfaces administrativas expostas",
    "link": "docs/recomendacoes-para-incidentes.md#fechar-interfaces-administrativas-expostas-à-internet",
    "efeito": "Administração só por VPN ou rede administrativa",
    "tipo": "Contém"
   },
   {
    "titulo": "Restringir a saída para a internet",
    "link": "docs/recomendacoes-para-incidentes.md#restringir-a-saída-dos-servidores-para-a-internet",
    "efeito": "Dificulta comando remoto e saída de dados",
    "tipo": "Contém"
   },
   {
    "titulo": "Isolar sem desligar",
    "link": "docs/recomendacoes-para-incidentes.md#isolar-o-componente-suspeito-sem-desligá-lo",
    "efeito": "O componente suspeito para de alcançar os vizinhos e a evidência é mantida",
    "tipo": "Contém"
   },
   {
    "titulo": "Preservar evidências",
    "link": "docs/recomendacoes-para-incidentes.md#preservar-evidências-antes-de-limpar",
    "efeito": "A investigação continua possível depois da limpeza",
    "tipo": "—"
   },
   {
    "titulo": "Trocar credenciais na ordem certa",
    "link": "docs/recomendacoes-para-incidentes.md#trocar-credenciais-na-ordem-certa",
    "efeito": "Credenciais expostas deixam de valer",
    "tipo": "Contém"
   },
   {
    "titulo": "Desenhar a topologia dos ativos envolvidos",
    "link": "docs/recomendacoes-para-incidentes.md#desenhar-a-topologia-dos-ativos-envolvidos",
    "efeito": "Todos enxergam o mesmo mapa: o que foi atingido, o que está ao alcance e onde bloquear",
    "tipo": "—"
   },
   {
    "titulo": "Organizar a resposta",
    "link": "docs/recomendacoes-para-incidentes.md#organizar-a-resposta",
    "efeito": "Decisões registradas e comunicação fora do ambiente afetado",
    "tipo": "—"
   },
   {
    "titulo": "Encerrar o incidente",
    "link": "docs/recomendacoes-para-incidentes.md#encerrar-o-incidente",
    "efeito": "Medidas temporárias viram controle permanente ou são removidas",
    "tipo": "—"
   }
  ]
 },
 "ameacas": {
  "arquivo": "docs/modelo-de-ameaca.md",
  "caminhos": [
   {
    "caminho": "Saída irrestrita do JBoss",
    "controles": [
     "LS-JBOSS-002"
    ]
   },
   {
    "caminho": "Interfaces de gerenciamento do JBoss expostas",
    "controles": [
     "LS-JBOSS-001"
    ]
   },
   {
    "caminho": "Invasão do JBoss passa despercebida",
    "controles": [
     "LS-JBOSS-003",
     "LS-JBOSS-004"
    ]
   },
   {
    "caminho": "Ponto de entrada pela web não fica registrado",
    "controles": [
     "LS-OCP-003"
    ]
   },
   {
    "caminho": "Machine Config Server acessível",
    "controles": [
     "LS-OCP-001"
    ]
   },
   {
    "caminho": "Rede de pods plana",
    "controles": [
     "LS-OCP-002",
     "LS-OCP-012"
    ]
   },
   {
    "caminho": "Contêiner com root, SCC privilegiada ou acesso ao host",
    "controles": [
     "LS-OCP-008",
     "LS-OCP-009"
    ]
   },
   {
    "caminho": "Token de service account e Secrets com alcance além do necessário",
    "controles": [
     "LS-OCP-010",
     "LS-OCP-011",
     "LS-OCP-013"
    ]
   },
   {
    "caminho": "Conta administrativa do OpenShift excessiva ou sem dono",
    "controles": [
     "LS-OCP-004",
     "LS-OCP-005"
    ]
   },
   {
    "caminho": "Ações na API do OpenShift passam despercebidas",
    "controles": [
     "LS-OCP-006",
     "LS-OCP-007"
    ]
   },
   {
    "caminho": "SSH livre entre servidores",
    "controles": [
     "LS-RHEL-001",
     "LS-RHEL-007"
    ]
   },
   {
    "caminho": "Root direto, contas compartilhadas e `sudo` amplo",
    "controles": [
     "LS-RHEL-004",
     "LS-RHEL-005"
    ]
   },
   {
    "caminho": "Serviço invadido sem confinamento no host",
    "controles": [
     "LS-RHEL-006",
     "LS-RHEL-010"
    ]
   },
   {
    "caminho": "Portas abertas além do necessário e host usado como roteador",
    "controles": [
     "LS-RHEL-008",
     "LS-RHEL-011"
    ]
   },
   {
    "caminho": "Invasor apaga os logs do host invadido",
    "controles": [
     "LS-RHEL-002"
    ]
   },
   {
    "caminho": "Ações privilegiadas e troca de binários passam despercebidas",
    "controles": [
     "LS-RHEL-003",
     "LS-RHEL-009",
     "LS-RHEL-012"
    ]
   },
   {
    "caminho": "Chave da automação aceita de qualquer origem",
    "controles": [
     "LS-AAP-001"
    ]
   },
   {
    "caminho": "Tomada do AAP por uma conta de usuário",
    "controles": [
     "LS-AAP-002",
     "LS-AAP-003",
     "LS-AAP-008"
    ]
   },
   {
    "caminho": "Extração das credenciais do AAP pelo sistema operacional, pelo banco ou pelo instalador",
    "controles": [
     "LS-AAP-004",
     "LS-AAP-005",
     "LS-AAP-006",
     "LS-AAP-010"
    ]
   },
   {
    "caminho": "Uma credencial do AAP abre todos os ambientes",
    "controles": [
     "LS-AAP-009",
     "LS-AAP-011"
    ]
   },
   {
    "caminho": "Uso indevido do AAP passa despercebido",
    "controles": [
     "LS-AAP-007"
    ]
   }
  ]
 }
};
