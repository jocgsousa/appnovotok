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
$data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
$data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
$filial = isset($_GET['filial']) ? intval($_GET['filial']) : null;
$rca = isset($_GET['rca']) ? $_GET['rca'] : null;
$agrupar_por = isset($_GET['agrupar_por']) ? $_GET['agrupar_por'] : 'mes';

// Validar o parâmetro agrupar_por
$opcoes_validas = ['dia', 'semana', 'mes', 'ano'];
if (!in_array($agrupar_por, $opcoes_validas)) {
    $agrupar_por = 'mes';
}

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Criar nova planilha
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Relatório de Clientes');
    
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
                'size' => 14,
                'color' => ['rgb' => '2C3E50']
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'ECF0F1']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_MEDIUM,
                    'color' => ['rgb' => '2C3E50']
                ]
            ]
        ]);
    }
    
    // Título principal
    $sheet->setCellValue('A1', 'RELATÓRIO DE CLIENTES');
    $sheet->mergeCells('A1:E1');
    $sheet->getRowDimension(1)->setRowHeight(30);
    aplicarEstiloTitulo($sheet, 'A1:E1');
    $currentRow = 2;
    
    // Informações da geração
    $sheet->setCellValue('A' . $currentRow, 'Data de Geração:');
    $sheet->setCellValue('B' . $currentRow, date('d/m/Y H:i:s'));
    $sheet->getStyle('A' . $currentRow . ':B' . $currentRow)->getFont()->setBold(true);
    $currentRow += 2;
    
    // Seção de filtros
    $sheet->setCellValue('A' . $currentRow, 'FILTROS APLICADOS');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF27AE60');
    $currentRow++;
    
    // Filtros aplicados
    $filtros = [
        ['Data Início:', $data_inicio ? date('d/m/Y', strtotime($data_inicio)) : 'Não especificada'],
        ['Data Fim:', $data_fim ? date('d/m/Y', strtotime($data_fim)) : 'Não especificada']
    ];
    
    if ($filial) {
        $stmt = $pdo->prepare("SELECT nome_fantasia FROM filiais WHERE id = ?");
        $stmt->execute([$filial]);
        $nome_filial = $stmt->fetchColumn();
        $filtros[] = ['Filial:', $nome_filial];
    } else {
        $filtros[] = ['Filial:', 'Todas'];
    }
    
    if ($rca) {
        $stmt = $pdo->prepare("SELECT nome FROM vendedores WHERE rca = ?");
        $stmt->execute([$rca]);
        $nome_vendedor = $stmt->fetchColumn();
        $filtros[] = ['Vendedor:', $nome_vendedor . ' (' . $rca . ')'];
    } else {
        $filtros[] = ['Vendedor:', 'Todos'];
    }
    
    $filtros[] = ['Agrupamento:', ucfirst($agrupar_por)];
    
    foreach ($filtros as $filtro) {
        $sheet->setCellValue('A' . $currentRow, $filtro[0]);
        $sheet->setCellValue('B' . $currentRow, $filtro[1]);
        $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true);
        $currentRow++;
    }
    $currentRow++;
    
    // Consulta para total de clientes
    $sql_total = "SELECT COUNT(*) as total FROM clientes WHERE 1=1";
    $params_total = [];
    
    // Construir cláusula WHERE para reutilização
    $where_clause = "";
    
    // Aplicar filtros
    if ($data_inicio) {
        $where_clause .= " AND DATE(clientes.created_at) >= :data_inicio";
        $params_total[':data_inicio'] = $data_inicio;
    }
    
    if ($data_fim) {
        $where_clause .= " AND DATE(clientes.created_at) <= :data_fim";
        $params_total[':data_fim'] = $data_fim;
    }
    
    if ($filial) {
        $where_clause .= " AND filial = :filial";
        $params_total[':filial'] = $filial;
    }
    
    if ($rca) {
        $where_clause .= " AND rca = :rca";
        $params_total[':rca'] = $rca;
    }
    
    // Adicionar cláusula WHERE à consulta total
    $sql_total .= $where_clause;
    
    $stmt_total = $pdo->prepare($sql_total);
    $stmt_total->execute($params_total);
    $total = $stmt_total->fetch(PDO::FETCH_ASSOC);
    
    // Resumo geral
    $sheet->setCellValue('A' . $currentRow, 'RESUMO GERAL');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FFE74C3C');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Total de Clientes:');
    $sheet->setCellValue('B' . $currentRow, $total['total']);
    $sheet->getStyle('A' . $currentRow . ':B' . $currentRow)->getFont()->setBold(true);
    $currentRow += 2;
    
    // Consulta para clientes por status
    $sql_status = "SELECT 
                    SUM(CASE WHEN novo = 1 THEN 1 ELSE 0 END) as novos,
                    SUM(CASE WHEN atualizado = 1 THEN 1 ELSE 0 END) as atualizados,
                    SUM(CASE WHEN recused = 1 THEN 1 ELSE 0 END) as recusados,
                    SUM(CASE WHEN registered = 1 THEN 1 ELSE 0 END) as registrados,
                    SUM(CASE WHEN authorized = 1 THEN 1 ELSE 0 END) as autorizados
                  FROM clientes WHERE 1=1";
    
    $params_status = $params_total; // Usar os mesmos parâmetros
    $stmt_status = $pdo->prepare($sql_status . $where_clause);
    $stmt_status->execute($params_status);
    $status = $stmt_status->fetch(PDO::FETCH_ASSOC);
    
    // Clientes por status
    $sheet->setCellValue('A' . $currentRow, 'CLIENTES POR STATUS');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF9B59B6');
    $currentRow++;
    
    // Cabeçalho da tabela
    $sheet->setCellValue('A' . $currentRow, 'Status');
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    
    $status_data = [
        ['Novos', $status['novos']],
        ['Atualizados', $status['atualizados']],
        ['Recusados', $status['recusados']],
        ['Registrados', $status['registrados']],
        ['Autorizados', $status['autorizados']]
    ];
    
    $startRow = $currentRow;
    foreach ($status_data as $row) {
        $percentual = $total['total'] > 0 ? number_format(($row[1] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $row[0]);
        $sheet->setCellValue('B' . $currentRow, $row[1]);
        $sheet->setCellValue('C' . $currentRow, $percentual);
        $currentRow++;
    }
    aplicarEstiloDados($sheet, 'A' . $startRow . ':C' . ($currentRow - 1));
    $currentRow++;
    
    // Consulta para clientes por tipo
    $sql_tipo = "SELECT 
                  SUM(CASE WHEN corporate = 0 THEN 1 ELSE 0 END) as fisica,
                  SUM(CASE WHEN corporate = 1 THEN 1 ELSE 0 END) as juridica
                FROM clientes WHERE 1=1";
    
    $stmt_tipo = $pdo->prepare($sql_tipo . $where_clause);
    $stmt_tipo->execute($params_total);
    $tipo = $stmt_tipo->fetch(PDO::FETCH_ASSOC);
    
    // Clientes por tipo
    $sheet->setCellValue('A' . $currentRow, 'CLIENTES POR TIPO');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF3498DB');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Tipo');
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    
    $tipo_data = [
        ['Pessoa Física', $tipo['fisica']],
        ['Pessoa Jurídica', $tipo['juridica']]
    ];
    
    $startRow = $currentRow;
    foreach ($tipo_data as $row) {
        $percentual = $total['total'] > 0 ? number_format(($row[1] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $row[0]);
        $sheet->setCellValue('B' . $currentRow, $row[1]);
        $sheet->setCellValue('C' . $currentRow, $percentual);
        $currentRow++;
    }
    aplicarEstiloDados($sheet, 'A' . $startRow . ':C' . ($currentRow - 1));
    $currentRow++;
    
    // Consulta para clientes por filial
    $sql_filial = "SELECT 
                    f.id, 
                    f.nome_fantasia as nome, 
                    COUNT(c.id) as total
                  FROM filiais f
                  LEFT JOIN clientes c ON c.filial = f.id
                  WHERE 1=1";
    
    $params_filial = $params_total;
    // Adaptar a cláusula WHERE para a tabela clientes com alias 'c'
    $filial_where_clause = str_replace('clientes.', 'c.', $where_clause);
    
    $sql_filial .= $filial_where_clause . " GROUP BY f.id ORDER BY total DESC";
    
    $stmt_filial = $pdo->prepare($sql_filial);
    $stmt_filial->execute($params_filial);
    $filiais = $stmt_filial->fetchAll(PDO::FETCH_ASSOC);
    
    // Clientes por filial
    $sheet->setCellValue('A' . $currentRow, 'CLIENTES POR FILIAL');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FFF39C12');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Filial');
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    foreach ($filiais as $row) {
        $percentual = $total['total'] > 0 ? number_format(($row['total'] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $row['nome']);
        $sheet->setCellValue('B' . $currentRow, $row['total']);
        $sheet->setCellValue('C' . $currentRow, $percentual);
        $currentRow++;
    }
    aplicarEstiloDados($sheet, 'A' . $startRow . ':C' . ($currentRow - 1));
    $currentRow++;
    
    // Consulta para clientes por vendedor
    $sql_vendedor = "SELECT 
                      v.rca, 
                      v.nome, 
                      COUNT(c.id) as total
                    FROM vendedores v
                    LEFT JOIN clientes c ON c.rca = v.rca
                    WHERE 1=1";
    
    $sql_vendedor .= $filial_where_clause . " GROUP BY v.rca ORDER BY total DESC";
    
    $stmt_vendedor = $pdo->prepare($sql_vendedor);
    $stmt_vendedor->execute($params_total);
    $vendedores = $stmt_vendedor->fetchAll(PDO::FETCH_ASSOC);
    
    // Clientes por vendedor
    $sheet->setCellValue('A' . $currentRow, 'CLIENTES POR VENDEDOR');
    $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':D' . $currentRow, 'FF1ABC9C');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Vendedor');
    $sheet->setCellValue('B' . $currentRow, 'RCA');
    $sheet->setCellValue('C' . $currentRow, 'Quantidade');
    $sheet->setCellValue('D' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':D' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    foreach ($vendedores as $row) {
        $percentual = $total['total'] > 0 ? number_format(($row['total'] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $row['nome']);
        $sheet->setCellValue('B' . $currentRow, $row['rca']);
        $sheet->setCellValue('C' . $currentRow, $row['total']);
        $sheet->setCellValue('D' . $currentRow, $percentual);
        $currentRow++;
    }
    aplicarEstiloDados($sheet, 'A' . $startRow . ':D' . ($currentRow - 1));
    $currentRow++;
    
    // Consulta para clientes por ramo de atividade
    $sql_atividade = "SELECT 
                      a.id, 
                      a.ramo, 
                      COUNT(c.id) as total
                    FROM pcativi a
                    LEFT JOIN clientes c ON c.activity_id = a.id
                    WHERE 1=1";
    
    $sql_atividade .= $filial_where_clause . " GROUP BY a.id ORDER BY total DESC";
    
    $stmt_atividade = $pdo->prepare($sql_atividade);
    $stmt_atividade->execute($params_total);
    $atividades = $stmt_atividade->fetchAll(PDO::FETCH_ASSOC);
    
    // Clientes por ramo de atividade
    $sheet->setCellValue('A' . $currentRow, 'CLIENTES POR RAMO DE ATIVIDADE');
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF8E44AD');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, 'Ramo de Atividade');
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    foreach ($atividades as $row) {
        $percentual = $total['total'] > 0 ? number_format(($row['total'] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $row['ramo']);
        $sheet->setCellValue('B' . $currentRow, $row['total']);
        $sheet->setCellValue('C' . $currentRow, $percentual);
        $currentRow++;
    }
    aplicarEstiloDados($sheet, 'A' . $startRow . ':C' . ($currentRow - 1));
    $currentRow++;
    
    // Consulta para clientes por período
    $campo_periodo = "";
    
    switch ($agrupar_por) {
        case 'dia':
            $campo_periodo = "DATE_FORMAT(clientes.created_at, '%Y-%m-%d')";
            $titulo_periodo = "CLIENTES POR DIA";
            $cabecalho_periodo = "Data";
            break;
        case 'semana':
            $campo_periodo = "CONCAT(YEAR(clientes.created_at), '-W', WEEK(clientes.created_at))";
            $titulo_periodo = "CLIENTES POR SEMANA";
            $cabecalho_periodo = "Semana";
            break;
        case 'mes':
            $campo_periodo = "DATE_FORMAT(clientes.created_at, '%Y-%m')";
            $titulo_periodo = "CLIENTES POR MÊS";
            $cabecalho_periodo = "Mês";
            break;
        case 'ano':
            $campo_periodo = "YEAR(clientes.created_at)";
            $titulo_periodo = "CLIENTES POR ANO";
            $cabecalho_periodo = "Ano";
            break;
        default:
            $campo_periodo = "DATE_FORMAT(clientes.created_at, '%Y-%m')";
            $titulo_periodo = "CLIENTES POR MÊS";
            $cabecalho_periodo = "Mês";
    }
    
    // Garantir que campo_periodo não está vazio
    if (empty($campo_periodo)) {
        $campo_periodo = "DATE_FORMAT(clientes.created_at, '%Y-%m')";
    }
    
    // Construir a consulta SQL corretamente - evitando usar o alias na cláusula GROUP BY
    $sql_periodo = "SELECT " . $campo_periodo . " AS periodo, COUNT(*) AS total FROM clientes WHERE 1=1";
    
    // Adicionar a cláusula WHERE reutilizável
    $sql_periodo .= $where_clause;
    
    // Usar a expressão diretamente no GROUP BY em vez do alias "periodo"
    $sql_periodo .= " GROUP BY " . $campo_periodo . " ORDER BY " . $campo_periodo . " ASC";
    
    try {
        // Registrar a consulta para debug
        error_log("SQL períodos: " . $sql_periodo);
        
        $stmt_periodo = $pdo->prepare($sql_periodo);
        $stmt_periodo->execute($params_total);
        $periodos = $stmt_periodo->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Erro na consulta de períodos: " . $e->getMessage());
        error_log("SQL: " . $sql_periodo);
        
        // Tentar uma consulta alternativa mais simples em caso de erro
        try {
            // Abordagem alternativa usando subconsulta
            $sql_alternativo = "SELECT periodo, COUNT(*) AS total FROM (
                SELECT " . $campo_periodo . " AS periodo FROM clientes WHERE 1=1";
                
            // Adicionar a cláusula WHERE reutilizável
            $sql_alternativo .= $where_clause;
            
            $sql_alternativo .= ") AS temp GROUP BY periodo ORDER BY periodo ASC";
            
            error_log("Tentando SQL alternativo: " . $sql_alternativo);
            
            $stmt_alternativo = $pdo->prepare($sql_alternativo);
            $stmt_alternativo->execute($params_total);
            $periodos = $stmt_alternativo->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e2) {
            error_log("Erro na consulta alternativa: " . $e2->getMessage());
            
            // Última tentativa - consulta simplificada sem filtros
            try {
                $sql_simples = "SELECT " . $campo_periodo . " AS periodo, COUNT(*) AS total 
                               FROM clientes 
                               GROUP BY " . $campo_periodo . " 
                               ORDER BY " . $campo_periodo . " ASC";
                
                error_log("Tentando SQL simplificado: " . $sql_simples);
                
                $stmt_simples = $pdo->prepare($sql_simples);
                $stmt_simples->execute();
                $periodos = $stmt_simples->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e3) {
                error_log("Todas as tentativas de consulta falharam: " . $e3->getMessage());
                $periodos = []; // Em caso de erro, inicializa como array vazio
            }
        }
    }
    
    // Clientes por período
    $sheet->setCellValue('A' . $currentRow, $titulo_periodo);
    $sheet->mergeCells('A' . $currentRow . ':C' . $currentRow);
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow, 'FF34495E');
    $currentRow++;
    
    $sheet->setCellValue('A' . $currentRow, $cabecalho_periodo);
    $sheet->setCellValue('B' . $currentRow, 'Quantidade');
    $sheet->setCellValue('C' . $currentRow, 'Percentual');
    aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':C' . $currentRow);
    $currentRow++;
    
    $startRow = $currentRow;
    foreach ($periodos as $row) {
        $periodo_formatado = $row['periodo'];
        if ($agrupar_por == 'mes') {
            $partes = explode('-', $row['periodo']);
            if (count($partes) == 2) {
                $periodo_formatado = $partes[1] . '/' . $partes[0];
            }
        } else if ($agrupar_por == 'dia') {
            $data = new DateTime($row['periodo']);
            $periodo_formatado = $data->format('d/m/Y');
        }
        
        $percentual = $total['total'] > 0 ? number_format(($row['total'] / $total['total']) * 100, 2) . '%' : '0%';
        $sheet->setCellValue('A' . $currentRow, $periodo_formatado);
        $sheet->setCellValue('B' . $currentRow, $row['total']);
        $sheet->setCellValue('C' . $currentRow, $percentual);
        $currentRow++;
    }
    
    if (count($periodos) > 0) {
        aplicarEstiloDados($sheet, 'A' . $startRow . ':C' . ($currentRow - 1));
    }
    
    // Ajustar largura das colunas
    $sheet->getColumnDimension('A')->setWidth(30);
    $sheet->getColumnDimension('B')->setWidth(15);
    $sheet->getColumnDimension('C')->setWidth(15);
    $sheet->getColumnDimension('D')->setWidth(15);
    $sheet->getColumnDimension('E')->setWidth(15);
    
    // Preparar nome do arquivo
    $data_atual = date('Y-m-d_H-i-s');
    $nome_arquivo = "relatorio_clientes_{$data_atual}.xlsx";
    
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
    error_log("Erro ao exportar relatório de clientes: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao exportar relatório de clientes: ' . $e->getMessage()
    ]);
    exit();
}
?>