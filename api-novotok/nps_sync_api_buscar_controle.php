<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

try {
    // Verificar autenticação JWT
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de acesso requerido']);
        exit;
    }
    
    $token = $matches[1];
    $decoded = JwtUtils::validateToken($token);
    
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Obter parâmetros da query string
    $pedidoId = $_GET['pedido_id'] ?? null;
    $campanhaId = $_GET['campanha_id'] ?? null;
    $controleId = $_GET['controle_id'] ?? null;
    
    // Validar parâmetros - deve ter ou (pedido_id + campanha_id) ou controle_id
    if (!$controleId && (!$pedidoId || !$campanhaId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Parâmetros obrigatórios: (pedido_id + campanha_id) OU controle_id']);
        exit;
    }

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Buscar controle de envio
    if ($controleId) {
        // Busca por ID do controle
        $query = "SELECT id, instancia_id, pedido_id, numero_pedido, filial, caixa, codcli, celular, 
                         campanha_id, status_envio, data_envio, data_cadastro
                  FROM controle_envios_nps 
                  WHERE id = ?";
        $stmt = $conn->prepare($query);
        $stmt->execute([$controleId]);
    } else {
        // Busca por pedido_id + campanha_id (método original)
        $query = "SELECT id, instancia_id, pedido_id, numero_pedido, filial, caixa, codcli, celular, 
                         campanha_id, status_envio, data_envio, data_cadastro
                  FROM controle_envios_nps 
                  WHERE pedido_id = ? AND campanha_id = ?";
        $stmt = $conn->prepare($query);
        $stmt->execute([$pedidoId, $campanhaId]);
    }
    
    $controle = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($controle) {
        echo json_encode([
            'success' => true,
            'controle' => $controle
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Controle de envio não encontrado'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
