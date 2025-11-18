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
    $stmt = $conn->prepare("SELECT id, nome, funcao, valor_vendido_total, esmaltes, profissional_parceiras, valor_vendido_make, bijou_make_bolsas, percentual_comissao_venda_total, valor_comissao_venda_total, percentual_comissao_profissional_parceiras, valor_comissao_profissional_parceiras, valor_comissao_total FROM meta_loja_vendedoras WHERE meta_loja_id = ?");
    $stmt->bindValue(1, $meta_id);
    $stmt->execute();
    while ($vend = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $vend['metas_produtos'] = buscarMetasProdutos($conn, $meta_id, $vend['id'], 'vendedora');
        $vendedoras[] = $vend;
    }

    $vendedoras_bijou = [];
    $stmt = $conn->prepare("SELECT id, nome, funcao, bijou_make_bolsas, valor_total_bijou_filial, bijou_make_bolsas_secoes, valor_total_bijou_filial_secoes, percentual_comissao_bijou, valor_comissao_bijou FROM meta_loja_vendedoras_bijou WHERE meta_loja_id = ?");
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
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos/Marcas/Cadastro de ' . (isset($op['nome']) ? $op['nome'] : '-'));
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca/Cadastro');
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
    $sheet->mergeCells('A' . $currentRow . ':M' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':M' . $currentRow, 'FF3498DB');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Função');
    $sheet->setCellValue('C' . $currentRow, 'Valor Vendido Total');
    $sheet->setCellValue('D' . $currentRow, 'Esmaltes');
    $sheet->setCellValue('E' . $currentRow, 'Profissional Parceiras');
    $sheet->setCellValue('F' . $currentRow, 'Valor Vendido Make');
    $sheet->setCellValue('G' . $currentRow, 'Bijou Make Bolsas');
    // Novas colunas de comissão, conforme a view
    $sheet->setCellValue('H' . $currentRow, '% Comissão');
    $sheet->setCellValue('I' . $currentRow, 'Comissão (R$)');
    $sheet->setCellValue('J' . $currentRow, '% Comissão sobre Prof./Parc.');
    $sheet->setCellValue('K' . $currentRow, 'Comissão sobre Prof./Parc. (R$)');
    $sheet->setCellValue('L' . $currentRow, 'Qtd Metas');
    $sheet->setCellValue('M' . $currentRow, 'Total Comissão');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':M' . $currentRow);
    $currentRow++;
    foreach ($vendedoras as $vend) {
        $sheet->setCellValue('A' . $currentRow, $vend['nome']);
        $sheet->setCellValue('B' . $currentRow, $vend['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$vend['valor_vendido_total']);
        $sheet->setCellValue('D' . $currentRow, (int)$vend['esmaltes']);
        $sheet->setCellValue('E' . $currentRow, (int)$vend['profissional_parceiras']);
        $sheet->setCellValue('F' . $currentRow, (float)$vend['valor_vendido_make']);
        $sheet->setCellValue('G' . $currentRow, (float)$vend['bijou_make_bolsas']);
        // Calcular metasTotal (soma das comissões de metas de produtos)
        $metasTotal = 0.0;
        if (!empty($vend['metas_produtos'])) {
            foreach ($vend['metas_produtos'] as $mpCalc) {
                $qv = isset($mpCalc['qtd_vendido']) ? (int)$mpCalc['qtd_vendido'] : 0;
                $qm = isset($mpCalc['qtd_meta']) ? (int)$mpCalc['qtd_meta'] : 0;
                $vv = isset($mpCalc['valor_vendido']) ? (float)$mpCalc['valor_vendido'] : 0.0;
                $p  = isset($mpCalc['percentual_sobre_venda']) ? (float)$mpCalc['percentual_sobre_venda'] : 0.0;
                $c  = isset($mpCalc['valor_comissao']) ? (float)$mpCalc['valor_comissao'] : (($qv >= $qm) ? ($vv * $p) / 100.0 : 0.0);
                $metasTotal += $c;
            }
        }

        // Percentuais e valores informados
        $percVendaTotal = isset($vend['percentual_comissao_venda_total']) ? (float)$vend['percentual_comissao_venda_total'] : 0.0;
        $percProfParceiras = isset($vend['percentual_comissao_profissional_parceiras']) ? (float)$vend['percentual_comissao_profissional_parceiras'] : 0.0;
        $comVendaTotalInformado = isset($vend['valor_comissao_venda_total']) ? (float)$vend['valor_comissao_venda_total'] : 0.0;
        $comProfParceirasInformado = isset($vend['valor_comissao_profissional_parceiras']) ? (float)$vend['valor_comissao_profissional_parceiras'] : 0.0;
        $totalComissaoInformado = isset($vend['valor_comissao_total']) ? (float)$vend['valor_comissao_total'] : 0.0;

        // Fallbacks conforme a view
        $totalVendidoBase = isset($vend['valor_vendido_total']) ? (float)$vend['valor_vendido_total'] : 0.0;
        $esmaltesBase = isset($vend['esmaltes']) ? (int)$vend['esmaltes'] : 0;
        $valorVendidoMakeBase = isset($vend['valor_vendido_make']) ? (float)$vend['valor_vendido_make'] : 0.0;
        $baseVendaTotal = $totalVendidoBase - $esmaltesBase - $valorVendidoMakeBase - $metasTotal;
        $comVendaTotalCalc = ($baseVendaTotal * $percVendaTotal) / 100.0;
        $comVendaTotal = $comVendaTotalInformado ?: $comVendaTotalCalc;
        $comProfParceirasCalc = ($metasTotal * $percProfParceiras) / 100.0;
        $comProfParceiras = $comProfParceirasInformado ?: $comProfParceirasCalc;

        $totalComissao = $totalComissaoInformado;
        if (!$totalComissao) {
            if ($comVendaTotal || $comProfParceiras) {
                $totalComissao = $comVendaTotal + $comProfParceiras;
            } else {
                $totalComissao = $comVendaTotalCalc + $comProfParceirasCalc;
            }
        }

        $qtdMetas = !empty($vend['metas_produtos']) ? count($vend['metas_produtos']) : 0;

        $sheet->setCellValue('H' . $currentRow, $percVendaTotal);
        $sheet->setCellValue('I' . $currentRow, (float)$comVendaTotal);
        $sheet->setCellValue('J' . $currentRow, $percProfParceiras);
        $sheet->setCellValue('K' . $currentRow, (float)$comProfParceiras);
        $sheet->setCellValue('L' . $currentRow, (int)$qtdMetas);
        $sheet->setCellValue('M' . $currentRow, (float)$totalComissao);

        aplicarEstiloDados($sheet, 'A' . $currentRow . ':M' . $currentRow);
        $currentRow++;

        // Metas de produtos da vendedora
        if (!empty($vend['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos/Marcas/Cadastro de ' . (isset($vend['nome']) ? $vend['nome'] : '-'));
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca/Cadastro');
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
    $sheet->mergeCells('A' . $currentRow . ':G' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow, 'FF9B59B6');
    $currentRow++;
    $sheet->setCellValue('A' . $currentRow, 'Nome');
    $sheet->setCellValue('B' . $currentRow, 'Função');
    $sheet->setCellValue('C' . $currentRow, 'Bijou Make Bolsas');
    $sheet->setCellValue('D' . $currentRow, '% Comissão');
    $sheet->setCellValue('E' . $currentRow, 'Comissão (R$)');
    $sheet->setCellValue('F' . $currentRow, 'Qtd Metas');
    $sheet->setCellValue('G' . $currentRow, 'Total Comissão');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow);
    $currentRow++;
    foreach ($vendedoras_bijou as $vb) {
        $sheet->setCellValue('A' . $currentRow, $vb['nome']);
        $sheet->setCellValue('B' . $currentRow, $vb['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$vb['bijou_make_bolsas']);

        // Calcular totais de metas e comissões de Bijou
        $metasTotalBijou = 0.0;
        if (!empty($vb['metas_produtos'])) {
            foreach ($vb['metas_produtos'] as $mpCalc) {
                $qv = isset($mpCalc['qtd_vendido']) ? (int)$mpCalc['qtd_vendido'] : 0;
                $qm = isset($mpCalc['qtd_meta']) ? (int)$mpCalc['qtd_meta'] : 0;
                $vv = isset($mpCalc['valor_vendido']) ? (float)$mpCalc['valor_vendido'] : 0.0;
                $p  = isset($mpCalc['percentual_sobre_venda']) ? (float)$mpCalc['percentual_sobre_venda'] : 0.0;
                $c  = isset($mpCalc['valor_comissao']) ? (float)$mpCalc['valor_comissao'] : (($qv >= $qm) ? ($vv * $p) / 100.0 : 0.0);
                $metasTotalBijou += $c;
            }
        }
        $percBijou = isset($vb['percentual_comissao_bijou']) ? (float)$vb['percentual_comissao_bijou'] : 0.0;
        $bijouValor = isset($vb['bijou_make_bolsas']) ? (float)$vb['bijou_make_bolsas'] : 0.0;
        $bijouComissaoInformada = isset($vb['valor_comissao_bijou']) ? (float)$vb['valor_comissao_bijou'] : 0.0;
        $bijouComissaoCalc = ($bijouValor * $percBijou) / 100.0;
        $bijouComissao = $bijouComissaoInformada ?: $bijouComissaoCalc;
        $qtdMetasBijou = !empty($vb['metas_produtos']) ? count($vb['metas_produtos']) : 0;
        $totalBijou = $metasTotalBijou + $bijouComissao;

        $sheet->setCellValue('D' . $currentRow, $percBijou);
        $sheet->setCellValue('E' . $currentRow, (float)$bijouComissao);
        $sheet->setCellValue('F' . $currentRow, (int)$qtdMetasBijou);
        $sheet->setCellValue('G' . $currentRow, (float)$totalBijou);

        aplicarEstiloDados($sheet, 'A' . $currentRow . ':G' . $currentRow);
        $currentRow++;

        if (!empty($vb['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos/Marcas/Cadastro de ' . (isset($vb['nome']) ? $vb['nome'] : '-'));
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca/Cadastro');
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
        $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':I' . $currentRow, 'FFE67E22');
        $currentRow++;
        $sheet->setCellValue('A' . $currentRow, 'Nome');
        $sheet->setCellValue('B' . $currentRow, 'Função');
        $sheet->setCellValue('C' . $currentRow, '% Meta Geral');
        $sheet->setCellValue('D' . $currentRow, 'Comissão (R$)');
        $sheet->setCellValue('E' . $currentRow, 'Valor Vendido Total');
        $sheet->setCellValue('F' . $currentRow, 'Esmaltes');
        $sheet->setCellValue('G' . $currentRow, 'Profissional Parceiras');
        $sheet->setCellValue('H' . $currentRow, 'Valor Vendido Make');
        $sheet->setCellValue('I' . $currentRow, 'Bijou Make Bolsas');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':I' . $currentRow);
        $currentRow++;
        $sheet->setCellValue('A' . $currentRow, $gerente['nome']);
        $sheet->setCellValue('B' . $currentRow, $gerente['funcao']);
        $sheet->setCellValue('C' . $currentRow, (float)$gerente['percentual_meta_geral']);
        // Comissão do gerente conforme a view: valor_venda_loja_total * (percentual_meta_geral ajustado) / 100
        $valorTotalLoja = isset($meta['valor_venda_loja_total']) ? (float)$meta['valor_venda_loja_total'] : 0.0;
        $pRaw = isset($gerente['percentual_meta_geral']) ? (float)$gerente['percentual_meta_geral'] : 0.0;
        $pFrac = ($pRaw > 1.0) ? ($pRaw / 100.0) : $pRaw; // 0.08 => 0.08%, 8 => 8% => 0.08%
        $comissaoGerente = $valorTotalLoja * ($pFrac / 100.0);
        $sheet->setCellValue('D' . $currentRow, (float)$comissaoGerente);
        $sheet->setCellValue('E' . $currentRow, (float)$gerente['valor_vendido_total']);
        $sheet->setCellValue('F' . $currentRow, (int)$gerente['esmaltes']);
        $sheet->setCellValue('G' . $currentRow, (int)$gerente['profissional_parceiras']);
        $sheet->setCellValue('H' . $currentRow, (float)$gerente['valor_vendido_make']);
        $sheet->setCellValue('I' . $currentRow, (float)$gerente['bijou_make_bolsas']);
        aplicarEstiloDados($sheet, 'A' . $currentRow . ':I' . $currentRow);
        $currentRow++;

        // Metas de produtos do gerente
        if (!empty($gerente['metas_produtos'])) {
            $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos/Marcas/Cadastro de ' . (isset($gerente['nome']) ? $gerente['nome'] : '-'));
            $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'Produto/Marca/Cadastro');
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
                $sheet->setCellValue('A' . $currentRow, 'Metas de Produtos/Marcas/Cadastro de ' . (isset($f['nome']) ? $f['nome'] : '-'));
                $sheet->mergeCells('A' . $currentRow . ':F' . $currentRow);
                aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':F' . $currentRow, 'FF95A5A6');
                $currentRow++;
                $sheet->setCellValue('A' . $currentRow, 'Produto/Marca/Cadastro');
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
    foreach (range('A', 'M') as $col) {
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