#!/usr/bin/env python3
"""Valida os controles do catálogo e gera catalogo/INDICE.md.

Uso:
    python3 scripts/catalogo.py           valida e regenera o índice
    python3 scripts/catalogo.py --check   valida e falha se o índice estiver desatualizado
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "catalogo"
INDICE = CATALOGO / "INDICE.md"

TECNOLOGIAS = {
    "openshift": ("Red Hat OpenShift", "LS-OCP-"),
    "rhel": ("Red Hat Enterprise Linux", "LS-RHEL-"),
    "jboss-eap": ("Red Hat JBoss EAP", "LS-JBOSS-"),
    "aap": ("Red Hat Ansible Automation Platform", "LS-AAP-"),
}
VALORES = {
    "pilar": ["prevenir", "conter", "detectar"],
    "impacto": ["alto", "medio", "baixo"],
    "esforco": ["baixo", "medio", "alto"],
    "status": ["rascunho", "validado", "em-producao"],
}
CAMPOS = ["id", "titulo", "tecnologia", "pilar", "impacto", "esforco", "versoes", "status"]
SECOES = [
    "Problema", "Pré-requisitos", "Avaliação", "Implementação", "Validação",
    "Reversão", "Impacto operacional", "Detecção", "Referências",
]
# Prioridade 80/20 definida em docs/metodologia.md
PRIORIDADE = {
    ("alto", "baixo"): 1, ("alto", "medio"): 2, ("medio", "baixo"): 2,
    ("medio", "medio"): 3, ("baixo", "baixo"): 3,
}


def ler_controle(caminho):
    texto = caminho.read_text(encoding="utf-8")
    erros = []
    m = re.match(r"---\n(.*?)\n---\n", texto, re.S)
    if not m:
        return None, ["cabeçalho de metadados ausente"]
    meta = {}
    for linha in m.group(1).splitlines():
        if ":" in linha:
            chave, valor = linha.split(":", 1)
            meta[chave.strip()] = valor.strip()

    for campo in CAMPOS:
        if not meta.get(campo):
            erros.append(f"campo obrigatório ausente: {campo}")
    for campo, validos in VALORES.items():
        if meta.get(campo) and meta[campo] not in validos:
            erros.append(f"{campo} inválido: {meta[campo]} (use {', '.join(validos)})")

    tec = meta.get("tecnologia")
    if tec and tec not in TECNOLOGIAS:
        erros.append(f"tecnologia fora do escopo: {tec}")
    elif tec:
        if caminho.parent.name != tec:
            erros.append(f"arquivo deveria estar em catalogo/{tec}/")
        prefixo = TECNOLOGIAS[tec][1]
        if not re.fullmatch(re.escape(prefixo) + r"\d{3}", meta.get("id", "")):
            erros.append(f"id deve ter o formato {prefixo}NNN")
    if meta.get("id") and not caminho.name.startswith(meta["id"] + "-"):
        erros.append("nome do arquivo deve começar com o id do controle")

    titulos = re.findall(r"^## (.+)$", texto, re.M)
    for secao in SECOES:
        if secao not in titulos:
            erros.append(f"seção ausente: {secao}")
    if PRIORIDADE.get((meta.get("impacto"), meta.get("esforco"))) is None and not erros:
        erros.append("combinação de impacto e esforço fora do filtro 80/20")
    return meta, erros


def gerar_indice(controles):
    linhas = [
        "# Índice do catálogo",
        "",
        "<!-- Gerado por scripts/catalogo.py. Não edite manualmente. -->",
        "",
        "Controles do LateralShield para tecnologias Red Hat. "
        "A prioridade segue o filtro 80/20 da [metodologia](../docs/metodologia.md).",
        "",
    ]
    for tec, (nome, _) in TECNOLOGIAS.items():
        itens = sorted((c for c in controles if c[0]["tecnologia"] == tec), key=lambda c: c[0]["id"])
        linhas += [f"## {nome}", ""]
        if not itens:
            linhas += ["Nenhum controle publicado ainda.", ""]
            continue
        linhas += [
            "| Controle | Título | Pilar | Impacto | Esforço | Prioridade | Status |",
            "|---|---|---|---|---|---|---|",
        ]
        for meta, caminho in itens:
            prioridade = PRIORIDADE[(meta["impacto"], meta["esforco"])]
            link = caminho.relative_to(CATALOGO).as_posix()
            linhas.append(
                f"| [{meta['id']}]({link}) | {meta['titulo']} | {meta['pilar']} | "
                f"{meta['impacto']} | {meta['esforco']} | {prioridade} | {meta['status']} |"
            )
        linhas.append("")
    return "\n".join(linhas)


def main():
    controles, falhou, ids = [], False, {}
    for caminho in sorted(CATALOGO.glob("*/*.md")):
        meta, erros = ler_controle(caminho)
        if meta and meta.get("id") in ids:
            erros.append(f"id duplicado (também em {ids[meta['id']]})")
        for erro in erros:
            falhou = True
            print(f"ERRO {caminho.relative_to(RAIZ)}: {erro}")
        if meta and not erros:
            ids[meta["id"]] = caminho.name
            controles.append((meta, caminho))
    if falhou:
        return 1

    indice = gerar_indice(controles)
    if "--check" in sys.argv:
        if not INDICE.exists() or INDICE.read_text(encoding="utf-8") != indice:
            print("ERRO catalogo/INDICE.md desatualizado: rode python3 scripts/catalogo.py")
            return 1
    else:
        INDICE.write_text(indice, encoding="utf-8")
    print(f"OK {len(controles)} controles válidos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
