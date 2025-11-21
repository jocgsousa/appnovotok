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

// Função para aplicar estilo de cabeçalho
function aplicarEstiloCabecalho($sheet, $range, $backgroundColor = 'FF4A90E2') {
    $sheet->getStyle($range)->applyFromArray([
        'font' => [
            'bold' => true,
            'color' => ['argb' => 'FFFFFFFF'],
            'size' => 12
        ],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['argb' => $backgroundColor]
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['argb' => 'FF000000']
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
                'color' => ['argb' => 'FF000000']
            ]
        ]
    ]);
}

// Função para aplicar estilo de título de seção
function aplicarEstiloTitulo($sheet, $range) {
    $sheet->getStyle($range)->applyFromArray([
        'font' => [
            'bold' => true,
            'color' => ['argb' => 'FFFFFFFF'],
            'size' => 14
        ],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['argb' => 'FF2C3E50']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['argb' => 'FF000000']
            ]
        ]
    ]);
}

try {
    // Obter parâmetros de filtro
    $dataInicio = $_GET['data_inicio'] ?? date('Y-m-01');
    $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
    $filial = $_GET['filial'] ?? null;
    $campanha = $_GET['campanha'] ?? null;
    
    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();
    
    // Criar planilha
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Relatório NPS');
    
    // Título principal
    $sheet->setCellValue('A1', 'RELATÓRIO NPS - NET PROMOTER SCORE');
    $sheet->mergeCells('A1:H1');
    $sheet->getRowDimension(1)->setRowHeight(30);
    aplicarEstiloTitulo($sheet, 'A1:H1');
    
    // Informações do relatório
    $currentRow = 3;
    $sheet->setCellValue('A' . $currentRow, 'Período:');
    $sheet->setCellValue('B' . $currentRow, date('d/m/Y', strtotime($dataInicio)) . ' a ' . date('d/m/Y', strtotime($dataFim)));
    $sheet->setCellValue('D' . $currentRow, 'Data de Geração:');
    $sheet->setCellValue('E' . $currentRow, date('d/m/Y H:i:s'));
    $currentRow += 2;
    
    // Obter estatísticas gerais
    $statsQuery = "SELECT 
                    COUNT(*) as total_envios,
                    SUM(CASE WHEN status_envio IN ('enviado', 'finalizado') THEN 1 ELSE 0 END) as enviados,
                    SUM(CASE WHEN status_envio = 'finalizado' THEN 1 ELSE 0 END) as finalizados,
                    SUM(CASE WHEN status_envio = 'cancelado' THEN 1 ELSE 0 END) as cancelados,
                    SUM(CASE WHEN status_envio = 'erro' THEN 1 ELSE 0 END) as erros
                   FROM controle_envios_nps 
                   WHERE DATE(data_cadastro) BETWEEN ? AND ?";
    
    $params = [$dataInicio, $dataFim];
    
    if ($filial) {
        $statsQuery .= " AND filial = ?";
        $params[] = $filial;
    }
    
    if ($campanha) {
        $statsQuery .= " AND campanha_id = ?";
        $params[] = $campanha;
    }
    
    $statsStmt = $db->prepare($statsQuery);
    $statsStmt->execute($params);
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Obter dados de NPS
    $npsQuery = "SELECT 
                    COUNT(r.id) as total_respostas,
                    AVG(r.nota_nps) as nota_media,
                    SUM(CASE WHEN r.nota_nps >= 9 THEN 1 ELSE 0 END) as promotores,
                    SUM(CASE WHEN r.nota_nps >= 7 AND r.nota_nps <= 8 THEN 1 ELSE 0 END) as neutros,
                    SUM(CASE WHEN r.nota_nps <= 6 THEN 1 ELSE 0 END) as detratores
                 FROM respostas_nps r
                 INNER JOIN controle_envios_nps c ON r.controle_envio_id = c.id
                 WHERE DATE(r.data_resposta) BETWEEN ? AND ?";
    
    $npsParams = [$dataInicio, $dataFim];
    
    if ($filial) {
        $npsQuery .= " AND c.filial = ?";
        $npsParams[] = $filial;
    }
    
    if ($campanha) {
        $npsQuery .= " AND c.campanha_id = ?";
        $npsParams[] = $campanha;
    }
    
    $npsStmt = $db->prepare($npsQuery);
    $npsStmt->execute($npsParams);
    $npsData = $npsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Calcular Score NPS
    $scoreNPS = 0;
    if ($npsData['total_respostas'] > 0) {
        $percentualPromotores = ($npsData['promotores'] / $npsData['total_respostas']) * 100;
        $percentualDetratores = ($npsData['detratores'] / $npsData['total_respostas']) * 100;
        $scoreNPS = $percentualPromotores - $percentualDetratores;
    }
    
    // Seção de Estatísticas Gerais
    $sheet->setCellValue('A' . $currentRow, 'ESTATÍSTICAS GERAIS');
    $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
    aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':D' . $currentRow);
    $currentRow++;
    
    $estatisticas = [
        ['Total de Envios', $stats['total_envios']],
        ['Enviados com Sucesso', $stats['enviados']],
        ['Finalizados', $stats['finalizados']],
        ['Cancelados', $stats['cancelados']],
        ['Erros', $stats['erros']]
    ];
    
    foreach ($estatisticas as $stat) {
        $sheet->setCellValue('A' . $currentRow, $stat[0]);
        $sheet->setCellValue('B' . $currentRow, $stat[1]);
        $currentRow++;
    }
    
    aplicarEstiloDados($sheet, 'A' . ($currentRow - count($estatisticas)) . ':B' . ($currentRow - 1));
    $currentRow++;
    
    // Seção de Dados NPS
    $sheet->setCellValue('A' . $currentRow, 'DADOS NPS');
    $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
    aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':D' . $currentRow);
    $currentRow++;
    
    $dadosNPS = [
        ['Total de Respostas', $npsData['total_respostas']],
        ['Nota Média', number_format($npsData['nota_media'] ?? 0, 2)],
        ['Promotores (9-10)', $npsData['promotores']],
        ['Neutros (7-8)', $npsData['neutros']],
        ['Detratores (0-6)', $npsData['detratores']],
        ['Score NPS', number_format($scoreNPS, 1) . '%']
    ];
    
    foreach ($dadosNPS as $dado) {
        $sheet->setCellValue('A' . $currentRow, $dado[0]);
        $sheet->setCellValue('B' . $currentRow, $dado[1]);
        $currentRow++;
    }
    
    aplicarEstiloDados($sheet, 'A' . ($currentRow - count($dadosNPS)) . ':B' . ($currentRow - 1));
    $currentRow += 2;
    
        // Score de Vendedores (migrado para pedidos_vendas)
        $vendedorQuery = "SELECT 
                            pv.codusur AS vendedor,
                            COALESCE(v.nome, pv.nome) AS nome_vendedor,
                            COUNT(DISTINCT c.id) AS total_envios,
                            COUNT(DISTINCT r.id) AS total_respostas,
                            AVG(r.nota_nps) AS nota_media,
                            SUM(CASE WHEN r.classificacao_nps = 'promotor' THEN 1 ELSE 0 END) AS promotores,
                            SUM(CASE WHEN r.classificacao_nps = 'neutro' THEN 1 ELSE 0 END) AS neutros,
                            SUM(CASE WHEN r.classificacao_nps = 'detrator' THEN 1 ELSE 0 END) AS detratores
                          FROM controle_envios_nps c
                          INNER JOIN pedidos_vendas pv ON c.numero_pedido = pv.numped
                          LEFT JOIN vendedores v ON pv.codusur = v.rca
                          LEFT JOIN respostas_nps r ON c.id = r.controle_envio_id AND r.pergunta_id IS NULL
                          WHERE DATE(c.data_cadastro) BETWEEN ? AND ?
                            AND pv.codusur IS NOT NULL
                            AND pv.codusur != ''";
    
    $vendedorParams = [$dataInicio, $dataFim];
    
    if ($filial) {
        $vendedorQuery .= " AND c.filial = ?";
        $vendedorParams[] = $filial;
    }
    
    if ($campanha) {
        $vendedorQuery .= " AND c.campanha_id = ?";
        $vendedorParams[] = $campanha;
    }
    
        $vendedorQuery .= " GROUP BY pv.codusur ORDER BY AVG(r.nota_nps) DESC, COUNT(DISTINCT r.id) DESC";
    
    $vendedorStmt = $db->prepare($vendedorQuery);
    $vendedorStmt->execute($vendedorParams);
    $dadosVendedor = $vendedorStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calcular NPS por vendedor e adicionar ranking
    $ranking = 1;
    foreach ($dadosVendedor as &$vendedorData) {
        $totalRespostas = $vendedorData['total_respostas'];
        if ($totalRespostas > 0) {
            $percentualPromotores = ($vendedorData['promotores'] / $totalRespostas) * 100;
            $percentualDetratores = ($vendedorData['detratores'] / $totalRespostas) * 100;
            $vendedorData['score_nps'] = round($percentualPromotores - $percentualDetratores, 2);
            $vendedorData['percentual_promotores'] = round($percentualPromotores, 2);
            $vendedorData['percentual_neutros'] = round(($vendedorData['neutros'] / $totalRespostas) * 100, 2);
            $vendedorData['percentual_detratores'] = round($percentualDetratores, 2);
            $vendedorData['taxa_resposta'] = round(($totalRespostas / $vendedorData['total_envios']) * 100, 2);
        } else {
            $vendedorData['score_nps'] = 0;
            $vendedorData['percentual_promotores'] = 0;
            $vendedorData['percentual_neutros'] = 0;
            $vendedorData['percentual_detratores'] = 0;
            $vendedorData['taxa_resposta'] = 0;
        }
        $vendedorData['ranking'] = $ranking++;
        $vendedorData['nota_media'] = round($vendedorData['nota_media'], 2);
    }
    
    // Reordenar por score NPS (maior para menor)
    usort($dadosVendedor, function($a, $b) {
        if ($a['score_nps'] == $b['score_nps']) {
            // Se score NPS igual, ordenar por nota média
            if ($a['nota_media'] == $b['nota_media']) {
                // Se nota média igual, ordenar por total de respostas
                return $b['total_respostas'] - $a['total_respostas'];
            }
            return $b['nota_media'] <=> $a['nota_media'];
        }
        return $b['score_nps'] <=> $a['score_nps'];
    });
    
    // Reajustar ranking após ordenação
    $ranking = 1;
    foreach ($dadosVendedor as &$vendedorData) {
        $vendedorData['ranking'] = $ranking++;
    }
    
    if (count($dadosVendedor) > 0) {
        $sheet->setCellValue('A' . $currentRow, 'SCORE POR VENDEDOR');
        $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
        aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':I' . $currentRow);
        $currentRow++;
        
        // Cabeçalhos
        $sheet->setCellValue('A' . $currentRow, 'Ranking');
        $sheet->setCellValue('B' . $currentRow, 'Código');
        $sheet->setCellValue('C' . $currentRow, 'Nome do Vendedor');
        $sheet->setCellValue('D' . $currentRow, 'Envios');
        $sheet->setCellValue('E' . $currentRow, 'Respostas');
        $sheet->setCellValue('F' . $currentRow, 'Taxa de Resposta');
        $sheet->setCellValue('G' . $currentRow, 'Nota Média');
        $sheet->setCellValue('H' . $currentRow, 'Promotores');
        $sheet->setCellValue('I' . $currentRow, 'Neutros');
        $sheet->setCellValue('J' . $currentRow, 'Detratores');
        $sheet->setCellValue('K' . $currentRow, 'Score NPS');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':K' . $currentRow);
        $currentRow++;
        
        $startDataRow = $currentRow;
        foreach ($dadosVendedor as $vendedorData) {
            $sheet->setCellValue('A' . $currentRow, $vendedorData['ranking']);
            $sheet->setCellValue('B' . $currentRow, $vendedorData['vendedor']);
            $sheet->setCellValue('C' . $currentRow, $vendedorData['nome_vendedor'] ?? $vendedorData['vendedor']);
            $sheet->setCellValue('D' . $currentRow, $vendedorData['total_envios']);
            $sheet->setCellValue('E' . $currentRow, $vendedorData['total_respostas']);
            $sheet->setCellValue('F' . $currentRow, number_format($vendedorData['taxa_resposta'], 2) . '%');
            $sheet->setCellValue('G' . $currentRow, $vendedorData['nota_media']);
            $sheet->setCellValue('H' . $currentRow, $vendedorData['promotores'] . ' (' . number_format($vendedorData['percentual_promotores'], 2) . '%)');
            $sheet->setCellValue('I' . $currentRow, $vendedorData['neutros'] . ' (' . number_format($vendedorData['percentual_neutros'], 2) . '%)');
            $sheet->setCellValue('J' . $currentRow, $vendedorData['detratores'] . ' (' . number_format($vendedorData['percentual_detratores'], 2) . '%)');
            $sheet->setCellValue('K' . $currentRow, number_format($vendedorData['score_nps'], 2) . '%');
            $currentRow++;
        }
        
        aplicarEstiloDados($sheet, 'A' . $startDataRow . ':K' . ($currentRow - 1));
        $currentRow += 2;
    }
    
    // Dados por Filial (se não filtrado por filial específica)
    if (!$filial) {
        $filialQuery = "SELECT 
                            c.filial,
                            f.nome_fantasia as nome_filial,
                            COUNT(c.id) as total_envios,
                            COUNT(r.id) as total_respostas,
                            AVG(r.nota_nps) as nota_media,
                            SUM(CASE WHEN r.nota_nps >= 9 THEN 1 ELSE 0 END) as promotores,
                            SUM(CASE WHEN r.nota_nps <= 6 THEN 1 ELSE 0 END) as detratores
                        FROM controle_envios_nps c
                        LEFT JOIN respostas_nps r ON r.controle_envio_id = c.id
                        LEFT JOIN filiais f ON f.id = c.filial
                        WHERE DATE(c.data_cadastro) BETWEEN ? AND ?";
        
        $filialParams = [$dataInicio, $dataFim];
        
        if ($campanha) {
            $filialQuery .= " AND c.campanha_id = ?";
            $filialParams[] = $campanha;
        }
        
        $filialQuery .= " GROUP BY c.filial, f.nome_fantasia ORDER BY c.filial";
        
        $filialStmt = $db->prepare($filialQuery);
        $filialStmt->execute($filialParams);
        $dadosFilial = $filialStmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($dadosFilial) > 0) {
            $sheet->setCellValue('A' . $currentRow, 'DETALHAMENTO POR FILIAL');
            $sheet->mergeCells('A' . $currentRow . ':H' . $currentRow);
            aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':H' . $currentRow);
            $currentRow++;
            
            // Cabeçalhos
            $sheet->setCellValue('A' . $currentRow, 'Filial');
            $sheet->setCellValue('B' . $currentRow, 'Nome');
            $sheet->setCellValue('C' . $currentRow, 'Envios');
            $sheet->setCellValue('D' . $currentRow, 'Respostas');
            $sheet->setCellValue('E' . $currentRow, 'Nota Média');
            $sheet->setCellValue('F' . $currentRow, 'Promotores');
            $sheet->setCellValue('G' . $currentRow, 'Detratores');
            $sheet->setCellValue('H' . $currentRow, 'Score NPS');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':H' . $currentRow);
            $currentRow++;
            
            $startDataRow = $currentRow;
            foreach ($dadosFilial as $filialData) {
                $scoreFilial = 0;
                if ($filialData['total_respostas'] > 0) {
                    $percentualPromotores = ($filialData['promotores'] / $filialData['total_respostas']) * 100;
                    $percentualDetratores = ($filialData['detratores'] / $filialData['total_respostas']) * 100;
                    $scoreFilial = $percentualPromotores - $percentualDetratores;
                }
                
                $sheet->setCellValue('A' . $currentRow, $filialData['filial']);
                $sheet->setCellValue('B' . $currentRow, $filialData['nome_filial'] ?? 'N/A');
                $sheet->setCellValue('C' . $currentRow, $filialData['total_envios']);
                $sheet->setCellValue('D' . $currentRow, $filialData['total_respostas']);
                $sheet->setCellValue('E' . $currentRow, number_format($filialData['nota_media'] ?? 0, 2));
                $sheet->setCellValue('F' . $currentRow, $filialData['promotores']);
                $sheet->setCellValue('G' . $currentRow, $filialData['detratores']);
                $sheet->setCellValue('H' . $currentRow, number_format($scoreFilial, 1) . '%');
                $currentRow++;
            }
            
            aplicarEstiloDados($sheet, 'A' . $startDataRow . ':H' . ($currentRow - 1));
            $currentRow++;
        }
    }
    
    // Dados por Campanha (se não filtrado por campanha específica)
    if (!$campanha) {
        $campanhaQuery = "SELECT 
                            c.campanha_id,
                            cn.nome as nome_campanha,
                            COUNT(c.id) as total_envios,
                            COUNT(r.id) as total_respostas,
                            AVG(r.nota_nps) as nota_media,
                            SUM(CASE WHEN r.nota_nps >= 9 THEN 1 ELSE 0 END) as promotores,
                            SUM(CASE WHEN r.nota_nps <= 6 THEN 1 ELSE 0 END) as detratores
                        FROM controle_envios_nps c
                        LEFT JOIN respostas_nps r ON r.controle_envio_id = c.id
                        LEFT JOIN campanhas_nps cn ON cn.id = c.campanha_id
                        WHERE DATE(c.data_cadastro) BETWEEN ? AND ?";
        
        $campanhaParams = [$dataInicio, $dataFim];
        
        if ($filial) {
            $campanhaQuery .= " AND c.filial = ?";
            $campanhaParams[] = $filial;
        }
        
        $campanhaQuery .= " GROUP BY c.campanha_id, cn.nome ORDER BY cn.nome";
        
        $campanhaStmt = $db->prepare($campanhaQuery);
        $campanhaStmt->execute($campanhaParams);
        $dadosCampanha = $campanhaStmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($dadosCampanha) > 0) {
            $sheet->setCellValue('A' . $currentRow, 'DETALHAMENTO POR CAMPANHA');
            $sheet->mergeCells('A' . $currentRow . ':H' . $currentRow);
            aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':H' . $currentRow);
            $currentRow++;
            
            // Cabeçalhos
            $sheet->setCellValue('A' . $currentRow, 'ID');
            $sheet->setCellValue('B' . $currentRow, 'Nome da Campanha');
            $sheet->setCellValue('C' . $currentRow, 'Envios');
            $sheet->setCellValue('D' . $currentRow, 'Respostas');
            $sheet->setCellValue('E' . $currentRow, 'Nota Média');
            $sheet->setCellValue('F' . $currentRow, 'Promotores');
            $sheet->setCellValue('G' . $currentRow, 'Detratores');
            $sheet->setCellValue('H' . $currentRow, 'Score NPS');
            aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':H' . $currentRow);
            $currentRow++;
            
            $startDataRow = $currentRow;
            foreach ($dadosCampanha as $campanhaData) {
                $scoreCampanha = 0;
                if ($campanhaData['total_respostas'] > 0) {
                    $percentualPromotores = ($campanhaData['promotores'] / $campanhaData['total_respostas']) * 100;
                    $percentualDetratores = ($campanhaData['detratores'] / $campanhaData['total_respostas']) * 100;
                    $scoreCampanha = $percentualPromotores - $percentualDetratores;
                }
                
                $sheet->setCellValue('A' . $currentRow, $campanhaData['campanha_id']);
                $sheet->setCellValue('B' . $currentRow, $campanhaData['nome_campanha'] ?? 'N/A');
                $sheet->setCellValue('C' . $currentRow, $campanhaData['total_envios']);
                $sheet->setCellValue('D' . $currentRow, $campanhaData['total_respostas']);
                $sheet->setCellValue('E' . $currentRow, number_format($campanhaData['nota_media'] ?? 0, 2));
                $sheet->setCellValue('F' . $currentRow, $campanhaData['promotores']);
                $sheet->setCellValue('G' . $currentRow, $campanhaData['detratores']);
                $sheet->setCellValue('H' . $currentRow, number_format($scoreCampanha, 1) . '%');
                $currentRow++;
            }
            
            aplicarEstiloDados($sheet, 'A' . $startDataRow . ':H' . ($currentRow - 1));
            $currentRow += 2;
        }
    }
    
    // Respostas Detalhadas
    $respostasQuery = "SELECT 
                        r.id,
                        r.resposta_texto,
                        r.nota_nps,
                        CASE 
                            WHEN r.nota_nps >= 9 THEN 'Promotor'
                            WHEN r.nota_nps >= 7 THEN 'Neutro'
                            ELSE 'Detrator'
                        END as classificacao,
                        DATE_FORMAT(r.data_resposta, '%d/%m/%Y %H:%i') as data_resposta,
                        c.nome_cliente,
                        c.celular,
                        c.filial,
                        c.pedido_id,
                        cn.nome as campanha_nome
                       FROM respostas_nps r
                       INNER JOIN controle_envios_nps c ON r.controle_envio_id = c.id
                       LEFT JOIN campanhas_nps cn ON cn.id = c.campanha_id
                       WHERE DATE(r.data_resposta) BETWEEN ? AND ?";
    
    $respostasParams = [$dataInicio, $dataFim];
    
    if ($filial) {
        $respostasQuery .= " AND c.filial = ?";
        $respostasParams[] = $filial;
    }
    
    if ($campanha) {
        $respostasQuery .= " AND c.campanha_id = ?";
        $respostasParams[] = $campanha;
    }
    
    $respostasQuery .= " ORDER BY r.data_resposta DESC LIMIT 1000";
    
    $respostasStmt = $db->prepare($respostasQuery);
    $respostasStmt->execute($respostasParams);
    $respostas = $respostasStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($respostas) > 0) {
        $sheet->setCellValue('A' . $currentRow, 'RESPOSTAS DETALHADAS (Últimas 1000)');
        $sheet->mergeCells('A' . $currentRow . ':I' . $currentRow);
        aplicarEstiloTitulo($sheet, 'A' . $currentRow . ':I' . $currentRow);
        $currentRow++;
        
        // Cabeçalhos
        $sheet->setCellValue('A' . $currentRow, 'ID');
        $sheet->setCellValue('B' . $currentRow, 'Cliente');
        $sheet->setCellValue('C' . $currentRow, 'Telefone');
        $sheet->setCellValue('D' . $currentRow, 'Filial');
        $sheet->setCellValue('E' . $currentRow, 'Pedido ID');
        $sheet->setCellValue('F' . $currentRow, 'Campanha');
        $sheet->setCellValue('G' . $currentRow, 'Nota');
        $sheet->setCellValue('H' . $currentRow, 'Classificação');
        $sheet->setCellValue('I' . $currentRow, 'Resposta');
        $sheet->setCellValue('J' . $currentRow, 'Data');
        aplicarEstiloCabecalho($sheet, 'A' . $currentRow . ':J' . $currentRow);
        $currentRow++;
        
        $startDataRow = $currentRow;
        foreach ($respostas as $resposta) {
            $sheet->setCellValue('A' . $currentRow, $resposta['id']);
            $sheet->setCellValue('B' . $currentRow, $resposta['nome_cliente']);
            $sheet->setCellValue('C' . $currentRow, $resposta['celular']);
            $sheet->setCellValue('D' . $currentRow, $resposta['filial']);
            $sheet->setCellValue('E' . $currentRow, $resposta['pedido_id']);
            $sheet->setCellValue('F' . $currentRow, $resposta['campanha_nome']);
            $sheet->setCellValue('G' . $currentRow, $resposta['nota_nps']);
            $sheet->setCellValue('H' . $currentRow, $resposta['classificacao']);
            $sheet->setCellValue('I' . $currentRow, $resposta['resposta_texto']);
            $sheet->setCellValue('J' . $currentRow, $resposta['data_resposta']);
            $currentRow++;
        }
        
        aplicarEstiloDados($sheet, 'A' . $startDataRow . ':J' . ($currentRow - 1));
    }
    
    // Ajustar largura das colunas
    foreach (range('A', 'J') as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }
    
    // Criar arquivo temporário
    $temp_file = tempnam(sys_get_temp_dir(), 'relatorio_nps_') . '.xlsx';
    $writer = new Xlsx($spreadsheet);
    $writer->save($temp_file);
    
    // Verificar se o arquivo foi criado corretamente
    if (!file_exists($temp_file) || filesize($temp_file) < 100) {
        throw new Exception("Erro ao criar arquivo Excel temporário");
    }
    
    // Limpar buffer de saída
    ob_end_clean();
    
    // Definir headers para download
    $filename = 'relatorio_nps_' . date('Y-m-d_H-i-s') . '.xlsx';
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($temp_file));
    header('Cache-Control: max-age=0');
    header('Cache-Control: max-age=1');
    header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
    header('Cache-Control: cache, must-revalidate');
    header('Pragma: public');
    
    // Enviar arquivo
    readfile($temp_file);
    
    // Limpar memória e remover arquivo temporário
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    @unlink($temp_file);
    
} catch (Exception $e) {
    // Limpar buffer de saída em caso de erro
    ob_end_clean();
    
    // Log do erro
    error_log("Erro ao exportar relatório NPS: " . $e->getMessage());
    
    // Retornar erro em JSON
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode([
        'success' => false, 
        'message' => 'Erro ao gerar relatório: ' . $e->getMessage()
    ]);
}
?>
