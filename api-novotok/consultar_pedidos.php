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
    $vendedor = isset($_GET['vendedor']) ? $_GET['vendedor'] : '';
    $pedido_id = isset($_GET['pedido']) ? $_GET['pedido'] : (isset($_GET['pedido_id']) ? $_GET['pedido_id'] : '');
    $filial = isset($_GET['filial']) ? $_GET['filial'] : '';
    $caixa = isset($_GET['caixa']) ? $_GET['caixa'] : '';
    $status_cancelamento = isset($_GET['status_cancelamento']) ? $_GET['status_cancelamento'] : '';

    // Query base
    $query = "SELECT p.pedido, p.filial, p.caixa, p.data, p.funccx, 
                     p.itens, p.cancelados, p.codcob, p.total_itens, 
                     p.total_cancelados, p.data_registro_produto, p.vendedor,
                     p.created_at, p.updated_at
              FROM pedidos p 
              WHERE 1=1";
    
    $params = [];

    // Aplicar filtros
    if (!empty($search)) {
        $query .= " AND (p.pedido LIKE ? OR p.codcob LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    if (!empty($data_inicio)) {
        $query .= " AND DATE(p.data) >= ?";
        $params[] = $data_inicio;
    }

    if (!empty($data_fim)) {
        $query .= " AND DATE(p.data) <= ?";
        $params[] = $data_fim;
    }

    if (!empty($vendedor)) {
        $query .= " AND p.vendedor = ?";
        $params[] = $vendedor;
    }

    // Filtrar por filial
    if (!empty($filial)) {
        $query .= " AND p.filial = ?";
        $params[] = $filial;
    }

    // Filtrar por caixa
    if (!empty($caixa)) {
        $query .= " AND p.caixa = ?";
        $params[] = $caixa;
    }

    // Filtrar por status de cancelamento
    if (!empty($status_cancelamento) && $status_cancelamento !== 'todos') {
        if ($status_cancelamento === 'com_cancelamento') {
            $query .= " AND (p.cancelados IS NOT NULL AND p.cancelados != '' AND p.cancelados != '[]')";
        } elseif ($status_cancelamento === 'sem_cancelamento') {
            $query .= " AND (p.cancelados IS NULL OR p.cancelados = '' OR p.cancelados = '[]')";
        }
    }

    // Filtrar por ID do pedido específico
    if (!empty($pedido_id)) {
        $query .= " AND p.pedido = ?";
        $params[] = $pedido_id;
    }

    // Se estiver filtrando por ID do pedido, contar apenas 1 registro
    if (!empty($pedido_id)) {
        $total = 1;
    } else {
        // Contar total de registros
        $countQuery = str_replace("SELECT p.pedido, p.filial, p.caixa, p.data, p.funccx, 
                     p.itens, p.cancelados, p.codcob, p.total_itens, 
                     p.total_cancelados, p.data_registro_produto, p.vendedor,
                     p.created_at, p.updated_at", "SELECT COUNT(*)", $query);
        $countStmt = $conn->prepare($countQuery);
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();
    }

    // Se estiver filtrando por ID do pedido, retornar apenas um registro
    if (!empty($pedido_id)) {
        $query .= " AND p.pedido = ? ORDER BY p.data_registro_produto DESC LIMIT 1";
        $params[] = $pedido_id;
        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Query com paginação
        $query .= " ORDER BY p.data_registro_produto DESC LIMIT ? OFFSET ?";
        $params[] = $per_page;
        $params[] = $offset;

        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Processar dados dos pedidos
    foreach ($pedidos as &$pedido) {
        // Decodificar JSON dos itens se necessário
        if (isset($pedido['itens']) && is_string($pedido['itens'])) {
            $pedido['itens'] = json_decode($pedido['itens'], true);
        }
        
        // Decodificar JSON dos cancelados se necessário
        if (isset($pedido['cancelados']) && is_string($pedido['cancelados'])) {
            $pedido['cancelados'] = json_decode($pedido['cancelados'], true);
        }
        
        // Converter valores numéricos
        if (isset($pedido['valor_total'])) {
            $pedido['valor_total'] = floatval($pedido['valor_total']);
        }
    }

    // Calcular número total de páginas
    $total_pages = ceil($total / $per_page);

    // Retornar resposta
    echo json_encode([
        'success' => true,
        'data' => $pedidos,
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
        'message' => 'Erro ao consultar pedidos: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro interno: ' . $e->getMessage()
    ]);
}
?>
