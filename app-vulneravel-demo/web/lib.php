<?php

// ============================================================================
//  APLICAÇÃO DELIBERADAMENTE VULNERÁVEL — LateralShield · app-vulneravel-demo
// ----------------------------------------------------------------------------
//  Este código tem falhas DE PROPÓSITO. Ele existe só como alvo de teste, para
//  demonstrar o quanto a defesa do ambiente contém um componente invadido.
//
//  NÃO use em produção. NÃO exponha à internet. NÃO coloque dados reais.
//  Rode apenas em um laboratório isolado e descartável.
//
//  Cada ponto vulnerável está marcado com "VULNERÁVEL DE PROPÓSITO". Não
//  escreva código assim em uma aplicação de verdade.
// ============================================================================

declare(strict_types=1);

const AVD_AVISO = 'Aplicação deliberadamente vulnerável. Alvo de teste do LateralShield. Não use em produção, não exponha à internet e não coloque dados reais.';

function env(string $nome, string $padrao = ''): string
{
    $valor = getenv($nome);
    return ($valor === false || $valor === '') ? $padrao : $valor;
}

/** Conexão com o banco: MySQL quando AVD_DB_HOST está definido, SQLite no desenvolvimento local. */
function banco(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $host = env('AVD_DB_HOST');
    if ($host !== '') {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, env('AVD_DB_PORT', '3306'), env('AVD_DB_NAME', 'appvuln'));
        $pdo = new PDO($dsn, env('AVD_DB_USER', 'appvuln'), env('AVD_DB_PASSWORD', ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } else {
        $arquivo = env('AVD_SQLITE', sys_get_temp_dir() . '/app-vulneravel-demo.sqlite');
        $pdo = new PDO('sqlite:' . $arquivo, '', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
    bootstrap($pdo);
    return $pdo;
}

/** Cria as tabelas e carrega dados de exemplo na primeira execução. Todos os dados são fictícios. */
function bootstrap(PDO $pdo): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $id = 'id ' . ($sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY');
    $pdo->exec("CREATE TABLE IF NOT EXISTS usuarios ($id, usuario VARCHAR(64), senha VARCHAR(64), papel VARCHAR(16), email VARCHAR(128))");
    $pdo->exec("CREATE TABLE IF NOT EXISTS notas ($id, usuario_id INT, titulo VARCHAR(160), corpo TEXT, privada INT)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS segredos ($id, nome VARCHAR(80), valor VARCHAR(200), descricao VARCHAR(200))");

    if ((int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn() > 0) {
        return;
    }
    // Senhas guardadas em texto claro DE PROPÓSITO, e credenciais fracas, para a demonstração.
    $usuarios = [
        ['admin', 'admin', 'admin', 'admin@exemplo.com.br'],
        ['ana', 'ana123', 'usuario', 'ana@exemplo.com.br'],
        ['bruno', 'bruno2024', 'usuario', 'bruno@exemplo.com.br'],
    ];
    $ins = $pdo->prepare('INSERT INTO usuarios (usuario, senha, papel, email) VALUES (?, ?, ?, ?)');
    foreach ($usuarios as $u) {
        $ins->execute($u);
    }
    $notas = [
        [1, 'Acesso ao console', 'Lembrar de revisar quem tem acesso administrativo ao painel.', 0],
        [1, 'Credenciais de serviço', 'Usuário de relatórios e senha estão na aba Segredos.', 1],
        [2, 'Pendências da Ana', 'Fechar o chamado 192 sobre o relatório mensal.', 1],
        [3, 'Rascunho do Bruno', 'Anotações de teste do ambiente de homologação.', 1],
    ];
    $ins = $pdo->prepare('INSERT INTO notas (usuario_id, titulo, corpo, privada) VALUES (?, ?, ?, ?)');
    foreach ($notas as $n) {
        $ins->execute($n);
    }
    // Segredos fictícios, com valores das faixas de documentação, para ilustrar roubo de credenciais.
    $segredos = [
        ['banco_relatorios_usuario', 'relatorios', 'Usuário do banco de relatórios'],
        ['banco_relatorios_senha', 'troque-esta-senha', 'Senha do banco de relatórios (exemplo)'],
        ['chave_api_parceiro', 'exemplo-nao-use-0000', 'Chave de API de parceiro (exemplo)'],
        ['host_backup', '192.0.2.50', 'Servidor de backup acessível por SSH (exemplo)'],
    ];
    $ins = $pdo->prepare('INSERT INTO segredos (nome, valor, descricao) VALUES (?, ?, ?)');
    foreach ($segredos as $s) {
        $ins->execute($s);
    }
}

function sessao(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function usuario_atual(): ?array
{
    sessao();
    return $_SESSION['usuario'] ?? null;
}

function h(?string $texto): string
{
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}

/** Cabeçalho, aviso e menu comuns a todas as páginas. */
function layout(string $titulo, string $conteudo): string
{
    $u = usuario_atual();
    $nav = [
        'inicio' => 'Início',
        'notas' => 'Notas',
        'busca' => 'Busca',
        'diagnostico' => 'Diagnóstico',
        'abrir' => 'Abrir URL',
        'arquivos' => 'Arquivos',
    ];
    if ($u && ($u['papel'] ?? '') === 'admin') {
        $nav['admin'] = 'Administração';
    }
    $menu = '';
    foreach ($nav as $p => $rotulo) {
        $menu .= '<a href="?p=' . $p . '">' . h($rotulo) . '</a>';
    }
    $direita = $u
        ? '<span>' . h($u['usuario']) . ' · ' . h($u['papel']) . '</span> <a href="?p=sair">Sair</a>'
        : '<a href="?p=login">Entrar</a>';

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' . h($titulo) . ' · Demo vulnerável</title>'
        . '<style>'
        . 'body{font-family:system-ui,Arial,sans-serif;margin:0;color:#151515;background:#f5f5f5}'
        . '.aviso{background:#B30000;color:#fff;padding:8px 16px;font-size:13px;font-weight:700;text-align:center}'
        . 'header{background:#151515;color:#fff;display:flex;align-items:center;gap:4px;padding:10px 16px;flex-wrap:wrap}'
        . 'header b{font-size:16px;margin-right:14px}header a{color:#d2d2d2;text-decoration:none;padding:6px 10px;border-radius:6px;font-size:14px}'
        . 'header a:hover{background:#2a2a2a;color:#fff}header .dir{margin-left:auto;font-size:13px;color:#b9c4ce}header .dir a{color:#ff8a8a}'
        . 'main{max-width:900px;margin:22px auto;padding:0 16px}h1{font-size:24px}h2{font-size:18px;margin-top:26px}'
        . '.card{background:#fff;border:1px solid #d2d2d2;border-radius:10px;padding:16px 18px;margin:14px 0}'
        . 'input,textarea{font:inherit;padding:8px 10px;border:1px solid #c8c8c8;border-radius:6px;width:100%;box-sizing:border-box;margin:4px 0}'
        . 'textarea{min-height:90px}button,.btn{font:inherit;font-weight:700;background:#ee0000;color:#fff;border:0;border-radius:6px;padding:9px 16px;cursor:pointer;text-decoration:none;display:inline-block}'
        . 'table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #ececec;font-size:14px;vertical-align:top}'
        . 'pre{background:#151515;color:#eaeaea;padding:12px;border-radius:8px;overflow:auto;font-size:13px}label{font-size:13px;font-weight:700;color:#4a4a4a}'
        . '.erro{color:#B30000;font-weight:700}.muted{color:#8a8a8a;font-size:13px}'
        . '</style></head><body>'
        . '<div class="aviso">⚠ AMBIENTE DELIBERADAMENTE VULNERÁVEL — alvo de teste. Não use em produção nem exponha à internet.</div>'
        . '<header><b>Portal Interno</b>' . $menu . '<span class="dir">' . $direita . '</span></header>'
        . '<main>' . $conteudo . '</main></body></html>';
}
