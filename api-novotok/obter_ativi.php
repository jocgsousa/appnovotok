<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Verifica se a requisição é do tipo GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Obtém o bearer_token do cabeçalho Authorization
    $headers = apache_request_headers();
    $bearer_token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    // Valida o bearer_token
    $user_id = JwtUtils::validateToken($bearer_token);
    if ($user_id === null) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido.']);
        exit;
    }

    // Verifica se o ID foi fornecido
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID da atividade é obrigatório e deve ser numérico.']);
        exit;
    }

    $id = $_GET['id'];

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Consulta a atividade pelo ID
    $sql = "SELECT id, codativi, ramo, created_at, updated_at FROM pcativi WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);
    $stmt->execute();

    // Verifica se a atividade foi encontrada
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Atividade não encontrada.']);
        exit;
    }

    // Obtém os dados da atividade
    $atividade = $stmt->fetch(PDO::FETCH_ASSOC);

    // Retorna os dados da atividade
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'atividade' => [
            'id' => (int)$atividade['id'],
            'codativi' => $atividade['codativi'],
            'ramo' => $atividade['ramo'],
            'created_at' => $atividade['created_at'],
            'updated_at' => $atividade['updated_at']
        ]
    ]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use GET.']);
}
?> 