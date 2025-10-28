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
    
    // Verificar se o ID foi fornecido
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID não fornecido']);
        exit;
    }
    
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se o registro existe
    $stmt = $conn->prepare("SELECT COUNT(*) FROM vendas_diarias WHERE id = :id");
    $stmt->execute(['id' => $data['id']]);
    
    if ($stmt->fetchColumn() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Registro não encontrado']);
        exit;
    }
    
    // Deletar o registro
    $stmt = $conn->prepare("DELETE FROM vendas_diarias WHERE id = :id");
    $stmt->execute(['id' => $data['id']]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Venda diária excluída com sucesso',
        'rows_affected' => $stmt->rowCount()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao excluir venda diária: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 