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

    // Obter ID da URL
    $id = $_GET['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID da instância é obrigatório']);
        exit;
    }

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Buscar instância por ID
    $query = "SELECT * FROM instancias_whatsapp WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->execute([$id]);
    
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Instância não encontrada']);
        exit;
    }
    
    $instance = [
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
    
    echo json_encode([
        'success' => true,
        'data' => $instance
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
