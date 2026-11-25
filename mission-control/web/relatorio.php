<?php
// Mission Control do LateralShield: relatório da avaliação em PDF e em planilha.
//
// Os dois formatos são escritos diretamente, sem bibliotecas externas, para que
// a aplicação rode na imagem UBI de PHP sem etapa de build.
declare(strict_types=1);

const MC_ROTULOS = [
    'nao-avaliado' => 'Não avaliado',
    'exposto' => 'Exposto',
    'em-implantacao' => 'Em implantação',
    'aplicado' => 'Aplicado',
    'nao-se-aplica' => 'Não se aplica',
    'sem-resposta' => 'Sem resposta',
    'sim' => 'Sim',
    'parcial' => 'Parcial',
    'nao' => 'Não',
    'pendente' => 'Pendente',
    'em-andamento' => 'Em andamento',
    'feito' => 'Feito',
];
const MC_CORES = [
    'exposto' => [0.70, 0, 0],
    'nao' => [0.70, 0, 0],
    'em-implantacao' => [0.11, 0.37, 0.66],
    'parcial' => [0.60, 0.42, 0],
    'aplicado' => [0.10, 0.48, 0.46],
    'sim' => [0.10, 0.48, 0.46],
];
const MC_AVISO = 'Os controles do catálogo estão em rascunho: foram escritos a partir de documentação e experiência de campo e ainda não passaram por validação em laboratório. Este relatório mostra onde o ambiente é mais frágil: guarde-o com acesso restrito.';

/** Remove a marcação Markdown de um texto curto. */
function sem_markdown(string $texto): string
{
    $texto = (string) preg_replace('/\[([^\]]+)\]\([^)]*\)/', '$1', $texto);
    return str_replace(['**', '`'], '', $texto);
}

function data_br(string $iso): string
{
    return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $iso, $m) ? "$m[3]/$m[2]/$m[1]" : '';
}

/** Junta o catálogo com as respostas e calcula contagens e plano de ação. */
function montar_relatorio(array $dados, array $estado): array
{
    $itens = $estado['itens'] ?? [];
    $hoje = gmdate('Y-m-d');
    $vazio = ['responsavel' => '', 'prazo' => '', 'nota' => '', 'atualizado_em' => ''];
    $tecnologias = array_column($dados['tecnologias'], 'nome', 'id');

    $r = [
        'meta' => ($estado['meta'] ?? []) + ['organizacao' => '', 'ambiente' => '', 'responsavel' => '', 'inicio' => '', 'observacoes' => ''],
        'gerado_em' => gmdate('d/m/Y H:i') . ' UTC',
        'tecnologias' => $tecnologias,
        'controles' => [],
        'processos' => [],
        'crise' => [],
        'plano' => [],
        'logs' => [],
        'contagem' => ['controle' => [], 'processo' => [], 'tecnologia' => []],
    ];

    foreach ($dados['controles'] as $c) {
        $item = ($itens[$c['id']] ?? []) + ['status' => 'nao-avaliado'] + $vazio;
        $c['item'] = $item;
        $r['controles'][$c['id']] = $c;
        $r['contagem']['controle'][$item['status']] = ($r['contagem']['controle'][$item['status']] ?? 0) + 1;
        $r['contagem']['tecnologia'][$c['tecnologia']][$item['status']] = ($r['contagem']['tecnologia'][$c['tecnologia']][$item['status']] ?? 0) + 1;
        if (in_array($item['status'], ['exposto', 'em-implantacao'], true)) {
            $r['plano'][] = [
                'id' => $c['id'], 'descricao' => $c['titulo'], 'status' => $item['status'], 'prioridade' => $c['prioridade'],
                'responsavel' => $item['responsavel'], 'prazo' => $item['prazo'], 'nota' => $item['nota'],
                'vencido' => $item['prazo'] !== '' && $item['prazo'] < $hoje,
            ];
        }
    }
    usort($r['plano'], fn ($a, $b) => [$a['prioridade'], $a['id']] <=> [$b['prioridade'], $b['id']]);

    foreach ($dados['processos']['blocos'] as $bloco) {
        foreach ($bloco['perguntas'] as $p) {
            $item = ($itens[$p['id']] ?? []) + ['status' => 'sem-resposta'] + $vazio;
            $p['bloco'] = $bloco['nome'];
            $p['item'] = $item;
            $r['processos'][] = $p;
            $r['contagem']['processo'][$item['status']] = ($r['contagem']['processo'][$item['status']] ?? 0) + 1;
            if (in_array($item['status'], ['nao', 'parcial'], true)) {
                $r['plano'][] = [
                    'id' => 'Pergunta ' . $p['n'], 'descricao' => $p['pergunta'], 'status' => $item['status'], 'prioridade' => '',
                    'responsavel' => $item['responsavel'], 'prazo' => $item['prazo'], 'nota' => $item['nota'],
                    'vencido' => $item['prazo'] !== '' && $item['prazo'] < $hoje,
                ];
            }
        }
    }

    foreach ($dados['crise']['secoes'] ?? [] as $secao) {
        foreach ($secao['itens'] as $k) {
            $k['secao'] = $secao['nome'];
            $k['item'] = ($itens[$k['id']] ?? []) + ['status' => 'pendente'] + $vazio;
            $r['crise'][] = $k;
        }
    }

    foreach ($dados['logs'] as $log) {
        $c = $r['controles'][$log['id']] ?? null;
        if ($c) {
            $r['logs'][] = ['camada' => $log['camada'], 'id' => $c['id'], 'titulo' => $c['titulo'], 'status' => $c['item']['status']];
        }
    }
    return $r;
}

// ----------------------------------------------------------------------- PDF

/** Escritor mínimo de PDF: A4, Helvetica, texto com quebra de linha e tabelas. */
final class Pdf
{
    private const LARGURA = 595.28;
    private const ALTURA = 841.89;
    public const MARGEM = 40.0;
    public const UTIL = 515.28;
    // Larguras da Helvetica para os caracteres 32 a 126, em milésimos do corpo.
    private const LARGURAS = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
        1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
        667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
        333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
        556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
    ];

    /** @var string[] */
    private array $paginas = [''];
    private float $y = self::MARGEM;

    public function __construct(private string $rodape)
    {
    }

    private static function cp1252(string $texto): string
    {
        $texto = strtr($texto, ['→' => '->', '≥' => '>=', '≤' => '<=', "\u{00A0}" => ' ', "\t" => ' ', "\r" => '']);
        return (string) mb_convert_encoding($texto, 'Windows-1252', 'UTF-8');
    }

    private static function largura(string $cp, float $corpo, bool $negrito): float
    {
        $soma = 0;
        for ($i = 0, $n = strlen($cp); $i < $n; $i++) {
            $o = ord($cp[$i]);
            if ($o >= 32 && $o <= 126) {
                $soma += self::LARGURAS[$o - 32];
            } elseif ($o >= 0xEC && $o <= 0xEF) {
                $soma += 278;
            } elseif ($o >= 0xC0 && $o <= 0xDE) {
                $soma += 700;
            } elseif ($o === 0x97) {
                $soma += 1000;
            } else {
                $soma += 556;
            }
        }
        return $soma * $corpo / 1000 * ($negrito ? 1.07 : 1.0);
    }

    /** Quebra um texto (já em CP1252) em linhas que cabem na largura dada. */
    private static function quebrar(string $cp, float $largura, float $corpo, bool $negrito): array
    {
        $linhas = [];
        foreach (explode("\n", $cp) as $paragrafo) {
            $atual = '';
            foreach (explode(' ', $paragrafo) as $palavra) {
                while (self::largura($palavra, $corpo, $negrito) > $largura && strlen($palavra) > 1) {
                    // Palavra maior que a coluna (um caminho, por exemplo): corta por caracteres.
                    $corte = strlen($palavra) - 1;
                    while ($corte > 1 && self::largura(substr($palavra, 0, $corte), $corpo, $negrito) > $largura) {
                        $corte--;
                    }
                    if ($atual !== '') {
                        $linhas[] = $atual;
                        $atual = '';
                    }
                    $linhas[] = substr($palavra, 0, $corte);
                    $palavra = substr($palavra, $corte);
                }
                $tentativa = $atual === '' ? $palavra : "$atual $palavra";
                if ($atual !== '' && self::largura($tentativa, $corpo, $negrito) > $largura) {
                    $linhas[] = $atual;
                    $atual = $palavra;
                } else {
                    $atual = $tentativa;
                }
            }
            $linhas[] = $atual;
        }
        return $linhas;
    }

    private function escrever(string $operadores): void
    {
        $this->paginas[count($this->paginas) - 1] .= $operadores;
    }

    private function texto(float $x, float $y, string $cp, float $corpo, bool $negrito, array $cor): void
    {
        $cp = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $cp);
        $this->escrever(sprintf(
            "BT /F%d %.2F Tf %.3F %.3F %.3F rg %.2F %.2F Td (%s) Tj ET\n",
            $negrito ? 2 : 1,
            $corpo,
            $cor[0],
            $cor[1],
            $cor[2],
            $x,
            self::ALTURA - $y,
            $cp
        ));
    }

    private function retangulo(float $x, float $y, float $l, float $a, array $cor): void
    {
        $this->escrever(sprintf("%.3F %.3F %.3F rg %.2F %.2F %.2F %.2F re f\n", $cor[0], $cor[1], $cor[2], $x, self::ALTURA - $y - $a, $l, $a));
    }

    public function novaPagina(): void
    {
        $this->paginas[] = '';
        $this->y = self::MARGEM;
    }

    /** Garante espaço vertical; abre nova página quando não cabe. Devolve true se abriu. */
    public function reservar(float $altura): bool
    {
        if ($this->y + $altura > self::ALTURA - self::MARGEM - 18) {
            $this->novaPagina();
            return true;
        }
        return false;
    }

    public function espaco(float $altura): void
    {
        $this->y += $altura;
    }

    public function paragrafo(string $texto, float $corpo = 9.0, bool $negrito = false, array $cor = [0.08, 0.08, 0.08], float $largura = self::UTIL): void
    {
        $entrelinha = $corpo * 1.38;
        foreach (self::quebrar(self::cp1252($texto), $largura, $corpo, $negrito) as $linha) {
            $this->reservar($entrelinha);
            $this->texto(self::MARGEM, $this->y + $corpo, $linha, $corpo, $negrito, $cor);
            $this->y += $entrelinha;
        }
    }

    public function titulo(string $texto, int $nivel = 2): void
    {
        if ($nivel === 1) {
            $this->paragrafo($texto, 20, true);
            $this->y += 4;
            return;
        }
        $this->reservar(60);
        $this->y += 12;
        $this->paragrafo($texto, 12.5, true);
        $this->retangulo(self::MARGEM, $this->y + 1, 36, 2.2, [0.93, 0, 0]);
        $this->y += 10;
    }

    /**
     * Desenha uma tabela. Cada célula é um texto ou ['t' => texto, 'cor' => [r, g, b], 'negrito' => bool].
     * O cabeçalho é repetido quando a tabela continua em outra página.
     */
    public function tabela(array $larguras, array $cabecalho, array $linhas, float $corpo = 7.8): void
    {
        $entrelinha = $corpo * 1.32;
        $folga = 4.0;
        $rotulos = [];
        foreach ($cabecalho as $i => $rotulo) {
            $rotulos[] = self::quebrar(self::cp1252(mb_strtoupper($rotulo)), $larguras[$i] - 6, $corpo - 1.2, true);
        }
        $desenharCabecalho = function () use ($larguras, $rotulos, $corpo, $entrelinha, $folga): void {
            $altura = max(array_map('count', $rotulos)) * $entrelinha + 2 * $folga;
            $this->retangulo(self::MARGEM, $this->y, array_sum($larguras), $altura, [0.93, 0.93, 0.93]);
            $x = self::MARGEM;
            foreach ($rotulos as $i => $linhasDoRotulo) {
                foreach ($linhasDoRotulo as $n => $texto) {
                    $this->texto($x + 3, $this->y + $folga + $corpo - 0.5 + $n * $entrelinha, $texto, $corpo - 1.2, true, [0.35, 0.35, 0.35]);
                }
                $x += $larguras[$i];
            }
            $this->y += $altura;
        };
        $this->reservar(60);
        $desenharCabecalho();
        foreach ($linhas as $linha) {
            $celulas = [];
            $maior = 1;
            foreach ($linha as $i => $celula) {
                $celula = is_array($celula) ? $celula : ['t' => (string) $celula];
                $negrito = $celula['negrito'] ?? false;
                $quebradas = array_slice(self::quebrar(self::cp1252($celula['t']), $larguras[$i] - 6, $corpo, $negrito), 0, 60);
                $maior = max($maior, count($quebradas));
                $celulas[] = [$quebradas, $negrito, $celula['cor'] ?? [0.08, 0.08, 0.08]];
            }
            $altura = $maior * $entrelinha + 2 * $folga;
            if ($this->reservar($altura)) {
                $desenharCabecalho();
            }
            $x = self::MARGEM;
            foreach ($celulas as $i => [$quebradas, $negrito, $cor]) {
                foreach ($quebradas as $n => $texto) {
                    $this->texto($x + 3, $this->y + $folga + $corpo - 0.5 + $n * $entrelinha, $texto, $corpo, $negrito, $cor);
                }
                $x += $larguras[$i];
            }
            $this->y += $altura;
            $this->retangulo(self::MARGEM, $this->y - 0.4, array_sum($larguras), 0.4, [0.85, 0.85, 0.85]);
        }
        $this->y += 6;
    }

    public function saida(string $titulo): string
    {
        $total = count($this->paginas);
        $objetos = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            4 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
            5 => '<< /Title (' . str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], self::cp1252($titulo)) . ') /Producer (LateralShield Mission Control) >>',
        ];
        $filhos = [];
        foreach ($this->paginas as $i => $conteudo) {
            $this->paginas = [$conteudo];
            $rodape = self::cp1252($this->rodape . ' · Página ' . ($i + 1) . ' de ' . $total);
            $this->texto(self::MARGEM, self::ALTURA - 26, $rodape, 7.5, false, [0.45, 0.45, 0.45]);
            $fluxo = (string) gzcompress($this->paginas[0]);
            $pagina = 6 + 2 * $i;
            $filhos[] = "$pagina 0 R";
            $objetos[$pagina] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>',
                self::LARGURA,
                self::ALTURA,
                $pagina + 1
            );
            $objetos[$pagina + 1] = '<< /Length ' . strlen($fluxo) . " /Filter /FlateDecode >>\nstream\n" . $fluxo . "\nendstream";
        }
        $objetos[2] = '<< /Type /Pages /Kids [' . implode(' ', $filhos) . "] /Count $total >>";
        ksort($objetos);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $posicoes = [];
        foreach ($objetos as $numero => $corpo) {
            $posicoes[$numero] = strlen($pdf);
            $pdf .= "$numero 0 obj\n$corpo\nendobj\n";
        }
        $inicioXref = strlen($pdf);
        $quantidade = max(array_keys($objetos)) + 1;
        $pdf .= "xref\n0 $quantidade\n0000000000 65535 f \n";
        for ($n = 1; $n < $quantidade; $n++) {
            $pdf .= sprintf("%010d 00000 n \n", $posicoes[$n]);
        }
        return $pdf . "trailer\n<< /Size $quantidade /Root 1 0 R /Info 5 0 R >>\nstartxref\n$inicioXref\n%%EOF\n";
    }
}

function celula_status(string $status): array
{
    return ['t' => MC_ROTULOS[$status] ?? $status, 'cor' => MC_CORES[$status] ?? [0.35, 0.35, 0.35], 'negrito' => isset(MC_CORES[$status])];
}

function celula_prazo(string $prazo, bool $vencido = false): array
{
    return ['t' => data_br($prazo) . ($vencido ? ' (vencido)' : ''), 'cor' => $vencido ? [0.70, 0, 0] : [0.08, 0.08, 0.08], 'negrito' => $vencido];
}

function com_nota(string $texto, string $nota): string
{
    return $nota === '' ? $texto : $texto . "\nObs.: " . $nota;
}

function relatorio_pdf(array $r): string
{
    $meta = $r['meta'];
    $nome = trim($meta['organizacao'] . ($meta['ambiente'] !== '' ? ' · ' . $meta['ambiente'] : ''), ' ·');
    $pdf = new Pdf('LateralShield · Relatório de avaliação' . ($nome !== '' ? ' · ' . $nome : '') . ' · ' . $r['gerado_em']);
    $cinza = [0.35, 0.35, 0.35];

    $pdf->paragrafo('LATERALSHIELD · MISSION CONTROL', 8, true, [0.93, 0, 0]);
    $pdf->espaco(4);
    $pdf->titulo('Relatório de avaliação', 1);
    foreach ([['Organização', $meta['organizacao']], ['Ambiente', $meta['ambiente']], ['Responsável pela avaliação', $meta['responsavel']], ['Início da avaliação', data_br($meta['inicio'])], ['Relatório gerado em', $r['gerado_em']]] as [$rotulo, $valor]) {
        if ($valor !== '') {
            $pdf->paragrafo("$rotulo: $valor", 9.5);
        }
    }
    if ($meta['observacoes'] !== '') {
        $pdf->espaco(4);
        $pdf->paragrafo($meta['observacoes'], 9, false, $cinza);
    }
    $pdf->espaco(8);
    $pdf->paragrafo(MC_AVISO, 8.2, false, $cinza);

    // Resumo
    $pdf->titulo('Resumo');
    $cc = $r['contagem']['controle'];
    $total = count($r['controles']);
    $avaliados = $total - ($cc['nao-avaliado'] ?? 0);
    $pdf->paragrafo(sprintf(
        'Controles avaliados: %d de %d. Expostos: %d. Em implantação: %d. Aplicados: %d. Não se aplicam: %d.',
        $avaliados,
        $total,
        $cc['exposto'] ?? 0,
        $cc['em-implantacao'] ?? 0,
        $cc['aplicado'] ?? 0,
        $cc['nao-se-aplica'] ?? 0
    ));
    $cp = $r['contagem']['processo'];
    $pdf->paragrafo(sprintf(
        'Perguntas de processo: %d com resposta "sim", %d "parcial", %d "não" e %d sem resposta. As respostas não são somadas: cada lacuna é tratada separadamente.',
        $cp['sim'] ?? 0,
        $cp['parcial'] ?? 0,
        $cp['nao'] ?? 0,
        $cp['sem-resposta'] ?? 0
    ));
    $pdf->espaco(6);
    $linhas = [];
    foreach ($r['tecnologias'] as $id => $nomeTec) {
        $t = $r['contagem']['tecnologia'][$id] ?? [];
        $linhas[] = [$nomeTec, (string) array_sum($t), (string) ($t['nao-avaliado'] ?? 0), (string) ($t['exposto'] ?? 0), (string) ($t['em-implantacao'] ?? 0), (string) ($t['aplicado'] ?? 0), (string) ($t['nao-se-aplica'] ?? 0)];
    }
    $pdf->tabela([155.28, 60, 60, 60, 60, 60, 60], ['Tecnologia', 'Controles', 'Não avaliados', 'Expostos', 'Em implantação', 'Aplicados', 'Não se aplicam'], $linhas);

    // Primeira verificação
    $pdf->titulo('Primeira verificação: os logs saem do servidor?');
    $pdf->paragrafo('Sem um destino central de logs, os alertas dos demais controles não chegam a ninguém, e o invasor pode apagar os registros do host invadido.', 8.5, false, $cinza);
    $pdf->espaco(4);
    $pdf->tabela(
        [150, 60, 225.28, 80],
        ['Camada', 'Controle', 'Título', 'Situação'],
        array_map(fn ($l) => [$l['camada'], $l['id'], $l['titulo'], celula_status($l['status'])], $r['logs'])
    );

    // Plano de ação
    $pdf->titulo('Plano de ação');
    if (!$r['plano']) {
        $pdf->paragrafo('Nenhuma lacuna registrada até o momento.', 9, false, $cinza);
    } else {
        $pdf->paragrafo('Controles expostos ou em implantação, por prioridade 80/20, e perguntas de processo com resposta "não" ou "parcial".', 8.5, false, $cinza);
        $pdf->espaco(4);
        $pdf->tabela(
            [62, 213.28, 70, 26, 90, 54],
            ['Item', 'Lacuna', 'Situação', 'Pri.', 'Responsável', 'Prazo'],
            array_map(fn ($p) => [
                ['t' => $p['id'], 'negrito' => true],
                com_nota($p['descricao'], $p['nota']),
                celula_status($p['status']),
                (string) $p['prioridade'],
                $p['responsavel'] !== '' ? $p['responsavel'] : ['t' => 'sem responsável', 'cor' => [0.70, 0, 0]],
                celula_prazo($p['prazo'], $p['vencido']),
            ], $r['plano'])
        );
    }

    // Controles por tecnologia
    foreach ($r['tecnologias'] as $id => $nomeTec) {
        $linhas = [];
        foreach ($r['controles'] as $c) {
            if ($c['tecnologia'] === $id) {
                $linhas[] = [
                    ['t' => $c['id'], 'negrito' => true],
                    com_nota($c['titulo'], $c['item']['nota']),
                    ucfirst($c['pilar']),
                    (string) $c['prioridade'],
                    celula_status($c['item']['status']),
                    $c['item']['responsavel'],
                    celula_prazo($c['item']['prazo']),
                ];
            }
        }
        if ($linhas) {
            $pdf->titulo('Controles · ' . $nomeTec);
            $pdf->tabela([60, 185.28, 46, 24, 66, 80, 54], ['Controle', 'Título', 'Pilar', 'Pri.', 'Situação', 'Responsável', 'Prazo'], $linhas);
        }
    }

    // Processos
    $pdf->titulo('Avaliação básica de processos');
    $pdf->paragrafo('Não há nota nem nível de maturidade. O resultado é a lista de lacunas, cada uma com responsável e prazo.', 8.5, false, $cinza);
    $pdf->espaco(4);
    $pdf->tabela(
        [20, 180.28, 62, 135, 68, 50],
        ['#', 'Pergunta', 'Resposta', 'Evidência e observações', 'Responsável', 'Prazo'],
        array_map(fn ($p) => [
            (string) $p['n'],
            $p['pergunta'],
            celula_status($p['item']['status']),
            $p['item']['nota'],
            $p['item']['responsavel'],
            celula_prazo($p['item']['prazo']),
        ], $r['processos'])
    );

    return $pdf->saida('LateralShield · Relatório de avaliação');
}

// ---------------------------------------------------------------------- XLSX

function xml(string $texto): string
{
    $texto = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $texto);
    return htmlspecialchars($texto, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function coluna_xlsx(int $indice): string
{
    $nome = '';
    for ($n = $indice + 1; $n > 0; $n = intdiv($n - 1, 26)) {
        $nome = chr(65 + ($n - 1) % 26) . $nome;
    }
    return $nome;
}

/**
 * Gera um arquivo .xlsx. Cada planilha: ['nome', 'larguras' => [...], 'linhas' => [[...]], 'filtro' => bool].
 * A primeira linha de cada planilha é o cabeçalho. Textos vão como texto literal, nunca como fórmula.
 */
function gerar_xlsx(array $planilhas): string
{
    $tipos = '';
    $relacoes = '';
    $lista = '';
    $arquivos = [];
    foreach ($planilhas as $i => $planilha) {
        $n = $i + 1;
        $tipos .= "<Override PartName=\"/xl/worksheets/sheet$n.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
        $relacoes .= "<Relationship Id=\"rId$n\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet$n.xml\"/>";
        $lista .= '<sheet name="' . xml($planilha['nome']) . "\" sheetId=\"$n\" r:id=\"rId$n\"/>";

        $colunas = '';
        foreach ($planilha['larguras'] as $c => $largura) {
            $colunas .= sprintf('<col min="%d" max="%d" width="%d" customWidth="1"/>', $c + 1, $c + 1, $largura);
        }
        $dados = '';
        foreach ($planilha['linhas'] as $l => $linha) {
            $dados .= '<row r="' . ($l + 1) . '">';
            foreach ($linha as $c => $valor) {
                $ref = coluna_xlsx($c) . ($l + 1);
                $estilo = $l === 0 ? 1 : 2;
                if (is_int($valor)) {
                    $dados .= "<c r=\"$ref\" s=\"$estilo\"><v>$valor</v></c>";
                } elseif ((string) $valor !== '') {
                    $dados .= "<c r=\"$ref\" s=\"$estilo\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" . xml((string) $valor) . '</t></is></c>';
                }
            }
            $dados .= '</row>';
        }
        $ultima = coluna_xlsx(count($planilha['larguras']) - 1) . max(1, count($planilha['linhas']));
        $filtro = ($planilha['filtro'] ?? false) ? "<autoFilter ref=\"A1:$ultima\"/>" : '';
        $arquivos["xl/worksheets/sheet$n.xml"] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . "<cols>$colunas</cols><sheetData>$dados</sheetData>$filtro</worksheet>";
    }

    $arquivos['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . $tipos . '</Types>';
    $arquivos['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';
    $arquivos['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . "<sheets>$lista</sheets></workbook>";
    $arquivos['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . $relacoes
        . '<Relationship Id="rId' . (count($planilhas) + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . '</Relationships>';
    // Estilos: 0 padrão, 1 cabeçalho (negrito, fundo cinza), 2 célula com quebra de linha.
    $arquivos['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        . '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
        . '<fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        . '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';

    $temporario = (string) tempnam(sys_get_temp_dir(), 'mcx');
    $zip = new ZipArchive();
    $zip->open($temporario, ZipArchive::OVERWRITE);
    foreach (['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml'] as $nome) {
        $zip->addFromString($nome, $arquivos[$nome]);
        unset($arquivos[$nome]);
    }
    foreach ($arquivos as $nome => $conteudo) {
        $zip->addFromString($nome, $conteudo);
    }
    $zip->close();
    $bytes = (string) file_get_contents($temporario);
    unlink($temporario);
    return $bytes;
}

function relatorio_xlsx(array $r): string
{
    $meta = $r['meta'];
    $cc = $r['contagem']['controle'];
    $cp = $r['contagem']['processo'];

    $resumo = [
        ['Campo', 'Valor'],
        ['Organização', $meta['organizacao']],
        ['Ambiente', $meta['ambiente']],
        ['Responsável pela avaliação', $meta['responsavel']],
        ['Início da avaliação', data_br($meta['inicio'])],
        ['Relatório gerado em', $r['gerado_em']],
        ['Observações', $meta['observacoes']],
        ['Controles no catálogo', count($r['controles'])],
    ];
    foreach (['nao-avaliado', 'exposto', 'em-implantacao', 'aplicado', 'nao-se-aplica'] as $status) {
        $resumo[] = ['Controles: ' . MC_ROTULOS[$status], $cc[$status] ?? 0];
    }
    foreach (['sim', 'parcial', 'nao', 'sem-resposta'] as $status) {
        $resumo[] = ['Processos: ' . MC_ROTULOS[$status], $cp[$status] ?? 0];
    }
    $resumo[] = ['Aviso', MC_AVISO];

    $controles = [['Controle', 'Título', 'Tecnologia', 'Pilar', 'Impacto', 'Esforço', 'Prioridade', 'Situação no ambiente', 'Responsável', 'Prazo', 'Evidência e observações', 'Atualizado em (UTC)', 'Status no catálogo']];
    foreach ($r['controles'] as $c) {
        $controles[] = [
            $c['id'], $c['titulo'], $r['tecnologias'][$c['tecnologia']], $c['pilar'], $c['impacto'], $c['esforco'], (int) $c['prioridade'],
            MC_ROTULOS[$c['item']['status']], $c['item']['responsavel'], data_br($c['item']['prazo']), $c['item']['nota'], $c['item']['atualizado_em'], $c['status'],
        ];
    }

    $processos = [['#', 'Bloco', 'Pergunta', 'O que conta como "sim"', 'Resposta', 'Evidência e observações', 'Responsável', 'Prazo', 'Atualizado em (UTC)']];
    foreach ($r['processos'] as $p) {
        $processos[] = [
            (int) $p['n'], $p['bloco'], $p['pergunta'], sem_markdown($p['sim']), MC_ROTULOS[$p['item']['status']],
            $p['item']['nota'], $p['item']['responsavel'], data_br($p['item']['prazo']), $p['item']['atualizado_em'],
        ];
    }

    $crise = [['#', 'Seção', 'Verificação', 'O que registrar', 'Situação', 'Registro', 'Responsável', 'Prazo', 'Atualizado em (UTC)']];
    foreach ($r['crise'] as $k) {
        $crise[] = [
            (int) $k['n'], $k['secao'], sem_markdown($k['verificacao']), sem_markdown($k['registrar']), MC_ROTULOS[$k['item']['status']],
            $k['item']['nota'], $k['item']['responsavel'], data_br($k['item']['prazo']), $k['item']['atualizado_em'],
        ];
    }

    $plano = [['Item', 'Lacuna', 'Situação', 'Prioridade', 'Responsável', 'Prazo', 'Vencido', 'Evidência e observações']];
    foreach ($r['plano'] as $p) {
        $plano[] = [$p['id'], $p['descricao'], MC_ROTULOS[$p['status']], $p['prioridade'], $p['responsavel'], data_br($p['prazo']), $p['vencido'] ? 'sim' : '', $p['nota']];
    }

    return gerar_xlsx([
        ['nome' => 'Resumo', 'larguras' => [34, 90], 'linhas' => $resumo],
        ['nome' => 'Plano de ação', 'larguras' => [14, 60, 18, 11, 26, 12, 10, 60], 'linhas' => $plano, 'filtro' => true],
        ['nome' => 'Controles', 'larguras' => [14, 56, 30, 11, 10, 10, 11, 20, 26, 12, 60, 20, 16], 'linhas' => $controles, 'filtro' => true],
        ['nome' => 'Processos', 'larguras' => [5, 24, 56, 44, 14, 60, 26, 12, 20], 'linhas' => $processos, 'filtro' => true],
        ['nome' => 'Guia de crise', 'larguras' => [5, 28, 56, 50, 14, 60, 26, 12, 20], 'linhas' => $crise, 'filtro' => true],
    ]);
}
