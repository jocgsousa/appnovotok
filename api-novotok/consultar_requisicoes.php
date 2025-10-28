<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Inicializar banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Parâmetros de paginação e filtros
    $page = isset($_GET['page']) ? $_GET['page'] : 1;
    $per_page = isset($_GET['per_page']) ? $_GET['per_page'] : 10;
    $offset = ($page - 1) * $per_page;

    // Filtros
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : '';
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : '';

    // Query base
    $query = "SELECT r.id, r.filial, r.caixa, r.datavendas, r.nregistros,
                     r.completed, r.processando, r.error, r.initial, 
                     r.message, r.created_at
              FROM request r 
              WHERE 1=1";
    
    $params = [];

    // Aplicar filtros
    if (!empty($search)) {
        $query .= " AND (r.id LIKE ? OR r.message LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    if (!empty($status)) {
        if ($status === 'completed') {
            $query .= " AND r.completed = 1";
        } elseif ($status === 'error') {
            $query .= " AND r.error = 1";
        } elseif ($status === 'processando') {
            $query .= " AND r.processando = 1";
        }
    }

    if (!empty($data_inicio)) {
        $query .= " AND DATE(r.datavendas) >= ?";
        $params[] = $data_inicio;
    }

    if (!empty($data_fim)) {
        $query .= " AND DATE(r.datavendas) <= ?";
        $params[] = $data_fim;
    }

    // Contar total de registros
    $countQuery = str_replace("SELECT r.id, r.filial, r.caixa, r.datavendas, r.nregistros,
                     r.completed, r.processando, r.error, r.initial, 
                     r.message, r.created_at", "SELECT COUNT(*)", $query);
    $countStmt = $conn->prepare($countQuery);
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    // Query com paginação
    $query .= " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    $params[] = $per_page;
    $params[] = $offset;

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $requisicoes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Processar dados das requisições
    foreach ($requisicoes as &$requisicao) {
        // Converter valores booleanos
        $requisicao['completed'] = (bool)$requisicao['completed'];
        $requisicao['processando'] = (bool)$requisicao['processando'];
        $requisicao['error'] = (bool)$requisicao['error'];
        $requisicao['initial'] = (bool)$requisicao['initial'];
        
        // Converter valores numéricos
        $requisicao['id'] = (int)$requisicao['id'];
        $requisicao['filial'] = (int)$requisicao['filial'];
        $requisicao['caixa'] = (int)$requisicao['caixa'];
        $requisicao['nregistros'] = (int)$requisicao['nregistros'];
    }

    // Calcular número total de páginas
    $total_pages = ceil($total / $per_page);

    // Retornar resposta
    echo json_encode([
        'success' => true,
        'data' => $requisicoes,
        'pagination' => [
            'total' => (int)$total,
            'total_pages' => (int)$total_pages,
            'current_page' => (int)$page,
            'per_page' => (int)$per_page
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro ao consultar requisições: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro interno: ' . $e->getMessage()
    ]);
}
?>
