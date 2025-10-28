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

    switch ($method) {
        case 'GET':
            if (isset($_GET['action'])) {
                switch ($_GET['action']) {
                    case 'novos_pedidos':
                        buscarNovosPedidos($db);
                        break;
                    case 'pedidos_nps':
                        buscarPedidosParaNPS($db);
                        break;
                    default:
                        listarPedidos($db);
                }
            } else {
                listarPedidos($db);
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}

function listarPedidos($db) {
    try {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        $query = "SELECT 
                    p.NUMPED,
                    p.DATA,
                    p.CODCLI,
                    p.CLIENTE,
                    p.CODFILIAL,
                    p.VLTOTAL,
                    p.POSICAO,
                    c.TELCELENT,
                    c.EMAIL
                  FROM PCPEDC p
                  LEFT JOIN PCCLIENT c ON p.CODCLI = c.CODCLI
                  WHERE p.POSICAO = 'F'
                  ORDER BY p.DATA DESC, p.NUMPED DESC
                  LIMIT ? OFFSET ?";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$limit, $offset]);
        
        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $pedidos,
            'total' => count($pedidos)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao listar pedidos: ' . $e->getMessage()]);
    }
}

function buscarNovosPedidos($db) {
    try {
        // Buscar pedidos finalizados nas últimas 24 horas que ainda não foram processados para NPS
        $query = "SELECT 
                    p.NUMPED,
                    p.DATA,
                    p.CODCLI,
                    p.CLIENTE,
                    p.CODFILIAL,
                    p.VLTOTAL,
                    c.TELCELENT,
                    c.EMAIL
                  FROM PCPEDC p
                  LEFT JOIN PCCLIENT c ON p.CODCLI = c.CODCLI
                  WHERE p.POSICAO = 'F'
                    AND p.DATA >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    AND NOT EXISTS (
                        SELECT 1 FROM controle_envios_nps ce 
                        WHERE ce.codcli = p.CODCLI 
                        AND ce.numero_pedido = p.NUMPED
                    )
                  ORDER BY p.DATA DESC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $pedidos,
            'total' => count($pedidos)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao buscar novos pedidos: ' . $e->getMessage()]);
    }
}

function buscarPedidosParaNPS($db) {
    try {
        // Buscar pedidos que precisam de envio de NPS baseado nas campanhas ativas
        $query = "SELECT DISTINCT
                    p.NUMPED,
                    p.DATA,
                    p.CODCLI,
                    p.CLIENTE,
                    p.CODFILIAL,
                    p.VLTOTAL,
                    c.TELCELENT,
                    c.EMAIL,
                    cn.id as campanha_id,
                    cn.nome as campanha_nome,
                    cn.dias_apos_compra,
                    cn.instancia_id
                  FROM PCPEDC p
                  LEFT JOIN PCCLIENT c ON p.CODCLI = c.CODCLI
                  INNER JOIN campanhas_nps cn ON (
                    cn.status = 'ativa'
                    AND (cn.data_inicio IS NULL OR cn.data_inicio <= CURDATE())
                    AND (cn.data_fim IS NULL OR cn.data_fim >= CURDATE())
                    AND (
                      cn.filiais_ativas IS NULL 
                      OR cn.filiais_ativas = '[]' 
                      OR JSON_CONTAINS(cn.filiais_ativas, CAST(p.CODFILIAL AS JSON))
                    )
                  )
                  WHERE p.POSICAO = 'F'
                    AND c.TELCELENT IS NOT NULL
                    AND c.TELCELENT != ''
                    AND (
                      (cn.dias_apos_compra = 0 AND p.DATA >= DATE_SUB(NOW(), INTERVAL 1 HOUR))
                      OR 
                      (cn.dias_apos_compra > 0 AND DATE(p.DATA) = DATE_SUB(CURDATE(), INTERVAL cn.dias_apos_compra DAY))
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM controle_envios_nps ce 
                        WHERE ce.codcli = p.CODCLI 
                        AND ce.campanha_id = cn.id
                        AND ce.numero_pedido = p.NUMPED
                    )
                  ORDER BY p.DATA DESC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $pedidos,
            'total' => count($pedidos)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao buscar pedidos para NPS: ' . $e->getMessage()]);
    }
}
?>
