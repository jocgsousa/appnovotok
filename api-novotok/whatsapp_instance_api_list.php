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

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se há filtros
    $status = $_GET['status'] ?? null;
    $ids = $_GET['ids'] ?? null;
    
    if ($ids) {
        // Verificar IDs existentes
        $idsArray = explode(',', $ids);
        $placeholders = str_repeat('?,', count($idsArray) - 1) . '?';
        $query = "SELECT id FROM instancias_whatsapp WHERE id IN ($placeholders)";
        $stmt = $conn->prepare($query);
        $stmt->execute($idsArray);
        
        $existingIds = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $existingIds[] = (int)$row['id'];
        }
        
        echo json_encode([
            'success' => true,
            'existing_ids' => $existingIds
        ]);
        exit;
    }
    
    // Listar instâncias
    $query = "SELECT * FROM instancias_whatsapp";
    $params = [];
    
    if ($status) {
        $query .= " WHERE status = ?";
        $params[] = $status;
    }
    
    $query .= " ORDER BY id ASC";
    
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    
    $instances = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $instances[] = [
            'id' => (int)$row['id'],
            'nome' => $row['nome'],
            'identificador' => $row['identificador'],
            'url_webhook' => $row['url_webhook'],
            'token_api' => $row['token_api'],
            'numero_whatsapp' => $row['numero_whatsapp'],
            'status' => $row['status'],
            'status_conexao' => $row['status_conexao'],
            'qrcode' => $row['qrcode'],
            'session_path' => $row['session_path'],
            'max_envios_por_minuto' => (int)$row['max_envios_por_minuto'],
            'timeout_conversa_minutos' => (int)$row['timeout_conversa_minutos'],
            'data_cadastro' => $row['data_cadastro'],
            'data_atualizacao' => $row['data_atualizacao'],
            'ultima_conexao' => $row['ultima_conexao']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $instances
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
