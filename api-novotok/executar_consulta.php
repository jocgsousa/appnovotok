<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se a consulta SQL foi fornecida
    if (!isset($data['query']) || empty($data['query'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Consulta SQL não fornecida']);
        exit;
    }
    
    // Validar a consulta SQL (permitir apenas SELECT)
    $query = trim($data['query']);
    if (!preg_match('/^SELECT\s/i', $query)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Apenas consultas SELECT são permitidas']);
        exit;
    }
    
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Executar a consulta
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    // Obter resultados
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'Consulta executada com sucesso',
        'result' => $result
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao executar consulta: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 