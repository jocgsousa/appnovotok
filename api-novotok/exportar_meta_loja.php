<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit();
}

// Long running ops
set_time_limit(300);
ini_set('memory_limit', '256M');

// Ensure clean buffer
ob_start();

require 'database.php';
require 'jwt_utils.php';

// Check PhpSpreadsheet
if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) {
    ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode([
        'success' => false,
        'message' => 'PhpSpreadsheet não está instalado. Execute: composer require phpoffice/phpspreadsheet'
    ]);
    exit();
}

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Font;

// Auth
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit();
}

// Params
$meta_id = isset($_GET['id']) ? trim($_GET['id']) : null;
if (!$meta_id) {
    ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Parâmetro id é obrigatório']);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();

    // Helpers de estilo (consistentes com demais relatórios)
    function aplicarEstiloCabecalho($sheet, $range, $backgroundColor = 'FF4A90E2') {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 12],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $backgroundColor]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']]]
        ]);
    }
    function aplicarEstiloDados($sheet, $range) {
        $sheet->getStyle($range)->applyFromArray([
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CCCCCC']]]
        ]);
    }
    function aplicarEstiloTitulo($sheet, $range) {
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FF2C3E50']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']]]
        ]);
    }

    // Buscar meta principal
    $sqlMeta = "SELECT 
                    ml.id,
                    ml.loja_id,
                    ml.nome_loja,
                    ml.mes,
                    ml.ano,
                    ml.grupo_meta_id,
                    ml.valor_venda_loja_total,
                    gm.nome as grupo_meta_nome,
                    gm.descricao as grupo_meta_descricao,
                    ml.ativo,
                    ml.data_criacao
                FROM metas_lojas ml
                LEFT JOIN grupos_metas_produtos gm ON ml.grupo_meta_id = gm.id
                WHERE ml.id = ?";
    $stmtMeta = $conn->prepare($sqlMeta);
    $stmtMeta->bindValue(1, $meta_id);
    $stmtMeta->execute();
    $meta = $stmtMeta->fetch(PDO::FETCH_ASSOC);
    if (!$meta) {
        throw new Exception('Meta não encontrada');
    }

    // Função para buscar metas de produtos
    function buscarMetasProdutos($conn, $meta_id, $funcionario_id, $tipo_funcionario) {
        $sql = "SELECT id, nome_produto_marca, qtd_meta, qtd_vendido, percentual_sobre_venda, valor_vendido, valor_comissao 
                FROM meta_loja_produtos 
                WHERE meta_loja_id = ? AND funcionario_id = ? AND tipo_funcionario = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(1, $meta_id);
        $stmt->bindValue(2, $funcionario_id);
        $stmt->bindValue(3, $tipo_funcionario);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Carregar subseções
    $operadoras = [];
    $stmt = $conn->prepare("SELECT id, nome, funcao, cadastros_positivados, produtos_destaque FROM meta_loja_operadoras_caixa WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    while ($op = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $op['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $op['id'], 'operadora_caixa');
        $operadoras[] = $op;
    }

    $vendedoras = [];
    $stmt = $conn->prepare("SELECT id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, bijou_make_bolsas FROM meta_loja_vendedoras WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    while ($vend = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $vend['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $vend['id'], 'vendedora');
        $vendedoras[] = $vend;
    }

    $vendedoras_bijou = [];
    $stmt = $conn->prepare("SELECT id, nome, funcao, bijou_make_bolsas, percentual_comissao_bijou, valor_comissao_bijou FROM meta_loja_vendedoras_bijou WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    while ($vb = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $vb['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $vb['id'], 'vendedora_bijou');
        $vendedoras_bijou[] = $vb;
    }

    $stmt = $conn->prepare("SELECT id, nome, funcao, percentual_meta_geral, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, bijou_make_bolsas FROM meta_loja_gerente WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    $gerente = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($gerente) {
        $gerente['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $gerente['id'], 'gerente');
    }

    $campanhas = [];
    $stmt = $conn->prepare("SELECT id, nome, descricao, quantidade_vendida, atingiu_meta FROM meta_loja_campanhas WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    $campanhas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $funcionarios = [];
    $stmt = $conn->prepare("SELECT id, nome, funcao FROM meta_loja_funcionarios WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    while ($f = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $f['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $f['id'], 'funcionario');
        $funcionarios[] = $f;
    }

    // Criar planilha
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Meta da Loja');
    $currentRow = 1;

    // Título principal
    $titulo = 'META DA LOJA - ' . $meta['nome_loja'] . ' - ' . sprintf('%02d', (int)$meta['mes']) . '/' . $meta['ano'];
    $sheet->setCellValue('A1', $titulo);
    $sheet->mergeCells('A1:J1');
    $sheet->getRowDimension(1)->setRowHeight(28);
    aplicarEstiloTitulo($sheet, 'A1:J1');
    $currentRow = 2;

    // Informações gerais
    $sheet->setCellValue('A' . $currentRow, 'Loja ID');
    $sheet->setCellValue('B' . $currentRow, 'Loja');
    $sheet->setCellValue('C' . $currentRow, 'Mês');
    $sheet->setCellValue('D' . $currentRow, 'Ano');
    $sheet->setCellValue('E' . $currentRow, 'Grupo Meta ID');
    $sheet->setCellValue('F' . $currentRow, 'Grupo Meta Nome');
    $sheet->setCellValue('G' . $currentRow, 'Data Criação');
    $sheet->setCellValue('H' . $currentRow, 'Ativo');
    $sheet->setCellValue('I' . $currentRow, 'Valor Venda Loja Total');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':I' . $currentRow);
    $currentRow++;

    $sheet->setCellValue('A' . $currentRow, $meta['loja_id']);
    $sheet->setCellValue('B' . $currentRow, $meta['nome_loja']);
    $sheet->setCellValue('C' . $currentRow, (int)$meta['mes']);
    $sheet->setCellValue('D' . $currentRow, (int)$meta['ano']);
    $sheet->setCellValue('E' . $currentRow, $meta['grupo_meta_id']);
    $sheet->setCellValue('F' . $currentRow, $meta['grupo_meta_nome']);
    $sheet->setCellValue('G' . $currentRow, $meta['data_criacao']);
    $sheet->setCellValue('H' . $currentRow, ((int)$meta['ativo']) ? 'SIM' : 'NÃO');
    $sheet->setCellValue('I' . $currentRow, (float)$meta['valor_venda_loja_total']);
    aplicarEstiloDados($sheet, 'A' . $currentRow . ':I' . $currentRow);
    $currentRow += 2;

    // Seção: Operadoras de Caixa
    $sheet->setCellValue('A' . $currentRow, 'OPERADORAS DE CAIXA');
    $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF2ECC71');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Função');
    $sheet->setCellValue('C' . $currentRow, 'Cadastros Positivados');
    $sheet->setCellValue('D' . $currentRow, 'Produtos Destaque');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':D' . $currentRow);
    $currentRow++;
    foreach ($operadoras as $op) {
        $sheet->setCellValue('A' . $currentRow, $op['nome']);
        $sheet->setCellValue('B' . $currentRow, $op['funcao']);
        $sheet->setCellValue('C' . $currentRow, (int)$op['cadastros_positivados']);
        $sheet->setCellValue('D' . $currentRow, (int)$op['produtos_destaque']);
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':D' . $currentRow);
        $currentRow++;

        // Metas de produtos da operadora
        if (!empty($op['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos');
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca');
            $sheet->setCellValue('B' . $currentRow, 'Qtd Meta');
            $sheet->setCellValue('C' . $currentRow, 'Qtd Vendido');
            $sheet->setCellValue('D' . $currentRow, '% Sobre Venda');
            $sheet->setCellValue('E' . $currentRow, 'Valor Vendido');
            $sheet->setCellValue('F' . $currentRow, 'Valor Comissão');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow);
            $currentRow++;
            foreach ($op['metas_produtos'] as $mp) {
                $sheet->setCellValue('A' . $currentRow, $mp['nome_produto_marca']);
                $sheet->setCellValue('B' . $currentRow, (int)$mp['qtd_meta']);
                $sheet->setCellValue('C' . $currentRow, (int)$mp['qtd_vendido']);
                $sheet->setCellValue('D' . $currentRow, (float)$mp['percentual_sobre_venda']);
                $sheet->setCellValue('E' . $currentRow, (float)$mp['valor_vendido']);
                $sheet->setCellValue('F' . $currentRow, (float)$mp['valor_comissao']);
                aplicarEstiloDados($sheet, 'A' . $currentRow . ':F' . $currentRow);
                $currentRow++;
            }
        }
    }
    $currentRow++;

    // Seção: Vendedoras
    $sheet->setCellValue('A' . $currentRow, 'VENDEDORAS');
    $sheet->mergeCells('A' . $currentRow . ':G' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow, 'FF3498DB');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Função');
    $sheet->setCellValue('C' . $currentRow, 'Valor Vendido Total');
    $sheet->setCellValue('D' . $currentRow, 'Esmaltes');
    $sheet->setCellValue('E' . $currentRow, 'Profissional Parceiras');
    $sheet->setCellValue('F' . $currentRow, 'Valor Vendido Make');
    $sheet->setCellValue('G' . $currentRow, 'Bijou Make Bolsas');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow);
    $currentRow++;
    foreach ($vendedoras as $vend) {
        $sheet->setCellValue('A' . $currentRow, $vend['nome']);
        $sheet->setCellValue('B' . $currentRow, $vend['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$vend['valor_vendido_total']);
        $sheet->setCellValue('D' . $currentRow, (int)$vend['esmaltes']);
        $sheet->setCellValue('E' . $currentRow, (int)$vend['profissional_parceiras']);
        $sheet->setCellValue('F' . $currentRow, (float)$vend['valor_vendido_make']);
        $sheet->setCellValue('G' . $currentRow, (float)$vend['bijou_make_bolsas']);
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':G' . $currentRow);
        $currentRow++;

        // Metas de produtos da vendedora
        if (!empty($vend['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos');
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca');
            $sheet->setCellValue('B' . $currentRow, 'Qtd Meta');
            $sheet->setCellValue('C' . $currentRow, 'Qtd Vendido');
            $sheet->setCellValue('D' . $currentRow, '% Sobre Venda');
            $sheet->setCellValue('E' . $currentRow, 'Valor Vendido');
            $sheet->setCellValue('F' . $currentRow, 'Valor Comissão');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow);
            $currentRow++;
            foreach ($vend['metas_produtos'] as $mp) {
                $sheet->setCellValue('A' . $currentRow, $mp['nome_produto_marca']);
                $sheet->setCellValue('B' . $currentRow, (int)$mp['qtd_meta']);
                $sheet->setCellValue('C' . $currentRow, (int)$mp['qtd_vendido']);
                $sheet->setCellValue('D' . $currentRow, (float)$mp['percentual_sobre_venda']);
                $sheet->setCellValue('E' . $currentRow, (float)$mp['valor_vendido']);
                $sheet->setCellValue('F' . $currentRow, (float)$mp['valor_comissao']);
                aplicarEstiloDados($sheet, 'A' . $currentRow . ':F' . $currentRow);
                $currentRow++;
            }
        }
    }
    $currentRow++;

    // Seção: Vendedoras Bijou
    $sheet->setCellValue('A' . $currentRow, 'VENDEDORAS BIJOU');
    $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':D' . $currentRow, 'FF9B59B6');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Função');
    $sheet->setCellValue('C' . $currentRow, 'Bijou Make Bolsas');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    foreach ($vendedoras_bijou as $vb) {
        $sheet->setCellValue('A' . $currentRow, $vb['nome']);
        $sheet->setCellValue('B' . $currentRow, $vb['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$vb['bijou_make_bolsas']);
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':C' . $currentRow);
        $currentRow++;

        if (!empty($vb['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos');
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca');
            $sheet->setCellValue('B' . $currentRow, 'Qtd Meta');
            $sheet->setCellValue('C' . $currentRow, 'Qtd Vendido');
            $sheet->setCellValue('D' . $currentRow, '% Sobre Venda');
            $sheet->setCellValue('E' . $currentRow, 'Valor Vendido');
            $sheet->setCellValue('F' . $currentRow, 'Valor Comissão');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow);
            $currentRow++;
            foreach ($vb['metas_produtos'] as $mp) {
                $sheet->setCellValue('A' . $currentRow, $mp['nome_produto_marca']);
                $sheet->setCellValue('B' . $currentRow, (int)$mp['qtd_meta']);
                $sheet->setCellValue('C' . $currentRow, (int)$mp['qtd_vendido']);
                $sheet->setCellValue('D' . $currentRow, (float)$mp['percentual_sobre_venda']);
                $sheet->setCellValue('E' . $currentRow, (float)$mp['valor_vendido']);
                $sheet->setCellValue('F' . $currentRow, (float)$mp['valor_comissao']);
                aplicarEstiloDados($sheet, 'A' . $currentRow . ':F' . $currentRow);
                $currentRow++;
            }
        }
    }
    $currentRow++;

    // Seção: Gerente
    if ($gerente) {
        $sheet->setCellValue('A' . $currentRow, 'GERENTE');
        $sheet->mergeCells('A' . $currentRow . ':H' . $currentRow);
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':H' . $currentRow, 'FFE67E22');
        $currentRow++;
        $sheet->setCellValue('A' . $currentRow, 'Nome');
        $sheet->setCellValue('B' . $currentRow, 'Função');
        $sheet->setCellValue('C' . $currentRow, '% Meta Geral');
        $sheet->setCellValue('D' . $currentRow, 'Valor Vendido Total');
        $sheet->setCellValue('E' . $currentRow, 'Esmaltes');
        $sheet->setCellValue('F' . $currentRow, 'Profissional Parceiras');
        $sheet->setCellValue('G' . $currentRow, 'Valor Vendido Make');
        $sheet->setCellValue('H' . $currentRow, 'Bijou Make Bolsas');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':H' . $currentRow);
        $currentRow++;
        $sheet->setCellValue('A' . $currentRow, $gerente['nome']);
        $sheet->setCellValue('B' . $currentRow, $gerente['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$gerente['percentual_meta_geral']);
        $sheet->setCellValue('D' . $currentRow, (float)$gerente['valor_vendido_total']);
        $sheet->setCellValue('E' . $currentRow, (int)$gerente['esmaltes']);
        $sheet->setCellValue('F' . $currentRow, (int)$gerente['profissional_parceiras']);
        $sheet->setCellValue('G' . $currentRow, (float)$gerente['valor_vendido_make']);
        $sheet->setCellValue('H' . $currentRow, (float)$gerente['bijou_make_bolsas']);
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':H' . $currentRow);
        $currentRow++;

        // Metas de produtos do gerente
        if (!empty($gerente['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos');
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca');
            $sheet->setCellValue('B' . $currentRow, 'Qtd Meta');
            $sheet->setCellValue('C' . $currentRow, 'Qtd Vendido');
            $sheet->setCellValue('D' . $currentRow, '% Sobre Venda');
            $sheet->setCellValue('E' . $currentRow, 'Valor Vendido');
            $sheet->setCellValue('F' . $currentRow, 'Valor Comissão');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow);
            $currentRow++;
            foreach ($gerente['metas_produtos'] as $mp) {
                $sheet->setCellValue('A' . $currentRow, $mp['nome_produto_marca']);
                $sheet->setCellValue('B' . $currentRow, (int)$mp['qtd_meta']);
                $sheet->setCellValue('C' . $currentRow, (int)$mp['qtd_vendido']);
                $sheet->setCellValue('D' . $currentRow, (float)$mp['percentual_sobre_venda']);
                $sheet->setCellValue('E' . $currentRow, (float)$mp['valor_vendido']);
                $sheet->setCellValue('F' . $currentRow, (float)$mp['valor_comissao']);
                aplicarEstiloDados($sheet, 'A' . $currentRow . ':F' . $currentRow);
                $currentRow++;
            }
        }
    }
    $currentRow++;

    // Seção: Campanhas
    $sheet->setCellValue('A' . $currentRow, 'CAMPANHAS');
    $sheet->mergeCells('A' . $currentRow . ':E' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':E' . $currentRow, 'FF1ABC9C');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Descrição');
    $sheet->setCellValue('C' . $currentRow, 'Quantidade Vendida');
    $sheet->setCellValue('D' . $currentRow, 'Atingiu Meta');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':D' . $currentRow);
    $currentRow++;
    foreach ($campanhas as $c) {
        $sheet->setCellValue('A' . $currentRow, $c['nome']);
        $sheet->setCellValue('B' . $currentRow, $c['descricao']);
        $sheet->setCellValue('C' . $currentRow, isset($c['quantidade_vendida']) ? (float)$c['quantidade_vendida'] : 0.0);
        $sheet->setCellValue('D' . $currentRow, ((int)($c['atingiu_meta'] ?? 0)) ? 'SIM' : 'NÃO');
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':D' . $currentRow);
        $currentRow++;
    }
    $currentRow++;

    // Seção: Funcionários (genéricos)
    if (!empty($funcionarios)) {
        $sheet->setCellValue('A' . $currentRow, 'FUNCIONÁRIOS');
        $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF34495E');
        $currentRow++;
        $sheet->setCellValue('A' . $currentRow, 'Nome');
        $sheet->setCellValue('B' . $currentRow, 'Função');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':B' . $currentRow);
        $currentRow++;
        foreach ($funcionarios as $f) {
            $sheet->setCellValue('A' . $currentRow, $f['nome']);
            $sheet->setCellValue('B' . $currentRow, $f['funcao']);
            aplicarEstiloDados($sheet, 'A' . $currentRow . ':B' . $currentRow);
            $currentRow++;
            if (!empty($f['metas_produtos'])) {
                $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos');
                $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
                aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
                $currentRow++;
                $sheet->setCellValue('A' . $currentRow, 'Produto/Marca');
                $sheet->setCellValue('B' . $currentRow, 'Qtd Meta');
                $sheet->setCellValue('C' . $currentRow, 'Qtd Vendido');
                $sheet->setCellValue('D' . $currentRow, '% Sobre Venda');
                $sheet->setCellValue('E' . $currentRow, 'Valor Vendido');
                $sheet->setCellValue('F' . $currentRow, 'Valor Comissão');
                aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow);
                $currentRow++;
                foreach ($f['metas_produtos'] as $mp) {
                    $sheet->setCellValue('A' . $currentRow, $mp['nome_produto_marca']);
                    $sheet->setCellValue('B' . $currentRow, (int)$mp['qtd_meta']);
                    $sheet->setCellValue('C' . $currentRow, (int)$mp['qtd_vendido']);
                    $sheet->setCellValue('D' . $currentRow, (float)$mp['percentual_sobre_venda']);
                    $sheet->setCellValue('E' . $currentRow, (float)$mp['valor_vendido']);
                    $sheet->setCellValue('F' . $currentRow, (float)$mp['valor_comissao']);
                    aplicarEstiloDados($sheet, 'A' . $currentRow . ':F' . $currentRow);
                    $currentRow++;
                }
            }
        }
    }

    // Ajustar largura de colunas
    foreach (range('A', 'J') as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }

    // Salvar em arquivo temporário e enviar
    $writer = new Xlsx($spreadsheet);
    $temp_file = tempnam(sys_get_temp_dir(), 'meta_loja_');
    $writer->save($temp_file);

    // Nome do arquivo
    $nome_loja_sanitizado = preg_replace('/\s+/', '_', $meta['nome_loja']);
    $nome_arquivo = 'meta_loja_' . $nome_loja_sanitizado . '_' . sprintf('%02d', (int)$meta['mes']) . '_' . $meta['ano'] . '.xlsx';

    // Responder com arquivo
    if (ob_get_length()) ob_end_clean();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $nome_arquivo . '"');
    header('Content-Length: ' . filesize($temp_file));
    header('Cache-Control: max-age=0');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    readfile($temp_file);

    // Cleanup
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    @unlink($temp_file);
    exit();
} catch (Exception $e) {
    if (ob_get_length()) ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    error_log('Erro ao exportar meta da loja: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao exportar meta: ' . $e->getMessage()]);
    exit();
}
?>