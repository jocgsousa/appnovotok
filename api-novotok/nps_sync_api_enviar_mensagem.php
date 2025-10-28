<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
    
    // Compatibilidade: aceitar tanto controle_id quanto controle_envio_id
    $controleEnvioId = $input['controle_envio_id'] ?? $input['controle_id'] ?? null;
    
    if (!$controleEnvioId) {
        http_response_code(400);
        echo json_encode(['error' => 'Campo controle_envio_id ou controle_id é obrigatório']);
        exit;
    }
    
    // Campos obrigatórios (removendo controle_envio_id pois já foi validado acima)
    $requiredFields = ['instancia_id', 'celular'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Campo '$field' é obrigatório"]);
            exit;
        }
    }
    
    // Verificar se o controle de envio existe
    $checkQuery = "SELECT id FROM controle_envios_nps WHERE id = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->execute([$controleEnvioId]);
    
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Controle de envio não encontrado']);
        exit;
    }
    
    // Atualizar controle de envio para "enviado"
    $updateQuery = "UPDATE controle_envios_nps 
                    SET status_envio = 'enviado', 
                        data_envio = NOW(), 
                        tentativas_envio = tentativas_envio + 1
                    WHERE id = ?";
    
    $updateStmt = $conn->prepare($updateQuery);
    $updateStmt->execute([$controleEnvioId]);
    
    // Retornar dados para envio via WhatsApp Manager
    $response = [
        'success' => true,
        'message' => 'Mensagem preparada para envio',
        'whatsapp_data' => [
            'instancia_id' => $input['instancia_id'],
            'celular' => $input['celular'],
            'mensagem' => $input['mensagem'],
            'controle_envio_id' => $controleEnvioId
        ]
    ];
    
    // Se há dados adicionais para o estado de conversa
    if (isset($input['campanha_id'])) {
        $response['conversa_data'] = [
            'celular' => $input['celular'],
            'campanha_id' => $input['campanha_id'],
            'instancia_id' => $input['instancia_id'],
            'codcli' => $input['codcli'] ?? null,
            'cliente' => $input['cliente'] ?? null,
            'pedido_id' => $input['pedido_id'] ?? null
        ];
    }
    
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
