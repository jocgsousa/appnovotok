<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
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

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Buscar controles de envio que não têm estado de conversa correspondente
    $query = "
        SELECT 
            ce.id,
            ce.instancia_id,
            ce.pedido_id,
            ce.numero_pedido,
            ce.filial,
            ce.caixa,
            ce.codcli,
            ce.celular,
            ce.nome_cliente,
            ce.email_cliente,
            ce.campanha_id,
            ce.token_pesquisa,
            ce.status_envio,
            ce.tentativas_envio,
            ce.data_elegivel,
            ce.data_envio,
            ce.data_cadastro,
            ce.ultimo_erro
        FROM controle_envios_nps ce
        LEFT JOIN estado_conversa_nps ec ON ce.id = ec.controle_envio_id
        WHERE ec.controle_envio_id IS NULL
        ORDER BY ce.data_cadastro DESC
        LIMIT 100
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $controles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Converter tipos para garantir consistência
    foreach ($controles as &$controle) {
        $controle['id'] = (int)$controle['id'];
        $controle['instancia_id'] = (int)$controle['instancia_id'];
        $controle['pedido_id'] = (int)$controle['pedido_id'];
        $controle['filial'] = (int)$controle['filial'];
        $controle['caixa'] = (int)$controle['caixa'];
        $controle['codcli'] = (int)$controle['codcli'];
        $controle['campanha_id'] = (int)$controle['campanha_id'];
        $controle['tentativas_envio'] = (int)$controle['tentativas_envio'];
        
        // Converter valores monetários se existir
        if (isset($controle['valor_pedido']) && $controle['valor_pedido']) {
            $controle['valor_pedido'] = (float)$controle['valor_pedido'];
        }
    }
    
    echo json_encode([
        'success' => true,
        'controles' => $controles,
        'total' => count($controles),
        'message' => count($controles) > 0 
            ? "Encontrados " . count($controles) . " controles sem estado de conversa"
            : "Todos os controles possuem estado de conversa correspondente"
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage(),
        'controles' => [],
        'total' => 0
    ]);
}
?>
