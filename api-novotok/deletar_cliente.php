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
$authHeader = null;

// Verificar se o cabeçalho Authorization existe (com diferentes casos)
foreach ($headers as $key => $value) {
    $lowerKey = strtolower($key);
    if ($lowerKey === 'authorization') {
        $authHeader = $value;
        break;
    }
}

if (!$authHeader) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $authHeader);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);

    // Verificar se o ID foi fornecido
    if (!isset($data['id']) || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID do cliente não fornecido']);
        exit;
    }

    $cliente_id = $data['id'];

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Verificar se o cliente existe
    $stmt = $conn->prepare("SELECT id, name, person_identification_number FROM clientes WHERE id = :id LIMIT 1");
    $stmt->bindParam(':id', $cliente_id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Cliente não encontrado']);
        exit;
    }

    $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

    // Deletar o cliente
    $stmt = $conn->prepare("DELETE FROM clientes WHERE id = :id");
    $stmt->bindParam(':id', $cliente_id);
    
    if ($stmt->execute()) {
        // Registrar log da operação
        error_log("Cliente deletado: ID=$cliente_id, Nome={$cliente['name']}, CPF/CNPJ={$cliente['person_identification_number']}");
        
        echo json_encode([
            'success' => true,
            'message' => 'Cliente deletado com sucesso',
            'id' => $cliente_id
        ]);
    } else {
        throw new Exception('Erro ao deletar cliente');
    }

} catch (PDOException $e) {
    error_log("Erro PDO ao deletar cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao deletar cliente: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao deletar cliente: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 