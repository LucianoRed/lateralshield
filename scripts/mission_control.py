#!/usr/bin/env python3
"""Gera os arquivos derivados do Mission Control.

A partir do catálogo e dos documentos, gera:

    mission-control/web/data.js                     dados exibidos pela página
    mission-control/openshift/mission-control.yaml  manifesto pronto para "oc apply"

Uso:
    python3 scripts/mission_control.py           gera os dois arquivos
    python3 scripts/mission_control.py --check   falha se algum estiver desatualizado
"""
import json
import posixpath
import re
import sys
from pathlib import Path

import catalogo

RAIZ = Path(__file__).resolve().parent.parent
MC = RAIZ / "mission-control"
WEB = MC / "web"
DADOS = WEB / "data.js"
BASE = MC / "openshift" / "base.yaml"
MANIFESTO = MC / "openshift" / "mission-control.yaml"

# Endereço público do repositório, usado nos links da página quando ela roda em servidor.
REPOSITORIO = "https://github.com/LucianoRed/lateralshield"

NOMES_CURTOS = {"openshift": "OpenShift", "rhel": "RHEL", "jboss-eap": "JBoss EAP", "aap": "AAP"}

# Um ConfigMap aplicado com "oc apply" guarda uma cópia de si mesmo em uma anotação
# limitada a 262144 bytes. Por isso os arquivos são divididos em dois ConfigMaps.
CONFIGMAPS = {
    "mission-control-web": ["index.html", "index.php", "relatorio.php", ".htaccess"],
    "mission-control-dados": ["data.js"],
}
LIMITE_CONFIGMAP = 200_000


def falhar(mensagem):
    print(f"ERRO {mensagem}")
    sys.exit(1)


def links_para_raiz(texto, arquivo):
    """Reescreve links relativos de um arquivo para caminhos a partir da raiz do repositório."""
    pasta = posixpath.dirname(arquivo)

    def trocar(m):
        alvo = m.group(2)
        if re.match(r"[a-z]+:", alvo):
            return m.group(0)
        caminho, _, ancora = alvo.partition("#")
        caminho = posixpath.normpath(posixpath.join(pasta, caminho)) if caminho else arquivo
        return f"]({caminho}{'#' + ancora if ancora else ''})"

    return re.sub(r"(\])\(([^)\s]+)\)", trocar, texto)


def secoes(texto):
    """Devolve {título: corpo} das seções de segundo nível de um Markdown."""
    partes = re.split(r"^## (.+)$", texto, flags=re.M)
    return {partes[i].strip(): partes[i + 1].strip() for i in range(1, len(partes), 2)}


def primeiro_paragrafo(texto):
    return texto.split("\n\n", 1)[0].strip()


def ler_controles():
    controles = []
    for caminho in sorted(catalogo.CATALOGO.glob("*/*.md")):
        meta, erros = catalogo.ler_controle(caminho)
        if erros:
            falhar(f"{caminho.relative_to(RAIZ)}: catálogo inválido, rode python3 scripts/catalogo.py")
        arquivo = caminho.relative_to(RAIZ).as_posix()
        sec = secoes(caminho.read_text(encoding="utf-8"))
        controles.append({
            "id": meta["id"],
            "titulo": meta["titulo"],
            "tecnologia": meta["tecnologia"],
            "pilar": meta["pilar"],
            "impacto": meta["impacto"],
            "esforco": meta["esforco"],
            "prioridade": catalogo.PRIORIDADE[(meta["impacto"], meta["esforco"])],
            "versoes": meta["versoes"],
            "status": meta["status"],
            "arquivo": arquivo,
            "problema": links_para_raiz(primeiro_paragrafo(sec["Problema"]), arquivo),
            "beneficio": links_para_raiz(primeiro_paragrafo(sec["Benefício"]), arquivo),
            "avaliacao": links_para_raiz(sec["Avaliação"], arquivo),
        })
    ordem = list(catalogo.TECNOLOGIAS)
    controles.sort(key=lambda c: (ordem.index(c["tecnologia"]), c["id"]))
    return controles


def linhas_de_tabela(texto):
    """Devolve as linhas de dados de uma tabela Markdown, cada uma como lista de células."""
    linhas = []
    for linha in texto.splitlines():
        if not linha.startswith("|") or re.match(r"\|\s*-", linha):
            continue
        linhas.append([c.strip() for c in linha.strip().strip("|").split("|")])
    return linhas[1:]  # sem o cabeçalho


def ler_logs():
    """Controles de log por camada, da tabela 'Camada | Controle' da metodologia."""
    arquivo = "docs/metodologia.md"
    texto = (RAIZ / arquivo).read_text(encoding="utf-8")
    m = re.search(r"^\| Camada \| Controle \|\n(?:\|.*\n)+", texto, re.M)
    if not m:
        falhar(f"{arquivo}: tabela 'Camada | Controle' não encontrada")
    logs = []
    for camada, controle in linhas_de_tabela(m.group(0)):
        ident = re.search(r"LS-[A-Z]+-\d{3}", controle)
        if ident:
            logs.append({"camada": camada, "id": ident.group(0)})
    return logs


def ler_processos():
    arquivo = "docs/avaliacao-de-processos.md"
    texto = (RAIZ / arquivo).read_text(encoding="utf-8")
    sec = secoes(texto)

    centrais = {}
    for bloco, central, _ in linhas_de_tabela(sec.get("Resumo", "")):
        nome = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", bloco)
        centrais[nome] = central

    passos = {}
    interpretar = sec.get("Como interpretar o resultado", "")
    for linha in linhas_de_tabela(interpretar):
        if len(linha) != 2:
            continue
        m = re.search(r"\(([\d,\s]+)\)\s*$", linha[0])
        if not m:
            continue
        for n in re.findall(r"\d+", m.group(1)):
            passos[int(n)] = links_para_raiz(linha[1], arquivo)

    chave = []
    m = re.search(r"Comece pelas perguntas ([\d,\se]+?)\.", interpretar)
    if m:
        chave = [int(n) for n in re.findall(r"\d+", m.group(1))]

    blocos = []
    for nome, corpo in sec.items():
        if not re.search(r"^\| # \| Pergunta \|", corpo, re.M):
            continue
        perguntas = []
        for linha in linhas_de_tabela(corpo):
            if len(linha) != 4 or not linha[0].isdigit():
                falhar(f"{arquivo}: linha inesperada no bloco '{nome}': {linha}")
            n = int(linha[0])
            perguntas.append({
                "id": f"PROC-{n:02d}",
                "n": n,
                "pergunta": linha[1],
                "sim": links_para_raiz(linha[2], arquivo),
                "porque": links_para_raiz(linha[3], arquivo),
                "primeiro_passo": passos.get(n, ""),
            })
        blocos.append({"nome": nome, "central": centrais.get(nome, ""), "perguntas": perguntas})
    if not blocos:
        falhar(f"{arquivo}: nenhuma tabela de perguntas encontrada")
    return {"arquivo": arquivo, "chave": chave, "blocos": blocos}


def ler_incidentes():
    arquivo = "docs/recomendacoes-para-incidentes.md"
    texto = (RAIZ / arquivo).read_text(encoding="utf-8")
    itens = []
    for linha in linhas_de_tabela(secoes(texto).get("Resumo", "")):
        if len(linha) != 3:
            continue
        m = re.match(r"\[([^\]]+)\]\((#[^)]+)\)", linha[0])
        if not m:
            continue
        itens.append({"titulo": m.group(1), "link": arquivo + m.group(2), "efeito": linha[1], "tipo": linha[2]})
    return {"arquivo": arquivo, "itens": itens}


def gerar_dados():
    dados = {
        "aviso": "Gerado por scripts/mission_control.py a partir de catalogo/ e docs/. Não edite manualmente.",
        "repositorio": REPOSITORIO,
        "tecnologias": [
            {"id": tec, "nome": nome, "curto": NOMES_CURTOS[tec]}
            for tec, (nome, _) in catalogo.TECNOLOGIAS.items()
        ],
        "controles": ler_controles(),
        "logs": ler_logs(),
        "processos": ler_processos(),
        "incidentes": ler_incidentes(),
    }
    corpo = json.dumps(dados, ensure_ascii=False, indent=1)
    # "</" não pode aparecer cru dentro de um <script>.
    corpo = corpo.replace("</", "<\\/")
    return "// " + dados["aviso"] + "\nwindow.LS_DADOS = " + corpo + ";\n"


def bloco_yaml(nome, conteudo, recuo="    "):
    """Devolve o conteúdo como bloco literal YAML ('|')."""
    if "\t" in conteudo:
        falhar(f"mission-control/web/{nome}: contém tabulação; use espaços")
    if not conteudo.endswith("\n") or conteudo.endswith("\n\n"):
        falhar(f"mission-control/web/{nome}: o arquivo deve terminar com exatamente uma quebra de linha")
    linhas = conteudo[:-1].split("\n")
    if linhas[0][:1] in (" ", ""):
        falhar(f"mission-control/web/{nome}: a primeira linha não pode ser vazia nem começar com espaço")
    for n, linha in enumerate(linhas, 1):
        if linha != linha.rstrip():
            falhar(f"mission-control/web/{nome}:{n}: espaço no fim da linha")
    return "\n".join(recuo + linha if linha else "" for linha in linhas) + "\n"


def gerar_manifesto(dados_js):
    base = BASE.read_text(encoding="utf-8")
    if not base.endswith("\n"):
        base += "\n"
    partes = [
        "# GERADO por scripts/mission_control.py. Não edite manualmente.\n"
        "# Fontes: mission-control/openshift/base.yaml e mission-control/web/.\n"
        "#\n"
        "#   oc new-project lateralshield\n"
        "#   oc apply -f mission-control/openshift/mission-control.yaml\n",
        base,
    ]
    for nome_cm, arquivos in CONFIGMAPS.items():
        cm = (
            "---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n"
            f"  name: {nome_cm}\n  namespace: lateralshield\n"
            "  labels:\n    app.kubernetes.io/part-of: lateralshield-mission-control\ndata:\n"
        )
        tamanho = 0
        for arquivo in arquivos:
            conteudo = dados_js if arquivo == "data.js" else (WEB / arquivo).read_text(encoding="utf-8")
            tamanho += len(conteudo.encode("utf-8"))
            cm += f"  {arquivo}: |\n" + bloco_yaml(arquivo, conteudo)
        if tamanho > LIMITE_CONFIGMAP:
            falhar(f"ConfigMap {nome_cm} com {tamanho} bytes: acima de {LIMITE_CONFIGMAP}, divida os arquivos")
        partes.append(cm)
    return "".join(partes)


def main():
    dados_js = gerar_dados()
    saidas = {DADOS: dados_js, MANIFESTO: gerar_manifesto(dados_js)}
    if "--check" in sys.argv:
        velhos = [c for c, t in saidas.items() if not c.exists() or c.read_text(encoding="utf-8") != t]
        for caminho in velhos:
            print(f"ERRO {caminho.relative_to(RAIZ)} desatualizado: rode python3 scripts/mission_control.py")
        if velhos:
            return 1
    else:
        for caminho, texto in saidas.items():
            caminho.write_text(texto, encoding="utf-8")
    print(f"OK Mission Control: {len(saidas)} arquivos gerados a partir do catálogo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
