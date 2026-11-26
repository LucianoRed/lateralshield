#!/usr/bin/env python3
"""Gera o manifesto do app-vulneravel-demo.

Embute o código de app-vulneravel-demo/web/ em um ConfigMap e junta ao
openshift/base.yaml, produzindo o manifesto pronto para "oc apply".

Uso:
    python3 scripts/app_vulneravel.py           gera o manifesto
    python3 scripts/app_vulneravel.py --check    falha se estiver desatualizado

A aplicação é deliberadamente vulnerável e serve só como alvo de teste em
laboratório. Veja app-vulneravel-demo/README.md.
"""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / "app-vulneravel-demo"
WEB = APP / "web"
BASE = APP / "openshift" / "base.yaml"
MANIFESTO = APP / "openshift" / "app-vulneravel-demo.yaml"

ARQUIVOS = ["index.php", "lib.php", ".htaccess", "arquivos/leia-me.txt", "arquivos/politica.txt"]
NOME_CONFIGMAP = "app-vulneravel-web"
# Um ConfigMap aplicado com "oc apply" guarda uma cópia de si mesmo em uma anotação
# limitada a 262144 bytes. O manifesto é recusado se o código passar deste limite.
LIMITE_CONFIGMAP = 200_000


def falhar(mensagem):
    print(f"ERRO {mensagem}")
    sys.exit(1)


def bloco_yaml(nome, conteudo, recuo="    "):
    """Devolve o conteúdo como bloco literal YAML ('|')."""
    if "\t" in conteudo:
        falhar(f"web/{nome}: contém tabulação; use espaços")
    if not conteudo.endswith("\n") or conteudo.endswith("\n\n"):
        falhar(f"web/{nome}: o arquivo deve terminar com exatamente uma quebra de linha")
    linhas = conteudo[:-1].split("\n")
    for n, linha in enumerate(linhas, 1):
        if linha != linha.rstrip():
            falhar(f"web/{nome}:{n}: espaço no fim da linha")
    return "\n".join(recuo + linha if linha else "" for linha in linhas) + "\n"


def nome_chave(arquivo):
    """Chave do ConfigMap: o subdiretório vira parte do nome (arquivos/x.txt -> arquivos-x.txt)."""
    return arquivo.replace("/", "-")


def gerar_manifesto():
    base = BASE.read_text(encoding="utf-8")
    if not base.endswith("\n"):
        base += "\n"
    # O volume do Deployment precisa mapear cada chave do ConfigMap ao seu caminho.
    for arquivo in ARQUIVOS:
        if f"key: {nome_chave(arquivo)}" not in base or f"path: {arquivo}" not in base:
            falhar(f"base.yaml não mapeia o arquivo web/{arquivo} no volume 'codigo'")
    cm = (
        "---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n"
        f"  name: {NOME_CONFIGMAP}\n  namespace: app-vulneravel-demo\n"
        "  labels:\n    app.kubernetes.io/part-of: app-vulneravel-demo\ndata:\n"
    )
    tamanho = 0
    for arquivo in ARQUIVOS:
        conteudo = (WEB / arquivo).read_text(encoding="utf-8")
        tamanho += len(conteudo.encode("utf-8"))
        cm += f"  {nome_chave(arquivo)}: |\n" + bloco_yaml(arquivo, conteudo)
    if tamanho > LIMITE_CONFIGMAP:
        falhar(f"ConfigMap com {tamanho} bytes: acima de {LIMITE_CONFIGMAP}")
    cabecalho = (
        "# GERADO por scripts/app_vulneravel.py. Não edite manualmente.\n"
        "# Fontes: app-vulneravel-demo/openshift/base.yaml e app-vulneravel-demo/web/.\n"
        "#\n"
        "# ATENÇÃO: aplicação deliberadamente vulnerável. Só para laboratório isolado.\n"
        "#\n"
        "#   oc new-project app-vulneravel-demo\n"
        "#   oc apply -f https://raw.githubusercontent.com/LucianoRed/lateralshield/main/app-vulneravel-demo/openshift/app-vulneravel-demo.yaml\n"
    )
    return cabecalho + base + cm


def main():
    texto = gerar_manifesto()
    if "--check" in sys.argv:
        if not MANIFESTO.exists() or MANIFESTO.read_text(encoding="utf-8") != texto:
            print(f"ERRO {MANIFESTO.relative_to(RAIZ)} desatualizado: rode python3 scripts/app_vulneravel.py")
            return 1
    else:
        MANIFESTO.write_text(texto, encoding="utf-8")
    print("OK app-vulneravel-demo: manifesto gerado a partir de web/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
