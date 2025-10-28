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

    // Conectar ao banco de dados MySQL
    $database = new Database();
    $conn = $database->getConnection();
    
    // Obter parâmetros
    $minutos = $_GET['minutos'] ?? 1440; // Default 24 horas
    $filiais = $_GET['filiais'] ?? null;
    $limit = $_GET['limit'] ?? 100;
    
    // Construir query para buscar pedidos recentes no MySQL
    // Usando data_registro_produto para filtrar pedidos recentes (mais relevante para NPS)
    $query = "SELECT 
                p.pedido as NUMPED,
                p.filial as CODFILIAL,
                p.caixa as NUMCAIXA,
                p.data as DATA,
                p.data_registro_produto,
                p.total_itens as VLTOTAL,
                p.vendedor,
                p.created_at,
                p.itens
              FROM pedidos p
              WHERE p.data_registro_produto >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
              AND p.data_registro_produto IS NOT NULL
              AND p.itens IS NOT NULL
              AND p.itens != ''";
    
    $params = [$minutos];
    
    if ($filiais) {
        $filiaisArray = explode(',', $filiais);
        $placeholders = str_repeat('?,', count($filiaisArray) - 1) . '?';
        $query .= " AND p.filial IN ($placeholders)";
        $params = array_merge($params, $filiaisArray);
    }
    
    $query .= " ORDER BY p.data DESC LIMIT ?";
    $params[] = (int)$limit;
    
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    
    $pedidos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $pedidos[] = [
            'NUMPED' => (int)$row['NUMPED'],
            'CODFILIAL' => (int)$row['CODFILIAL'],
            'NUMCAIXA' => (int)$row['NUMCAIXA'],
            'VLTOTAL' => (float)$row['VLTOTAL'],
            'DATA' => $row['DATA'],
            'data_registro_produto' => $row['data_registro_produto'],
            'vendedor' => (int)$row['vendedor'],
            'created_at' => $row['created_at'],
            'itens' => $row['itens'] // Campo JSON com os itens do pedido
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $pedidos
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
