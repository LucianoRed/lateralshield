<?php

// APLICAÇÃO DELIBERADAMENTE VULNERÁVEL — LateralShield · app-vulneravel-demo
// Controlador único. As falhas são propositais; veja o cabeçalho de lib.php.
// Execução local, sem contêiner:  php -S 127.0.0.1:8080 index.php

declare(strict_types=1);

require __DIR__ . '/lib.php';
sessao();

// Endpoint de saúde, sem autenticação, para a sonda do OpenShift.
if (($_GET['p'] ?? '') === 'healthz') {
    header('Content-Type: text/plain');
    echo "ok\n";
    exit;
}

$pagina = (string) ($_GET['p'] ?? 'inicio');
$u = usuario_atual();

// A maioria das páginas exige "login". A autenticação é fraca de propósito.
$abertas = ['inicio', 'login', 'sair'];
if (!$u && !in_array($pagina, $abertas, true)) {
    $pagina = 'login';
}

switch ($pagina) {

    case 'login':
        $erro = '';
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $usuario = (string) ($_POST['usuario'] ?? '');
            $senha = (string) ($_POST['senha'] ?? '');
            // VULNERÁVEL DE PROPÓSITO: injeção de SQL. A consulta concatena a entrada do usuário.
            $sql = "SELECT * FROM usuarios WHERE usuario = '$usuario' AND senha = '$senha'";
            try {
                $linha = banco()->query($sql)->fetch(PDO::FETCH_ASSOC);
            } catch (Throwable $e) {
                $linha = false;
                $erro = 'Erro na consulta: ' . $e->getMessage(); // VULNERÁVEL: devolve o erro do banco.
            }
            if ($linha) {
                $_SESSION['usuario'] = ['id' => (int) $linha['id'], 'usuario' => $linha['usuario'], 'papel' => $linha['papel']];
                header('Location: ?p=inicio');
                exit;
            }
            if ($erro === '') {
                $erro = 'Usuário ou senha inválidos.';
            }
        }
        $corpo = '<h1>Entrar</h1><div class="card"><form method="post">'
            . ($erro ? '<p class="erro">' . h($erro) . '</p>' : '')
            . '<label>Usuário</label><input name="usuario" autofocus>'
            . '<label>Senha</label><input name="senha" type="password">'
            . '<p><button type="submit">Entrar</button></p>'
            . '<p class="muted">Acesso de demonstração: <code>admin</code> / <code>admin</code>.</p></form></div>';
        echo layout('Entrar', $corpo);
        break;

    case 'sair':
        $_SESSION = [];
        session_destroy();
        header('Location: ?p=inicio');
        break;

    case 'inicio':
        $corpo = '<h1>Portal Interno</h1>'
            . '<div class="card"><p>' . h(AVD_AVISO) . '</p>'
            . '<p class="muted">Este portal reúne notas, uma busca, ferramentas de rede e arquivos. '
            . 'Serve para demonstrar, em laboratório, até onde um invasor chega a partir de uma aplicação web comprometida '
            . 'e o quanto os controles do LateralShield contêm esse avanço.</p></div>';
        if ($u) {
            $corpo .= '<div class="card"><p>Autenticado como <b>' . h($u['usuario']) . '</b> (' . h($u['papel']) . ').</p>'
                . '<p><a class="btn" href="?p=notas">Minhas notas</a></p></div>';
        } else {
            $corpo .= '<div class="card"><p><a class="btn" href="?p=login">Entrar</a></p></div>';
        }
        echo layout('Início', $corpo);
        break;

    case 'notas':
        // Criação de nota.
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['titulo'])) {
            $ins = banco()->prepare('INSERT INTO notas (usuario_id, titulo, corpo, privada) VALUES (?, ?, ?, ?)');
            $ins->execute([(int) $u['id'], (string) $_POST['titulo'], (string) ($_POST['corpo'] ?? ''), 1]);
            header('Location: ?p=notas');
            exit;
        }
        $corpo = '<h1>Notas</h1>';
        if (isset($_GET['id'])) {
            // VULNERÁVEL DE PROPÓSITO: IDOR + injeção de SQL. Sem checar o dono e concatenando o id.
            $id = (string) $_GET['id'];
            $nota = banco()->query("SELECT * FROM notas WHERE id = $id")->fetch(PDO::FETCH_ASSOC);
            if ($nota) {
                // VULNERÁVEL DE PROPÓSITO: XSS armazenado. O conteúdo é impresso sem escapar.
                $corpo .= '<div class="card"><h2>' . $nota['titulo'] . '</h2><p>' . $nota['corpo'] . '</p>'
                    . '<p class="muted">Nota #' . h((string) $nota['id']) . ' · dono ' . h((string) $nota['usuario_id']) . '</p>'
                    . '<p><a href="?p=notas">Voltar</a></p></div>';
            } else {
                $corpo .= '<p>Nota não encontrada.</p>';
            }
        } else {
            $minhas = banco()->query('SELECT id, titulo FROM notas WHERE usuario_id = ' . (int) $u['id'])->fetchAll(PDO::FETCH_ASSOC);
            $corpo .= '<div class="card"><table><tr><th>#</th><th>Título</th></tr>';
            foreach ($minhas as $n) {
                $corpo .= '<tr><td>' . h((string) $n['id']) . '</td><td><a href="?p=notas&id=' . h((string) $n['id']) . '">' . h($n['titulo']) . '</a></td></tr>';
            }
            $corpo .= '</table></div>'
                . '<div class="card"><h2>Nova nota</h2><form method="post">'
                . '<label>Título</label><input name="titulo">'
                . '<label>Conteúdo</label><textarea name="corpo"></textarea>'
                . '<p><button type="submit">Salvar</button></p></form></div>';
        }
        echo layout('Notas', $corpo);
        break;

    case 'busca':
        $q = (string) ($_GET['q'] ?? '');
        $corpo = '<h1>Busca de notas</h1><div class="card"><form method="get">'
            . '<input type="hidden" name="p" value="busca">'
            // VULNERÁVEL DE PROPÓSITO: XSS refletido. O termo volta para a página sem escapar.
            . '<label>Termo</label><input name="q" value="' . $q . '">'
            . '<p><button type="submit">Buscar</button></p></form></div>';
        if ($q !== '') {
            // VULNERÁVEL DE PROPÓSITO: injeção de SQL no filtro de busca.
            $sql = "SELECT id, titulo, corpo FROM notas WHERE titulo LIKE '%$q%' OR corpo LIKE '%$q%'";
            $corpo .= '<div class="card"><p>Resultados para <b>' . $q . '</b>:</p><table><tr><th>#</th><th>Título</th></tr>';
            try {
                foreach (banco()->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $n) {
                    $corpo .= '<tr><td>' . h((string) $n['id']) . '</td><td><a href="?p=notas&id=' . h((string) $n['id']) . '">' . h($n['titulo']) . '</a></td></tr>';
                }
            } catch (Throwable $e) {
                $corpo .= '<tr><td colspan="2" class="erro">' . h($e->getMessage()) . '</td></tr>';
            }
            $corpo .= '</table></div>';
        }
        echo layout('Busca', $corpo);
        break;

    case 'diagnostico':
        $host = (string) ($_GET['host'] ?? '');
        $saida = '';
        if ($host !== '') {
            // VULNERÁVEL DE PROPÓSITO: injeção de comando. A entrada vai direto para o shell.
            $saida = (string) shell_exec('ping -c 1 -W 1 ' . $host . ' 2>&1');
        }
        $corpo = '<h1>Diagnóstico de rede</h1><div class="card"><form method="get">'
            . '<input type="hidden" name="p" value="diagnostico">'
            . '<label>Host para testar (ping)</label><input name="host" value="' . h($host) . '" placeholder="192.0.2.10">'
            . '<p><button type="submit">Testar</button></p></form>'
            . ($saida !== '' ? '<pre>' . h($saida) . '</pre>' : '') . '</div>';
        echo layout('Diagnóstico', $corpo);
        break;

    case 'abrir':
        $url = (string) ($_GET['url'] ?? '');
        $conteudo = '';
        if ($url !== '') {
            // VULNERÁVEL DE PROPÓSITO: SSRF. Busca qualquer URL informada pelo usuário.
            try {
                $conteudo = (string) @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 4]]));
            } catch (Throwable $e) {
                $conteudo = 'Erro: ' . $e->getMessage();
            }
        }
        $corpo = '<h1>Abrir URL</h1><div class="card"><p class="muted">Pré-visualiza o conteúdo de um endereço.</p><form method="get">'
            . '<input type="hidden" name="p" value="abrir">'
            . '<label>URL</label><input name="url" value="' . h($url) . '" placeholder="http://servico-interno.exemplo.com.br">'
            . '<p><button type="submit">Abrir</button></p></form>'
            . ($url !== '' ? '<pre>' . h(substr($conteudo, 0, 4000)) . '</pre>' : '') . '</div>';
        echo layout('Abrir URL', $corpo);
        break;

    case 'arquivos':
        $nome = (string) ($_GET['nome'] ?? '');
        $corpo = '<h1>Arquivos</h1><div class="card"><p class="muted">Documentos disponíveis para download.</p>'
            . '<ul><li><a href="?p=arquivos&nome=leia-me.txt">leia-me.txt</a></li>'
            . '<li><a href="?p=arquivos&nome=politica.txt">politica.txt</a></li></ul></div>';
        if ($nome !== '') {
            // VULNERÁVEL DE PROPÓSITO: travessia de caminho. O nome é concatenado sem normalizar.
            $caminho = __DIR__ . '/arquivos/' . $nome;
            if (is_file($caminho)) {
                $corpo .= '<div class="card"><h2>' . h($nome) . '</h2><pre>' . h((string) file_get_contents($caminho)) . '</pre></div>';
            } else {
                $corpo .= '<div class="card"><p class="erro">Arquivo não encontrado: ' . h($nome) . '</p></div>';
            }
        }
        echo layout('Arquivos', $corpo);
        break;

    case 'admin':
        // VULNERÁVEL DE PROPÓSITO: controle de acesso quebrado. Um parâmetro na URL contorna a checagem de papel.
        $pode = ($u && ($u['papel'] ?? '') === 'admin') || isset($_GET['acesso']);
        if (!$pode) {
            echo layout('Administração', '<h1>Administração</h1><p class="erro">Acesso restrito.</p>');
            break;
        }
        $corpo = '<h1>Administração</h1>';
        $corpo .= '<div class="card"><h2>Usuários</h2><table><tr><th>ID</th><th>Usuário</th><th>Senha</th><th>Papel</th><th>E-mail</th></tr>';
        foreach (banco()->query('SELECT * FROM usuarios')->fetchAll(PDO::FETCH_ASSOC) as $x) {
            $corpo .= '<tr><td>' . h((string) $x['id']) . '</td><td>' . h($x['usuario']) . '</td><td>' . h($x['senha']) . '</td><td>' . h($x['papel']) . '</td><td>' . h($x['email']) . '</td></tr>';
        }
        $corpo .= '</table></div><div class="card"><h2>Segredos</h2><table><tr><th>Nome</th><th>Valor</th><th>Descrição</th></tr>';
        foreach (banco()->query('SELECT * FROM segredos')->fetchAll(PDO::FETCH_ASSOC) as $x) {
            $corpo .= '<tr><td>' . h($x['nome']) . '</td><td>' . h($x['valor']) . '</td><td>' . h($x['descricao']) . '</td></tr>';
        }
        $corpo .= '</table></div>';
        // VULNERÁVEL DE PROPÓSITO: vazamento de ambiente. Expõe as credenciais do banco e o caminho do token da service account.
        $corpo .= '<div class="card"><h2>Diagnóstico do ambiente</h2><pre>';
        foreach (['AVD_DB_HOST', 'AVD_DB_PORT', 'AVD_DB_NAME', 'AVD_DB_USER', 'AVD_DB_PASSWORD', 'HOSTNAME'] as $k) {
            $corpo .= h($k) . '=' . h(env($k)) . "\n";
        }
        $corpo .= '</pre></div>';
        echo layout('Administração', $corpo);
        break;

    default:
        http_response_code(404);
        echo layout('Não encontrado', '<h1>Página não encontrada</h1><p><a href="?p=inicio">Início</a></p>');
}
