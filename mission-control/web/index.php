<?php
// Mission Control do LateralShield: autenticação, API e relatórios.
//
// Todas as requisições passam por este arquivo (ver .htaccess). Ele exige
// autenticação Basic, entrega a página e guarda as respostas no banco:
// MySQL quando MC_DB_HOST está definido, SQLite em arquivo nos demais casos.
//
// Execução local, sem contêiner:  php -S 127.0.0.1:8080 index.php
declare(strict_types=1);

require __DIR__ . '/relatorio.php';

const MC_STATUS = [
    'controle' => ['nao-avaliado', 'exposto', 'em-implantacao', 'aplicado', 'nao-se-aplica'],
    'processo' => ['sem-resposta', 'sim', 'parcial', 'nao'],
    'crise' => ['pendente', 'em-andamento', 'feito', 'nao-se-aplica'],
];
const MC_META = ['organizacao' => 200, 'ambiente' => 200, 'responsavel' => 200, 'inicio' => 10, 'observacoes' => 2000];
const MC_SENHA_MINIMA = 10;

function env(string $nome, string $padrao = ''): string
{
    $valor = getenv($nome);
    return ($valor === false || $valor === '') ? $padrao : $valor;
}

function responder(int $codigo, array $corpo, array $cabecalhos = []): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($cabecalhos as $cabecalho) {
        header($cabecalho);
    }
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function erro(int $codigo, string $mensagem, string $chave = 'erro'): never
{
    responder($codigo, ['erro' => $chave, 'mensagem' => $mensagem]);
}

/** Catálogo, perguntas e recomendações: o mesmo data.js usado pela página. */
function dados(): array
{
    static $dados = null;
    if ($dados === null) {
        $js = (string) file_get_contents(__DIR__ . '/data.js');
        $inicio = strpos($js, '{');
        $fim = strrpos($js, '}');
        $dados = json_decode(substr($js, (int) $inicio, $fim - $inicio + 1), true);
        if (!is_array($dados)) {
            erro(500, 'data.js ilegível.');
        }
    }
    return $dados;
}

/** Devolve [id => 'controle' | 'processo'] de todos os itens avaliáveis. */
function tipos_de_item(): array
{
    static $tipos = null;
    if ($tipos === null) {
        $tipos = [];
        foreach (dados()['controles'] as $c) {
            $tipos[$c['id']] = 'controle';
        }
        foreach (dados()['processos']['blocos'] as $bloco) {
            foreach ($bloco['perguntas'] as $p) {
                $tipos[$p['id']] = 'processo';
            }
        }
        foreach (dados()['crise']['secoes'] ?? [] as $secao) {
            foreach ($secao['itens'] as $k) {
                $tipos[$k['id']] = 'crise';
            }
        }
    }
    return $tipos;
}

function banco(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $opcoes = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
    $host = env('MC_DB_HOST');
    if ($host !== '') {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $host,
            env('MC_DB_PORT', '3306'),
            env('MC_DB_NAME', 'missioncontrol')
        );
        $pdo = new PDO($dsn, env('MC_DB_USER', 'missioncontrol'), env('MC_DB_PASSWORD'), $opcoes + [PDO::ATTR_TIMEOUT => 5]);
        $sufixo = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    } else {
        $pdo = new PDO('sqlite:' . env('MC_SQLITE', sys_get_temp_dir() . '/lateralshield-mission-control.sqlite'), null, null, $opcoes);
        $sufixo = '';
    }
    try {
        $pdo->query('SELECT 1 FROM mc_meta LIMIT 1');
    } catch (PDOException $e) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS mc_usuario (usuario VARCHAR(64) NOT NULL PRIMARY KEY, hash VARCHAR(255) NOT NULL, deve_trocar INTEGER NOT NULL, atualizado_em VARCHAR(19) NOT NULL)' . $sufixo);
        $pdo->exec('CREATE TABLE IF NOT EXISTS mc_item (id VARCHAR(40) NOT NULL PRIMARY KEY, status VARCHAR(20) NOT NULL, responsavel VARCHAR(200) NOT NULL, prazo VARCHAR(10) NOT NULL, nota TEXT NOT NULL, atualizado_em VARCHAR(19) NOT NULL, atualizado_por VARCHAR(64) NOT NULL)' . $sufixo);
        $pdo->exec('CREATE TABLE IF NOT EXISTS mc_meta (chave VARCHAR(40) NOT NULL PRIMARY KEY, valor TEXT NOT NULL)' . $sufixo);
    }
    return $pdo;
}

function agora(): string
{
    return gmdate('Y-m-d H:i:s');
}

/** Cria o usuário inicial na primeira execução. A troca de senha é exigida no primeiro acesso. */
function semear_usuario(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM mc_usuario')->fetchColumn() > 0) {
        return;
    }
    try {
        $pdo->prepare('INSERT INTO mc_usuario (usuario, hash, deve_trocar, atualizado_em) VALUES (?, ?, 1, ?)')
            ->execute([env('MC_ADMIN_USUARIO', 'admin'), password_hash(env('MC_ADMIN_SENHA_INICIAL', 'redhat'), PASSWORD_DEFAULT), agora()]);
    } catch (PDOException $e) {
        // Outra requisição criou o usuário ao mesmo tempo.
    }
}

function credenciais(): ?array
{
    if (isset($_SERVER['PHP_AUTH_USER'])) {
        return [(string) $_SERVER['PHP_AUTH_USER'], (string) ($_SERVER['PHP_AUTH_PW'] ?? '')];
    }
    $cabecalho = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (stripos($cabecalho, 'Basic ') === 0) {
        $par = base64_decode(substr($cabecalho, 6), true);
        if ($par !== false && str_contains($par, ':')) {
            return explode(':', $par, 2);
        }
    }
    return null;
}

function pedir_credenciais(): never
{
    responder(401, ['erro' => 'nao_autenticado', 'mensagem' => 'Informe usuário e senha.'], ['WWW-Authenticate: Basic realm="LateralShield Mission Control", charset="UTF-8"']);
}

function autenticar(PDO $pdo): array
{
    semear_usuario($pdo);
    $par = credenciais();
    if ($par === null) {
        pedir_credenciais();
    }
    $consulta = $pdo->prepare('SELECT usuario, hash, deve_trocar FROM mc_usuario WHERE usuario = ?');
    $consulta->execute([$par[0]]);
    $usuario = $consulta->fetch();
    if (!$usuario || !password_verify($par[1], $usuario['hash'])) {
        usleep(700000); // atrasa tentativas de adivinhação
        pedir_credenciais();
    }
    return ['usuario' => $usuario['usuario'], 'deve_trocar' => (bool) $usuario['deve_trocar'], 'senha' => $par[1]];
}

function corpo_json(): array
{
    $corpo = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($corpo)) {
        erro(400, 'Corpo da requisição não é um JSON válido.');
    }
    return $corpo;
}

function texto(mixed $valor, int $maximo): string
{
    $texto = is_scalar($valor) ? trim((string) $valor) : '';
    $texto = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $texto);
    return mb_substr($texto, 0, $maximo);
}

function data_ou_vazio(mixed $valor): string
{
    $texto = is_string($valor) ? trim($valor) : '';
    if ($texto === '') {
        return '';
    }
    $data = DateTime::createFromFormat('!Y-m-d', $texto);
    if (!$data || $data->format('Y-m-d') !== $texto) {
        erro(400, 'Data inválida: use o formato AAAA-MM-DD.');
    }
    return $texto;
}

/** Valida os campos de um item e devolve o registro pronto para gravar. */
function validar_item(string $id, array $entrada): array
{
    $tipo = tipos_de_item()[$id] ?? null;
    if ($tipo === null) {
        erro(404, "Item desconhecido: $id");
    }
    $status = $entrada['status'] ?? MC_STATUS[$tipo][0];
    if (!in_array($status, MC_STATUS[$tipo], true)) {
        erro(400, "Situação inválida para $id.");
    }
    return [
        'status' => $status,
        'responsavel' => texto($entrada['responsavel'] ?? '', 200),
        'prazo' => data_ou_vazio($entrada['prazo'] ?? ''),
        'nota' => texto($entrada['nota'] ?? '', 4000),
    ];
}

function gravar_item(PDO $pdo, string $id, array $item, string $usuario): array
{
    $item += ['atualizado_em' => agora(), 'atualizado_por' => $usuario];
    $pdo->prepare('REPLACE INTO mc_item (id, status, responsavel, prazo, nota, atualizado_em, atualizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, $item['status'], $item['responsavel'], $item['prazo'], $item['nota'], $item['atualizado_em'], $item['atualizado_por']]);
    return $item;
}

function validar_meta(array $entrada): array
{
    $meta = [];
    foreach (MC_META as $chave => $maximo) {
        if (array_key_exists($chave, $entrada)) {
            $meta[$chave] = $chave === 'inicio' ? data_ou_vazio($entrada[$chave]) : texto($entrada[$chave], $maximo);
        }
    }
    return $meta;
}

function gravar_meta(PDO $pdo, array $meta): void
{
    $gravar = $pdo->prepare('REPLACE INTO mc_meta (chave, valor) VALUES (?, ?)');
    foreach ($meta as $chave => $valor) {
        $gravar->execute([$chave, $valor]);
    }
}

function estado(PDO $pdo): array
{
    $meta = [];
    foreach ($pdo->query('SELECT chave, valor FROM mc_meta') as $linha) {
        $meta[$linha['chave']] = $linha['valor'];
    }
    $itens = [];
    $tipos = tipos_de_item();
    foreach ($pdo->query('SELECT * FROM mc_item') as $linha) {
        if (isset($tipos[$linha['id']])) {
            $id = $linha['id'];
            unset($linha['id']);
            $itens[$id] = $linha;
        }
    }
    return ['meta' => (object) $meta, 'itens' => (object) $itens];
}

function entregar_arquivo(string $nome, string $tipo): never
{
    header("Content-Type: $tipo");
    header('Cache-Control: no-cache');
    if ($tipo === 'text/html; charset=utf-8') {
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'");
    }
    readfile(__DIR__ . '/' . $nome);
    exit;
}

function entregar_download(string $conteudo, string $tipo, string $nome): never
{
    header("Content-Type: $tipo");
    header("Content-Disposition: attachment; filename=\"$nome\"");
    header('Content-Length: ' . strlen($conteudo));
    header('Cache-Control: no-store');
    echo $conteudo;
    exit;
}

// ---------------------------------------------------------------- roteamento

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rota = '/' . trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');

try {
    if ($rota === '/healthz') {
        banco()->query('SELECT 1');
        responder(200, ['ok' => true]);
    }

    $pdo = banco();
    $sessao = autenticar($pdo);

    // Requisições que alteram dados precisam do cabeçalho abaixo: um site de
    // terceiros não consegue enviá-lo, o que impede requisições forjadas.
    if ($metodo !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'LateralShield') {
        erro(403, 'Cabeçalho X-Requested-With ausente.');
    }

    if ($metodo === 'GET' && ($rota === '/' || $rota === '/index.html')) {
        entregar_arquivo('index.html', 'text/html; charset=utf-8');
    }
    if ($metodo === 'GET' && $rota === '/data.js') {
        entregar_arquivo('data.js', 'application/javascript; charset=utf-8');
    }

    if ($metodo === 'POST' && $rota === '/api/senha') {
        $corpo = corpo_json();
        $nova = is_string($corpo['nova'] ?? null) ? $corpo['nova'] : '';
        if (!is_string($corpo['atual'] ?? null) || !hash_equals($sessao['senha'], $corpo['atual'])) {
            erro(400, 'A senha atual não confere.');
        }
        if (mb_strlen($nova) < MC_SENHA_MINIMA) {
            erro(400, 'A nova senha precisa ter pelo menos ' . MC_SENHA_MINIMA . ' caracteres.');
        }
        if ($nova === $sessao['senha'] || $nova === $sessao['usuario'] || $nova === env('MC_ADMIN_SENHA_INICIAL', 'redhat')) {
            erro(400, 'Escolha uma senha diferente da atual, da inicial e do nome de usuário.');
        }
        $pdo->prepare('UPDATE mc_usuario SET hash = ?, deve_trocar = 0, atualizado_em = ? WHERE usuario = ?')
            ->execute([password_hash($nova, PASSWORD_DEFAULT), agora(), $sessao['usuario']]);
        responder(200, ['ok' => true]);
    }

    if ($sessao['deve_trocar']) {
        if ($metodo === 'GET' && $rota === '/api/estado') {
            responder(200, ['usuario' => $sessao['usuario'], 'deve_trocar' => true, 'senha_minima' => MC_SENHA_MINIMA]);
        }
        erro(403, 'Troque a senha inicial antes de continuar.', 'trocar_senha');
    }

    if ($metodo === 'GET' && $rota === '/api/estado') {
        responder(200, estado($pdo) + ['usuario' => $sessao['usuario'], 'deve_trocar' => false, 'senha_minima' => MC_SENHA_MINIMA]);
    }

    if ($metodo === 'PUT' && preg_match('#^/api/item/([A-Z]+(?:-[A-Z0-9]+)+)$#', $rota, $m)) {
        $item = gravar_item($pdo, $m[1], validar_item($m[1], corpo_json()), $sessao['usuario']);
        responder(200, ['id' => $m[1], 'item' => $item]);
    }

    if ($metodo === 'PUT' && $rota === '/api/meta') {
        gravar_meta($pdo, validar_meta(corpo_json()));
        responder(200, ['meta' => estado($pdo)['meta']]);
    }

    if ($metodo === 'POST' && $rota === '/api/importar') {
        $corpo = corpo_json();
        if (!is_array($corpo['itens'] ?? null)) {
            erro(400, 'Arquivo sem a chave "itens": não parece uma exportação do Mission Control.');
        }
        $itens = [];
        $ignorados = 0;
        foreach ($corpo['itens'] as $id => $entrada) {
            if (!isset(tipos_de_item()[$id]) || !is_array($entrada)) {
                $ignorados++;
                continue;
            }
            $itens[$id] = validar_item((string) $id, $entrada);
        }
        $meta = validar_meta(is_array($corpo['meta'] ?? null) ? $corpo['meta'] : []);
        $pdo->beginTransaction();
        $pdo->exec('DELETE FROM mc_item');
        $pdo->exec('DELETE FROM mc_meta');
        foreach ($itens as $id => $item) {
            gravar_item($pdo, $id, $item, $sessao['usuario']);
        }
        gravar_meta($pdo, $meta);
        $pdo->commit();
        responder(200, ['importados' => count($itens), 'ignorados' => $ignorados]);
    }

    if ($metodo === 'GET' && $rota === '/api/exportar.json') {
        $saida = ['formato' => 'lateralshield-mission-control', 'versao' => 1, 'exportado_em' => agora()] + estado($pdo);
        entregar_download(
            (string) json_encode($saida, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            'application/json; charset=utf-8',
            'lateralshield-avaliacao-' . gmdate('Y-m-d') . '.json'
        );
    }

    if ($metodo === 'GET' && ($rota === '/api/relatorio.pdf' || $rota === '/api/relatorio.xlsx')) {
        $relatorio = montar_relatorio(dados(), json_decode((string) json_encode(estado($pdo)), true));
        if ($rota === '/api/relatorio.pdf') {
            entregar_download(relatorio_pdf($relatorio), 'application/pdf', 'lateralshield-relatorio-' . gmdate('Y-m-d') . '.pdf');
        }
        entregar_download(
            relatorio_xlsx($relatorio),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'lateralshield-relatorio-' . gmdate('Y-m-d') . '.xlsx'
        );
    }

    erro(404, 'Caminho não encontrado.');
} catch (PDOException $e) {
    error_log('Mission Control: erro de banco: ' . $e->getMessage());
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    erro(503, 'Banco de dados indisponível.', 'banco');
}
