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

    // Conectar ao banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Buscar envios agendados (não enviados ainda)
    $query = "SELECT ce.*, c.nome as campanha_nome, c.mensagem_inicial 
              FROM controle_envios_nps ce
              LEFT JOIN campanhas_nps c ON ce.campanha_id = c.id
              WHERE ce.status_envio = 'pendente' 
              AND ce.data_elegivel <= NOW()
              ORDER BY ce.data_elegivel ASC";
    
    $stmt = $conn->prepare($query);
    $stmt->execute();
    
    $envios = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $envios[] = [
            'id' => (int)$row['id'],
            'instancia_id' => (int)$row['instancia_id'],
            'pedido_id' => (int)$row['pedido_id'],
            'numero_pedido' => $row['numero_pedido'],
            'filial' => (int)$row['filial'],
            'caixa' => (int)$row['caixa'],
            'codcli' => (int)$row['codcli'],
            'celular' => $row['celular'],
            'nome_cliente' => $row['nome_cliente'],
            'email_cliente' => $row['email_cliente'],
            'campanha_id' => (int)$row['campanha_id'],
            'campanha_nome' => $row['campanha_nome'],
            'mensagem_inicial' => $row['mensagem_inicial'],
            'token_pesquisa' => $row['token_pesquisa'],
            'status_envio' => $row['status_envio'],
            'tentativas_envio' => (int)$row['tentativas_envio'],
            'ultimo_erro' => $row['ultimo_erro'],
            'data_elegivel' => $row['data_elegivel'],
            'data_envio' => $row['data_envio'],
            'data_cadastro' => $row['data_cadastro']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $envios
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
