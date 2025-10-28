<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Consultar configurações
    $sql = "SELECT * FROM config_cadastro_clientes ORDER BY id DESC LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        // Se não existir configuração, criar uma padrão
        $sqlInsert = "INSERT INTO config_cadastro_clientes (timer, automatic) VALUES (3000, 0)";
        $conn->exec($sqlInsert);
        
        // Consultar novamente
        $stmt = $conn->prepare($sql);
        $stmt->execute();
    }

    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Formatar resposta
    $configFormatada = [
        'id' => (int)$config['id'],
        'timer' => (int)$config['timer'],
        'automatic' => (bool)$config['automatic'],
        'created_at' => $config['created_at'],
        'updated_at' => $config['updated_at']
    ];

    echo json_encode([
        'success' => true,
        'config' => $configFormatada
    ]);

} catch (PDOException $e) {
    error_log("Erro PDO ao obter configurações: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao obter configurações: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 