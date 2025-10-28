<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

    // Obter dados do corpo da requisição
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Dados inválidos']);
        exit;
    }

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se a instância existe
    $checkQuery = "SELECT id FROM instancias_whatsapp WHERE id = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->execute([$id]);
    
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Instância não encontrada']);
        exit;
    }
    
    // Preparar campos para atualização
    $updateFields = [];
    $updateValues = [];
    
    if (isset($input['status_conexao'])) {
        $updateFields[] = 'status_conexao = ?';
        $updateValues[] = $input['status_conexao'];
    }
    
    if (isset($input['qrcode'])) {
        $updateFields[] = 'qrcode = ?';
        $updateValues[] = $input['qrcode'];
    }
    
    if (isset($input['session_path'])) {
        $updateFields[] = 'session_path = ?';
        $updateValues[] = $input['session_path'];
    }
    
    if (isset($input['ultima_conexao'])) {
        $updateFields[] = 'ultima_conexao = ?';
        $updateValues[] = $input['ultima_conexao'];
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nenhum campo para atualizar']);
        exit;
    }
    
    // Adicionar data_atualizacao
    $updateFields[] = 'data_atualizacao = NOW()';
    $updateValues[] = $id;
    
    // Executar atualização
    $updateQuery = "UPDATE instancias_whatsapp SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->execute($updateValues);
    
    echo json_encode([
        'success' => true,
        'message' => 'Status da instância atualizado com sucesso'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
