<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");

// Verificar se é uma requisição OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit();
}

// Definir o limite de tempo de execução para operações longas
set_time_limit(300); // 5 minutos
ini_set('memory_limit', '256M'); // Aumentar limite de memória

// Garantir que não há saída de buffer antes de iniciar
ob_start();

include 'database.php';
include 'jwt_utils.php';

// Verificar se a biblioteca PhpSpreadsheet está disponível
if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
    // Limpar qualquer saída anterior
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

// Verificar token JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    // Limpar qualquer saída anterior
    ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit();
}

// Obter parâmetros da requisição
$filial = isset($_GET['filial']) ? $_GET['filial'] : null;
$caixa = isset($_GET['caixa']) ? $_GET['caixa'] : null;
$data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
$data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
$vendedor = isset($_GET['vendedor']) ? $_GET['vendedor'] : null;

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Criar nova planilha
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Relatório de Vendas');
    
    $currentRow = 1;
    
    // Função para aplicar estilo de cabeçalho
    function aplicarEstiloCabecalho($sheet, $range, $backgroundColor = 'FF4A90E2') {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 12
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => $backgroundColor]
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ]);
    }
    
    // Função para aplicar estilo de dados
    function aplicarEstiloDados($sheet, $range) {
        $sheet->getStyle($range)->applyFromArray([
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CCCCCC']
                ]
            ]
        ]);
    }
    
    // Função para aplicar estilo de título de seção
    function aplicarEstiloTitulo($sheet, $range) {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 16,
                'color' => ['rgb' => 'FFFFFF']
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'FF2C3E50']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ]);
    }
    
    // Título principal
    $sheet->setCellValue('A1', 'RELATÓRIO DE VENDAS');
    $sheet->mergeCells('A1:E1');
    $sheet->getRowDimension(1)->setRowHeight(30);
    aplicarEstiloTitulo($sheet, 'A1:E1');
    $currentRow = 2;
    
    // Informações dos filtros aplicados
    $filtros = [];
    
    if ($filial !== null) {
        $filtros[] = ['Filial:', $filial];
    } else {
        $filtros[] = ['Filial:', 'Todas'];
    }
    
    if ($caixa !== null) {
        $filtros[] = ['Caixa:', $caixa];
    } else {
        $filtros[] = ['Caixa:', 'Todos'];
    }
    
    if ($data_inicio !== null) {
        $filtros[] = ['Data Início:', date('d/m/Y', strtotime($data_inicio))];
    } else {
        $filtros[] = ['Data Início:', 'Não definida'];
    }
    
    if ($data_fim !== null) {
        $filtros[] = ['Data Fim:', date('d/m/Y', strtotime($data_fim))];
    } else {
        $filtros[] = ['Data Fim:', 'Não definida'];
    }
    
    if ($vendedor !== null) {
        $filtros[] = ['Vendedor:', $vendedor];
    } else {
        $filtros[] = ['Vendedor:', 'Todos'];
    }
    
    // Adicionar filtros à planilha
    foreach ($filtros as $filtro) {
        $sheet->setCellValue('A' . $currentRow, $filtro[0]);
        $sheet->setCellValue('B' . $currentRow, $filtro[1]);
        $currentRow++;
    }
    $currentRow++; // Linha em branco
    
    // Construir a consulta SQL base
    $base_where = "WHERE 1=1";
    $params = [];
    
    // Adicionar filtros à consulta
    if ($filial !== null) {
        $base_where .= " AND filial = :filial";
        $params[':filial'] = $filial;
    }
    
    if ($caixa !== null) {
        $base_where .= " AND caixa = :caixa";
        $params[':caixa'] = $caixa;
    }
    
    if ($data_inicio !== null) {
        $base_where .= " AND DATE(data) >= :data_inicio";
        $params[':data_inicio'] = $data_inicio;
    }
    
    if ($data_fim !== null) {
        $base_where .= " AND DATE(data) <= :data_fim";
        $params[':data_fim'] = $data_fim;
    }
    
    if ($vendedor !== null) {
        $base_where .= " AND vendedor = :vendedor";
        $params[':vendedor'] = $vendedor;
    }
    
    // Consultas para obter os dados do relatório
    
    // 1. Vendas sem cancelamentos (bem-sucedidas)
    $query_sem_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total
        FROM pedidos 
        $base_where 
        AND (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
        AND (total_cancelados = 0 OR total_cancelados IS NULL)
    ";
    
    // 2. Vendas com itens cancelados (parcialmente canceladas)
    $query_com_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where 
        AND ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
        AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
    ";
    
    // 3. Vendas apenas canceladas (completamente canceladas)
    $query_apenas_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where 
        AND (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
        AND (itens = '[]' OR itens IS NULL OR itens = '')
    ";
    
    // 4. Totais gerais
    $query_totais = "
        SELECT 
            COUNT(*) as total_pedidos,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total_geral,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado_geral
        FROM pedidos 
        $base_where
    ";
    
    // 5. Dados por período
    $query_por_periodo = "
        SELECT 
            DATE(data) as data_venda,
            COUNT(*) as total_pedidos,
            SUM(CASE 
                WHEN (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
                AND (total_cancelados = 0 OR total_cancelados IS NULL) 
                THEN 1 ELSE 0 END) as sem_cancelados,
            SUM(CASE 
                WHEN ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
                AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
                THEN 1 ELSE 0 END) as com_cancelados,
            SUM(CASE 
                WHEN (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
                AND (itens = '[]' OR itens IS NULL OR itens = '')
                THEN 1 ELSE 0 END) as apenas_cancelados,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where
        GROUP BY DATE(data)
        ORDER BY data_venda DESC
        LIMIT 30
    ";
    
    // 6. Consulta para dados agrupados por filial (quando filial não especificada)
    $query_por_filial = null;
    if ($filial === null) {
        $query_por_filial = "
            SELECT 
                filial,
                COUNT(*) as total_pedidos,
                SUM(CASE 
                    WHEN (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
                    AND (total_cancelados = 0 OR total_cancelados IS NULL) 
                    THEN 1 ELSE 0 END) as sem_cancelados,
                SUM(CASE 
                    WHEN ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
                    AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
                    THEN 1 ELSE 0 END) as com_cancelados,
                SUM(CASE 
                    WHEN (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
                    AND (itens = '[]' OR itens IS NULL OR itens = '')
                    THEN 1 ELSE 0 END) as apenas_cancelados,
                COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
                COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
            FROM pedidos 
            $base_where
            GROUP BY filial
            ORDER BY filial ASC
        ";
    }
    
    // Executar consultas
    $resultado = [];
    
    // Vendas sem cancelamentos
    $stmt = $conn->prepare($query_sem_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['sem_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Vendas com cancelamentos
    $stmt = $conn->prepare($query_com_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['com_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Vendas apenas canceladas
    $stmt = $conn->prepare($query_apenas_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['apenas_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Totais gerais
    $stmt = $conn->prepare($query_totais);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['totais'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Dados por período
    $stmt = $conn->prepare($query_por_periodo);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['por_periodo'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Dados por filial (quando filial não especificada)
    if ($query_por_filial !== null) {
        $stmt = $conn->prepare($query_por_filial);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $resultado['por_filial'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Calcular percentuais
    $total_pedidos = (int)$resultado['totais']['total_pedidos'];
    if ($total_pedidos > 0) {
        $resultado['percentuais'] = [
            'sem_cancelados' => round(((int)$resultado['sem_cancelados']['quantidade'] / $total_pedidos) * 100, 2),
            'com_cancelados' => round(((int)$resultado['com_cancelados']['quantidade'] / $total_pedidos) * 100, 2),
            'apenas_cancelados' => round(((int)$resultado['apenas_cancelados']['quantidade'] / $total_pedidos) * 100, 2)
        ];
    } else {
        $resultado['percentuais'] = [
            'sem_cancelados' => 0,
            'com_cancelados' => 0,
            'apenas_cancelados' => 0
        ];
    }
    
    // RESUMO GERAL
    $sheet->setCellValue('A' . $currentRow, 'RESUMO GERAL');
    $sheet->mergeCells('A' . $currentRow . ':E' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':E' . $currentRow, 'FF27AE60');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Tipo de Venda');
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    $sheet->setCellValue('D' . $currentRow, 'Valor Total');
    $sheet->setCellValue('E' . $currentRow, 'Valor Cancelado');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':E' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    
    // Vendas bem-sucedidas
    $sheet->setCellValue('A' . $currentRow, 'Vendas Bem-sucedidas');
    $sheet->setCellValue('B' . $currentRow, $resultado['sem_cancelados']['quantidade']);
    $sheet->setCellValue('C' . $currentRow, $resultado['percentuais']['sem_cancelados'] . '%');
    $sheet->setCellValue('D' . $currentRow, 'R$ ' . number_format($resultado['sem_cancelados']['valor_total'], 2, ',', '.'));
    $sheet->setCellValue('E' . $currentRow, 'R$ 0,00');
    $currentRow++;
    
    // Vendas com cancelamentos
    $sheet->setCellValue('A' . $currentRow, 'Vendas com Cancelamentos');
    $sheet->setCellValue('B' . $currentRow, $resultado['com_cancelados']['quantidade']);
    $sheet->setCellValue('C' . $currentRow, $resultado['percentuais']['com_cancelados'] . '%');
    $sheet->setCellValue('D' . $currentRow, 'R$ ' . number_format($resultado['com_cancelados']['valor_total'], 2, ',', '.'));
    $sheet->setCellValue('E' . $currentRow, 'R$ ' . number_format($resultado['com_cancelados']['valor_cancelado'], 2, ',', '.'));
    $currentRow++;
    
    // Vendas canceladas
    $sheet->setCellValue('A' . $currentRow, 'Vendas Canceladas');
    $sheet->setCellValue('B' . $currentRow, $resultado['apenas_cancelados']['quantidade']);
    $sheet->setCellValue('C' . $currentRow, $resultado['percentuais']['apenas_cancelados'] . '%');
    $sheet->setCellValue('D' . $currentRow, 'R$ 0,00');
    $sheet->setCellValue('E' . $currentRow, 'R$ ' . number_format($resultado['apenas_cancelados']['valor_cancelado'], 2, ',', '.'));
    $currentRow++;
    
    // Total
    $sheet->setCellValue('A' . $currentRow, 'TOTAL');
    $sheet->setCellValue('B' . $currentRow, $resultado['totais']['total_pedidos']);
    $sheet->setCellValue('C' . $currentRow, '100%');
    $sheet->setCellValue('D' . $currentRow, 'R$ ' . number_format($resultado['totais']['valor_total_geral'], 2, ',', '.'));
    $sheet->setCellValue('E' . $currentRow, 'R$ ' . number_format($resultado['totais']['valor_cancelado_geral'], 2, ',', '.'));
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':E' . $currentRow, 'FF2C3E50');
    $currentRow++;
    
    aplicarEstiloDados($sheet, 'A' . $startRow . ':E' . ($currentRow - 2));
    $currentRow++;
    
    // DETALHAMENTO POR FILIAL (quando filial não especificada)
    if (isset($resultado['por_filial']) && count($resultado['por_filial']) > 0) {
        $sheet->setCellValue('A' . $currentRow, 'DETALHAMENTO POR FILIAL');
        $sheet->mergeCells('A' . $currentRow . ':G' . $currentRow);
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow, 'FF3498DB');
        $currentRow++;
        
        $sheet->setCellValue('A' . $currentRow, 'Filial');
        $sheet->setCellValue('B' . $currentRow, 'Total Pedidos');
        $sheet->setCellValue('C' . $currentRow, 'Bem-sucedidas (%)');
        $sheet->setCellValue('D' . $currentRow, 'Com Cancelamentos (%)');
        $sheet->setCellValue('E' . $currentRow, 'Canceladas (%)');
        $sheet->setCellValue('F' . $currentRow, 'Valor Total');
        $sheet->setCellValue('G' . $currentRow, 'Valor Cancelado');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow);
        $currentRow++;
        
        $startRowFilial = $currentRow;
        foreach ($resultado['por_filial'] as $item) {
            // Calcular percentuais para esta filial
            $totalPedidosFilial = (int)$item['total_pedidos'];
            $percSemCancelados = $totalPedidosFilial > 0 ? round(((int)$item['sem_cancelados'] / $totalPedidosFilial) * 100, 2) : 0;
            $percComCancelados = $totalPedidosFilial > 0 ? round(((int)$item['com_cancelados'] / $totalPedidosFilial) * 100, 2) : 0;
            $percApenasCancelados = $totalPedidosFilial > 0 ? round(((int)$item['apenas_cancelados'] / $totalPedidosFilial) * 100, 2) : 0;
            
            $sheet->setCellValue('A' . $currentRow, 'Filial ' . $item['filial']);
            $sheet->setCellValue('B' . $currentRow, $item['total_pedidos']);
            $sheet->setCellValue('C' . $currentRow, $item['sem_cancelados'] . ' (' . $percSemCancelados . '%)');
            $sheet->setCellValue('D' . $currentRow, $item['com_cancelados'] . ' (' . $percComCancelados . '%)');
            $sheet->setCellValue('E' . $currentRow, $item['apenas_cancelados'] . ' (' . $percApenasCancelados . '%)');
            $sheet->setCellValue('F' . $currentRow, 'R$ ' . number_format($item['valor_total'], 2, ',', '.'));
            $sheet->setCellValue('G' . $currentRow, 'R$ ' . number_format($item['valor_cancelado'], 2, ',', '.'));
            $currentRow++;
        }
        
        aplicarEstiloDados($sheet, 'A' . $startRowFilial . ':G' . ($currentRow - 1));
        $currentRow++;
    }
    
    // DETALHAMENTO POR PERÍODO
    $sheet->setCellValue('A' . $currentRow, 'DETALHAMENTO POR PERÍODO');
    $sheet->mergeCells('A' . $currentRow . ':G' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow, 'FF8E44AD');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Data');
    $sheet->setCellValue('B' . $currentRow, 'Total Pedidos');
    $sheet->setCellValue('C' . $currentRow, 'Bem-sucedidas');
    $sheet->setCellValue('D' . $currentRow, 'Com Cancelamentos');
    $sheet->setCellValue('E' . $currentRow, 'Canceladas');
    $sheet->setCellValue('F' . $currentRow, 'Valor Total');
    $sheet->setCellValue('G' . $currentRow, 'Valor Cancelado');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':G' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    foreach ($resultado['por_periodo'] as $item) {
        $sheet->setCellValue('A' . $currentRow, date('d/m/Y', strtotime($item['data_venda'])));
        $sheet->setCellValue('B' . $currentRow, $item['total_pedidos']);
        $sheet->setCellValue('C' . $currentRow, $item['sem_cancelados']);
        $sheet->setCellValue('D' . $currentRow, $item['com_cancelados']);
        $sheet->setCellValue('E' . $currentRow, $item['apenas_cancelados']);
        $sheet->setCellValue('F' . $currentRow, 'R$ ' . number_format($item['valor_total'], 2, ',', '.'));
        $sheet->setCellValue('G' . $currentRow, 'R$ ' . number_format($item['valor_cancelado'], 2, ',', '.'));
        $currentRow++;
    }
    
    if (count($resultado['por_periodo']) > 0) {
        aplicarEstiloDados($sheet, 'A' . $startRow . ':G' . ($currentRow - 1));
    }
    
    // Ajustar largura das colunas
    $sheet->getColumnDimension('A')->setWidth(25);
    $sheet->getColumnDimension('B')->setWidth(15);
    $sheet->getColumnDimension('C')->setWidth(15);
    $sheet->getColumnDimension('D')->setWidth(20);
    $sheet->getColumnDimension('E')->setWidth(15);
    $sheet->getColumnDimension('F')->setWidth(15);
    $sheet->getColumnDimension('G')->setWidth(15);
    
    // Preparar nome do arquivo
    $data_atual = date('Y-m-d_H-i-s');
    $nome_arquivo = "relatorio_vendas_{$data_atual}.xlsx";
    
    // Limpar qualquer saída anterior e buffer
    if (ob_get_length()) ob_end_clean();
    
    // Criar writer e salvar para um arquivo temporário
    $temp_file = tempnam(sys_get_temp_dir(), 'excel_');
    $writer = new Xlsx($spreadsheet);
    $writer->save($temp_file);
    
    // Verificar se o arquivo foi criado corretamente
    if (!file_exists($temp_file) || filesize($temp_file) < 100) {
        throw new Exception("Erro ao criar arquivo Excel temporário");
    }
    
    // Configurar cabeçalhos para download
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $nome_arquivo . '"');
    header('Content-Length: ' . filesize($temp_file));
    header('Cache-Control: max-age=0');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    // Enviar o arquivo para o cliente
    readfile($temp_file);
    
    // Limpar memória e remover arquivo temporário
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    @unlink($temp_file);
    
    exit(); // Importante para evitar qualquer saída adicional
    
} catch (Exception $e) {
    // Em caso de erro, retornar uma resposta JSON
    if (ob_get_length()) ob_end_clean();
    header("Content-Type: application/json; charset=UTF-8");
    error_log("Erro ao exportar relatório de vendas: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao exportar relatório de vendas: ' . $e->getMessage()
    ]);
    exit();
}
?>
