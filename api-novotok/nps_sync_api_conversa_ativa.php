<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

    // Obter parâmetros
    $numeros = $_GET['numeros'] ?? null;
    $instanciaId = $_GET['instancia_id'] ?? null;
    
    if (!$numeros || !$instanciaId) {
        http_response_code(400);
        echo json_encode(['error' => 'Números e ID da instância são obrigatórios']);
        exit;
    }

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Converter números em array
    $numerosArray = explode(',', $numeros);
    $placeholders = str_repeat('?,', count($numerosArray) - 1) . '?';
    
    // LOG: Parâmetros recebidos
    error_log("[NPS_CONVERSA_ATIVA] Parâmetros recebidos:");
    error_log("[NPS_CONVERSA_ATIVA] - numeros: " . $numeros);
    error_log("[NPS_CONVERSA_ATIVA] - instancia_id: " . $instanciaId);
    error_log("[NPS_CONVERSA_ATIVA] - numerosArray: " . json_encode($numerosArray));
    
    // Buscar conversa ativa com dados do controle de envio
    $query = "SELECT ec.*, ce.pedido_id, ce.codcli, ce.campanha_id, ce.nome_cliente, ce.numero_pedido
              FROM estado_conversa_nps ec
              INNER JOIN controle_envios_nps ce ON ec.controle_envio_id = ce.id
              WHERE ec.celular IN ($placeholders) 
              AND ec.instancia_id = ? 
              AND ec.aguardando_resposta = 1
              ORDER BY ec.data_cadastro DESC 
              LIMIT 1";
    
    $params = array_merge($numerosArray, [$instanciaId]);
    
    // LOG: Query e parâmetros
    error_log("[NPS_CONVERSA_ATIVA] Query: " . $query);
    error_log("[NPS_CONVERSA_ATIVA] Parâmetros: " . json_encode($params));
    
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    
    // LOG: Resultado da busca
    $conversa = $stmt->fetch(PDO::FETCH_ASSOC);
    error_log("[NPS_CONVERSA_ATIVA] Conversa encontrada: " . ($conversa ? 'SIM' : 'NÃO'));
    if ($conversa) {
        error_log("[NPS_CONVERSA_ATIVA] Dados da conversa: " . json_encode($conversa));
    } else {
        // Buscar todas as conversas para debug
        $debugQuery = "SELECT id, celular, instancia_id, aguardando_resposta FROM estado_conversa_nps WHERE instancia_id = ? ORDER BY data_cadastro DESC LIMIT 5";
        $debugStmt = $conn->prepare($debugQuery);
        $debugStmt->execute([$instanciaId]);
        $todasConversas = $debugStmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("[NPS_CONVERSA_ATIVA] Conversas existentes para instância $instanciaId: " . json_encode($todasConversas));
    }
    
    // $conversa já foi obtida acima para logging
    
    if ($conversa) {
        $result = [
            'id' => (int)$conversa['id'],
            'controle_envio_id' => (int)$conversa['controle_envio_id'],
            'instancia_id' => (int)$conversa['instancia_id'],
            'celular' => $conversa['celular'],
            'pergunta_atual_id' => (int)$conversa['pergunta_atual_id'],
            'ordem_resposta' => (int)$conversa['ordem_resposta'],
            'aguardando_resposta' => (bool)$conversa['aguardando_resposta'],
            'proxima_acao' => $conversa['proxima_acao'],
            'data_timeout' => $conversa['data_timeout'],
            'data_cadastro' => $conversa['data_cadastro'],
            // Campos do controle de envio necessários para salvar resposta NPS
            'pedido_id' => (int)$conversa['pedido_id'],
            'codcli' => (int)$conversa['codcli'],
            'campanha_id' => (int)$conversa['campanha_id'],
            'nome_cliente' => $conversa['nome_cliente'],
            'numero_pedido' => $conversa['numero_pedido']
        ];
    } else {
        $result = null;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
