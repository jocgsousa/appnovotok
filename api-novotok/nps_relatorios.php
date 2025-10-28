<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        
        switch ($action) {
            case 'dashboard':
                obterDashboard($db);
                break;
            case 'metricas':
                obterMetricas($db);
                break;
            case 'respostas':
                obterRespostas($db);
                break;
            case 'conversas':
                obterConversas($db);
                break;
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Ação não especificada']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Método não permitido']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}

function obterDashboard($db) {
    try {
        $dataInicio = $_GET['data_inicio'] ?? date('Y-m-01');
        $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
        $filial = $_GET['filial'] ?? null;
        $campanha = $_GET['campanha'] ?? null;
        $instancia = $_GET['instancia'] ?? null;
        
        // Estatísticas gerais
        $statsQuery = "SELECT 
                        COUNT(*) as total_envios,
                        CAST(SUM(CASE WHEN status_envio = 'enviado' THEN 1 ELSE 0 END) AS UNSIGNED) as enviados,
                        CAST(SUM(CASE WHEN status_envio = 'finalizado' OR EXISTS (
                            SELECT 1 FROM respostas_nps r
                            WHERE r.controle_envio_id = c.id
                        ) THEN 1 ELSE 0 END) AS UNSIGNED) as finalizados,
                        CAST(SUM(CASE WHEN status_envio = 'cancelado' THEN 1 ELSE 0 END) AS UNSIGNED) as cancelados,
                        CAST(SUM(CASE WHEN status_envio = 'erro' THEN 1 ELSE 0 END) AS UNSIGNED) as erros
                       FROM controle_envios_nps c
                       WHERE DATE(c.data_cadastro) BETWEEN ? AND ?";
        
        $params = [$dataInicio, $dataFim];
        
        if ($filial) {
            $statsQuery .= " AND filial = ?";
            $params[] = $filial;
        }
        
        if ($campanha) {
            $statsQuery .= " AND campanha_id = ?";
            $params[] = $campanha;
        }
        
        if ($instancia) {
            $statsQuery .= " AND instancia_id = ?";
            $params[] = $instancia;
        }
        
        $statsStmt = $db->prepare($statsQuery);
        $statsStmt->execute($params);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
        
        // Métricas NPS
        $npsQuery = "SELECT 
                        COUNT(*) as total_respostas,
                        AVG(nota_nps) as nota_media,
                        SUM(CASE WHEN classificacao_nps = 'promotor' THEN 1 ELSE 0 END) as promotores,
                        SUM(CASE WHEN classificacao_nps = 'neutro' THEN 1 ELSE 0 END) as neutros,
                        SUM(CASE WHEN classificacao_nps = 'detrator' THEN 1 ELSE 0 END) as detratores
                     FROM respostas_nps r
                     INNER JOIN controle_envios_nps c ON r.controle_envio_id = c.id
                     WHERE DATE(r.data_resposta) BETWEEN ? AND ?
                       AND r.pergunta_id IS NULL";
        
        $npsParams = [$dataInicio, $dataFim];
        
        if ($filial) {
            $npsQuery .= " AND c.filial = ?";
            $npsParams[] = $filial;
        }
        
        if ($campanha) {
            $npsQuery .= " AND c.campanha_id = ?";
            $npsParams[] = $campanha;
        }
        
        if ($instancia) {
            $npsQuery .= " AND c.instancia_id = ?";
            $npsParams[] = $instancia;
        }
        
        $npsStmt = $db->prepare($npsQuery);
        $npsStmt->execute($npsParams);
        $npsData = $npsStmt->fetch(PDO::FETCH_ASSOC);
        
        // Calcular score NPS
        $scoreNPS = 0;
        if ($npsData['total_respostas'] > 0) {
            $percentualPromotores = ($npsData['promotores'] / $npsData['total_respostas']) * 100;
            $percentualDetratores = ($npsData['detratores'] / $npsData['total_respostas']) * 100;
            $scoreNPS = round($percentualPromotores - $percentualDetratores, 2);
        }
        
        // Dados por filial
        $filialQuery = "SELECT 
                            c.filial,
                            COUNT(DISTINCT c.id) as total_envios,
                            COUNT(DISTINCT r.id) as total_respostas,
                            AVG(r.nota_nps) as nota_media,
                            SUM(CASE WHEN r.classificacao_nps = 'promotor' THEN 1 ELSE 0 END) as promotores,
                            SUM(CASE WHEN r.classificacao_nps = 'detrator' THEN 1 ELSE 0 END) as detratores
                        FROM controle_envios_nps c
                        LEFT JOIN respostas_nps r ON c.id = r.controle_envio_id AND r.pergunta_id IS NULL
                        WHERE DATE(c.data_cadastro) BETWEEN ? AND ?";
        
        $filialParams = [$dataInicio, $dataFim];
        
        if ($filial) {
            $filialQuery .= " AND c.filial = ?";
            $filialParams[] = $filial;
        }
        
        if ($campanha) {
            $filialQuery .= " AND c.campanha_id = ?";
            $filialParams[] = $campanha;
        }
        
        if ($instancia) {
            $filialQuery .= " AND c.instancia_id = ?";
            $filialParams[] = $instancia;
        }
        
        $filialQuery .= " GROUP BY c.filial ORDER BY c.filial";
        
        $filialStmt = $db->prepare($filialQuery);
        $filialStmt->execute($filialParams);
        $dadosFilial = $filialStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calcular NPS por filial
        foreach ($dadosFilial as &$filialData) {
            $totalRespostas = $filialData['total_respostas'];
            if ($totalRespostas > 0) {
                $percentualPromotores = ($filialData['promotores'] / $totalRespostas) * 100;
                $percentualDetratores = ($filialData['detratores'] / $totalRespostas) * 100;
                $filialData['score_nps'] = round($percentualPromotores - $percentualDetratores, 2);
            } else {
                $filialData['score_nps'] = 0;
            }
        }
        
        // Dados por campanha
        $campanhaQuery = "SELECT 
                            c.campanha_id,
                            camp.nome as campanha_nome,
                            COUNT(DISTINCT c.id) as total_envios,
                            COUNT(DISTINCT r.id) as total_respostas,
                            AVG(r.nota_nps) as nota_media,
                            SUM(CASE WHEN r.classificacao_nps = 'promotor' THEN 1 ELSE 0 END) as promotores,
                            SUM(CASE WHEN r.classificacao_nps = 'detrator' THEN 1 ELSE 0 END) as detratores
                        FROM controle_envios_nps c
                        INNER JOIN campanhas_nps camp ON c.campanha_id = camp.id
                        LEFT JOIN respostas_nps r ON c.id = r.controle_envio_id AND r.pergunta_id IS NULL
                        WHERE DATE(c.data_cadastro) BETWEEN ? AND ?";
        
        $campanhaParams = [$dataInicio, $dataFim];
        
        if ($filial) {
            $campanhaQuery .= " AND c.filial = ?";
            $campanhaParams[] = $filial;
        }
        
        if ($campanha) {
            $campanhaQuery .= " AND c.campanha_id = ?";
            $campanhaParams[] = $campanha;
        }
        
        if ($instancia) {
            $campanhaQuery .= " AND c.instancia_id = ?";
            $campanhaParams[] = $instancia;
        }
        
        $campanhaQuery .= " GROUP BY c.campanha_id, camp.nome ORDER BY camp.nome";
        
        $campanhaStmt = $db->prepare($campanhaQuery);
        $campanhaStmt->execute($campanhaParams);
        $dadosCampanha = $campanhaStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calcular NPS por campanha
        foreach ($dadosCampanha as &$campanhaData) {
            $totalRespostas = $campanhaData['total_respostas'];
            if ($totalRespostas > 0) {
                $percentualPromotores = ($campanhaData['promotores'] / $totalRespostas) * 100;
                $percentualDetratores = ($campanhaData['detratores'] / $totalRespostas) * 100;
                $campanhaData['score_nps'] = round($percentualPromotores - $percentualDetratores, 2);
            } else {
                $campanhaData['score_nps'] = 0;
            }
        }
        
        // Score de Vendedores
        $vendedorQuery = "SELECT 
                            p.vendedor,
                            v.nome as nome_vendedor,
                            COUNT(DISTINCT c.id) as total_envios,
                            COUNT(DISTINCT r.id) as total_respostas,
                            AVG(r.nota_nps) as nota_media,
                            SUM(CASE WHEN r.classificacao_nps = 'promotor' THEN 1 ELSE 0 END) as promotores,
                            SUM(CASE WHEN r.classificacao_nps = 'neutro' THEN 1 ELSE 0 END) as neutros,
                            SUM(CASE WHEN r.classificacao_nps = 'detrator' THEN 1 ELSE 0 END) as detratores
                          FROM controle_envios_nps c
                          INNER JOIN pedidos p ON c.pedido_id = p.pedido
                          LEFT JOIN vendedores v ON p.vendedor = v.rca
                          LEFT JOIN respostas_nps r ON c.id = r.controle_envio_id AND r.pergunta_id IS NULL
                          WHERE DATE(c.data_cadastro) BETWEEN ? AND ?
                            AND p.vendedor IS NOT NULL
                            AND p.vendedor != ''";
        
        $vendedorParams = [$dataInicio, $dataFim];
        
        if ($filial) {
            $vendedorQuery .= " AND c.filial = ?";
            $vendedorParams[] = $filial;
        }
        
        if ($campanha) {
            $vendedorQuery .= " AND c.campanha_id = ?";
            $vendedorParams[] = $campanha;
        }
        
        if ($instancia) {
            $vendedorQuery .= " AND c.instancia_id = ?";
            $vendedorParams[] = $instancia;
        }
        
        $vendedorQuery .= " GROUP BY p.vendedor ORDER BY AVG(r.nota_nps) DESC, COUNT(DISTINCT r.id) DESC";
        
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
        
        echo json_encode([
            'success' => true,
            'data' => [
                'estatisticas' => $stats,
                'nps' => array_merge($npsData, ['score_nps' => $scoreNPS]),
                'por_filial' => $dadosFilial,
                'por_campanha' => $dadosCampanha,
                'por_vendedor' => $dadosVendedor
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao obter dashboard: ' . $e->getMessage()]);
    }
}

function obterMetricas($db) {
    try {
        $dataInicio = $_GET['data_inicio'] ?? date('Y-m-01');
        $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
        $filial = $_GET['filial'] ?? null;
        $campanha = $_GET['campanha'] ?? null;
        
        // Métricas detalhadas por período
        $query = "SELECT 
                    DATE(r.data_resposta) as data,
                    COUNT(*) as total_respostas,
                    AVG(r.nota_nps) as nota_media,
                    SUM(CASE WHEN r.classificacao_nps = 'promotor' THEN 1 ELSE 0 END) as promotores,
                    SUM(CASE WHEN r.classificacao_nps = 'neutro' THEN 1 ELSE 0 END) as neutros,
                    SUM(CASE WHEN r.classificacao_nps = 'detrator' THEN 1 ELSE 0 END) as detratores
                  FROM respostas_nps r
                  INNER JOIN controle_envios_nps c ON r.controle_envio_id = c.id
                  WHERE DATE(r.data_resposta) BETWEEN ? AND ?
                    AND r.pergunta_id IS NULL";
        
        $params = [$dataInicio, $dataFim];
        
        if ($filial) {
            $query .= " AND c.filial = ?";
            $params[] = $filial;
        }
        
        if ($campanha) {
            $query .= " AND c.campanha_id = ?";
            $params[] = $campanha;
        }
        
        $query .= " GROUP BY DATE(r.data_resposta) ORDER BY data";
        
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $metricas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calcular NPS para cada dia
        foreach ($metricas as &$metrica) {
            $totalRespostas = $metrica['total_respostas'];
            if ($totalRespostas > 0) {
                $percentualPromotores = ($metrica['promotores'] / $totalRespostas) * 100;
                $percentualDetratores = ($metrica['detratores'] / $totalRespostas) * 100;
                $metrica['score_nps'] = round($percentualPromotores - $percentualDetratores, 2);
            } else {
                $metrica['score_nps'] = 0;
            }
        }
        
        echo json_encode([
            'success' => true,
            'data' => $metricas
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao obter métricas: ' . $e->getMessage()]);
    }
}

function obterRespostas($db) {
    try {
        $dataInicio = $_GET['data_inicio'] ?? date('Y-m-01');
        $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
        $filial = $_GET['filial'] ?? null;
        $campanha = $_GET['campanha'] ?? null;
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 50);
        $offset = ($page - 1) * $limit;
        
        // Query principal para respostas
        $query = "SELECT 
                    r.id,
                    r.resposta_texto,
                    r.nota_nps,
                    r.classificacao_nps,
                    r.data_resposta,
                    c.nome_cliente,
                    c.celular,
                    c.filial,
                    c.numero_pedido,
                    camp.nome as campanha_nome
                  FROM respostas_nps r
                  INNER JOIN controle_envios_nps c ON r.controle_envio_id = c.id
                  INNER JOIN campanhas_nps camp ON c.campanha_id = camp.id
                  WHERE DATE(r.data_resposta) BETWEEN ? AND ?
                    AND r.pergunta_id IS NULL";
        
        $params = [$dataInicio, $dataFim];
        
        if ($filial) {
            $query .= " AND c.filial = ?";
            $params[] = $filial;
        }
        
        if ($campanha) {
            $query .= " AND c.campanha_id = ?";
            $params[] = $campanha;
        }
        
        $query .= " ORDER BY r.data_resposta DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $respostas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Query para contar total
        $countQuery = str_replace("SELECT r.id, r.resposta_texto, r.nota_nps, r.classificacao_nps, r.data_resposta, c.nome_cliente, c.celular, c.filial, c.numero_pedido, camp.nome as campanha_nome", "SELECT COUNT(*)", $query);
        $countQuery = str_replace(" LIMIT ? OFFSET ?", "", $countQuery);
        array_pop($params); // Remove offset
        array_pop($params); // Remove limit
        
        $countStmt = $db->prepare($countQuery);
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();
        
        echo json_encode([
            'success' => true,
            'data' => $respostas,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => (int)$total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao obter respostas: ' . $e->getMessage()]);
    }
}

function obterConversas($db) {
    try {
        $status = $_GET['status'] ?? 'todas';
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 50);
        $offset = ($page - 1) * $limit;
        
        $query = "SELECT 
                    c.id,
                    c.nome_cliente,
                    c.celular,
                    c.filial,
                    c.status_envio,
                    c.data_envio,
                    c.data_cadastro,
                    camp.nome as campanha_nome,
                    ec.aguardando_resposta,
                    ec.data_timeout,
                    CASE 
                        WHEN ec.data_timeout < NOW() THEN 'EXPIRADA'
                        WHEN ec.aguardando_resposta = TRUE THEN 'AGUARDANDO'
                        WHEN c.status_envio = 'finalizado' THEN 'FINALIZADA'
                        ELSE 'PROCESSANDO'
                    END as status_conversa
                  FROM controle_envios_nps c
                  INNER JOIN campanhas_nps camp ON c.campanha_id = camp.id
                  LEFT JOIN estado_conversa_nps ec ON c.id = ec.controle_envio_id
                  WHERE 1=1";
        
        $params = [];
        
        if ($status !== 'todas') {
            switch ($status) {
                case 'ativas':
                    $query .= " AND ec.aguardando_resposta = TRUE AND ec.data_timeout > NOW()";
                    break;
                case 'finalizadas':
                    $query .= " AND c.status_envio = 'finalizado'";
                    break;
                case 'expiradas':
                    $query .= " AND ec.data_timeout < NOW()";
                    break;
                case 'canceladas':
                    $query .= " AND c.status_envio = 'cancelado'";
                    break;
            }
        }
        
        $query .= " ORDER BY c.data_cadastro DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $conversas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $conversas
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao obter conversas: ' . $e->getMessage()]);
    }
}
?>
