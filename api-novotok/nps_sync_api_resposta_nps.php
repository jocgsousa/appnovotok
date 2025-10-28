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
    
    // Campos obrigatórios
    $requiredFields = ['controle_envio_id', 'instancia_id', 'pedido_id', 'codcli', 'campanha_id'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Campo '$field' é obrigatório"]);
            exit;
        }
    }
    
    // Calcular classificação NPS se nota foi fornecida
    $classificacaoNps = null;
    if (isset($input['nota_nps']) && $input['nota_nps'] !== null) {
        $nota = (int)$input['nota_nps'];
        if ($nota >= 0 && $nota <= 6) {
            $classificacaoNps = 'detrator';
        } elseif ($nota >= 7 && $nota <= 8) {
            $classificacaoNps = 'neutro';
        } elseif ($nota >= 9 && $nota <= 10) {
            $classificacaoNps = 'promotor';
        }
    }
    
    // Inserir resposta NPS
    $query = "INSERT INTO respostas_nps 
              (controle_envio_id, instancia_id, pedido_id, codcli, campanha_id, pergunta_id, resposta_texto, nota_nps, classificacao_nps, ordem_resposta, tempo_resposta_segundos, ip_origem, user_agent) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($query);
    $stmt->execute([
        $input['controle_envio_id'],
        $input['instancia_id'],
        $input['pedido_id'],
        $input['codcli'],
        $input['campanha_id'],
        $input['pergunta_id'] ?? null,
        $input['resposta_texto'] ?? null,
        $input['nota_nps'] ?? null,
        $classificacaoNps,
        $input['ordem_resposta'] ?? 1,
        $input['tempo_resposta_segundos'] ?? null,
        $input['ip_origem'] ?? null,
        $input['user_agent'] ?? null
    ]);
    
    $id = $conn->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'id' => (int)$id,
        'message' => 'Resposta NPS salva com sucesso'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
