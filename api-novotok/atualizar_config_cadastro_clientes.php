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

    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['timer']) || !isset($data['automatic'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'message' => 'Campos obrigatórios não fornecidos: timer, automatic'
        ]);
        exit;
    }

    // Validar o timer (deve ser um número positivo)
    if (!is_numeric($data['timer']) || $data['timer'] <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'message' => 'O timer deve ser um número positivo'
        ]);
        exit;
    }

    // Converter para os tipos corretos
    $timer = (int)$data['timer'];
    $automatic = $data['automatic'] ? 1 : 0;

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Verificar se existe configuração
    $stmt = $conn->prepare("SELECT id FROM config_cadastro_clientes ORDER BY id DESC LIMIT 1");
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        // Se não existir, criar uma nova
        $sql = "INSERT INTO config_cadastro_clientes (timer, automatic) VALUES (:timer, :automatic)";
    } else {
        // Se existir, atualizar a existente
        $config = $stmt->fetch(PDO::FETCH_ASSOC);
        $sql = "UPDATE config_cadastro_clientes SET timer = :timer, automatic = :automatic, updated_at = NOW() WHERE id = :id";
    }

    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':timer', $timer);
    $stmt->bindParam(':automatic', $automatic);
    
    if (isset($config['id'])) {
        $stmt->bindParam(':id', $config['id']);
    }

    if ($stmt->execute()) {
        // Obter o ID da configuração
        $config_id = isset($config['id']) ? $config['id'] : $conn->lastInsertId();
        
        // Registrar log da operação
        error_log("Configurações de cadastro de clientes atualizadas: ID=$config_id, Timer=$timer, Automatic=$automatic");
        
        echo json_encode([
            'success' => true,
            'message' => 'Configurações atualizadas com sucesso',
            'config' => [
                'id' => (int)$config_id,
                'timer' => $timer,
                'automatic' => (bool)$automatic
            ]
        ]);
    } else {
        throw new Exception('Erro ao atualizar configurações');
    }

} catch (PDOException $e) {
    error_log("Erro PDO ao atualizar configurações: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao atualizar configurações: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Erro ao atualizar configurações: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 