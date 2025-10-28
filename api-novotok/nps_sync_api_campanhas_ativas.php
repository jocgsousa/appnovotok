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
    
    // Obter parâmetros
    $disparoImediato = $_GET['disparo_imediato'] ?? null;
    
    // Construir query
    $query = "SELECT * FROM campanhas_nps WHERE status = 'ativa'";
    $params = [];
    
    if ($disparoImediato !== null) {
        $query .= " AND disparo_imediato = ?";
        $params[] = (int)$disparoImediato;
    }
    
    $query .= " ORDER BY id DESC";
    
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    
    $campanhas = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $campanhas[] = [
            'id' => (int)$row['id'],
            'instancia_id' => (int)$row['instancia_id'],
            'nome' => $row['nome'],
            'descricao' => $row['descricao'],
            'pergunta_principal' => $row['pergunta_principal'],
            'mensagem_inicial' => $row['mensagem_inicial'],
            'mensagem_final' => $row['mensagem_final'],
            'dias_apos_compra' => (int)$row['dias_apos_compra'],
            'disparo_imediato' => (bool)$row['disparo_imediato'],
            'status' => $row['status'],
            'data_inicio' => $row['data_inicio'],
            'data_fim' => $row['data_fim'],
            'max_tentativas_envio' => (int)$row['max_tentativas_envio'],
            'intervalo_reenvio_dias' => (int)$row['intervalo_reenvio_dias'],
            'horario_envio_inicio' => $row['horario_envio_inicio'],
            'horario_envio_fim' => $row['horario_envio_fim'],
            'dias_semana_envio' => $row['dias_semana_envio'],
            'filiais_ativas' => json_decode($row['filiais_ativas'], true),
            'timeout_conversa_minutos' => (int)$row['timeout_conversa_minutos'],
            'data_cadastro' => $row['data_cadastro']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $campanhas
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
