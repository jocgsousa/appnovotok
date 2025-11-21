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
    
    // Migrado: consultar pedidos recentes a partir de pedidos_vendas
    // Usa dtfat/horafat/minutofat para precisão temporal; fallback para data (23:59:59)
    $where = [];
    $params = [];

    $where[] = "( 
        (pv.dtfat IS NOT NULL 
         AND pv.horafat IS NOT NULL 
         AND pv.minutofat IS NOT NULL) 
        AND ( 
            CASE 
                WHEN pv.dtfat LIKE '%-%' 
                THEN STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y-%m-%d %H:%i:%s')
                ELSE STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y%m%d %H:%i:%s')
            END
        ) >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    ) OR ( 
        (pv.dtfat IS NULL 
         OR pv.horafat IS NULL 
         OR pv.minutofat IS NULL) 
        AND pv.data IS NOT NULL
        AND ( 
            CASE 
                WHEN pv.data LIKE '%-%' 
                THEN STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
                ELSE STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y%m%d %H:%i:%s')
            END
        ) >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    )";
    $params[] = (int)$minutos;
    $params[] = (int)$minutos;

    if ($filiais) {
        $filiaisArray = array_filter(array_map('trim', explode(',', $filiais)), fn($v) => $v !== '');
        if (!empty($filiaisArray)) {
            $placeholders = str_repeat('?,', count($filiaisArray) - 1) . '?';
            $where[] = "pv.codfilial IN ($placeholders)";
            foreach ($filiaisArray as $f) { $params[] = $f; }
        }
    }

    $sql = "
        SELECT
            pv.numped       AS NUMPED,
            pv.codfilial    AS CODFILIAL,
            pv.numcaixa     AS NUMCAIXA,
            pv.data         AS DATA,
            pv.vltotal      AS VLTOTAL,
            pv.codcli       AS CODCLI,
            pv.cliente      AS CLIENTE,
            pv.created_at   AS CREATED_AT
        FROM pedidos_vendas pv
        " . (count($where) ? ('WHERE ' . implode(' AND ', $where)) : '') . "
        ORDER BY (
            CASE 
                WHEN pv.dtfat IS NOT NULL 
                 AND pv.horafat IS NOT NULL 
                 AND pv.minutofat IS NOT NULL
                THEN (
                    CASE WHEN pv.dtfat LIKE '%-%'
                        THEN STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y%m%d %H:%i:%s')
                    END
                )
                WHEN pv.data IS NOT NULL
                THEN (
                    CASE WHEN pv.data LIKE '%-%'
                        THEN STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y%m%d %H:%i:%s')
                    END
                )
                ELSE STR_TO_DATE('1970-01-01 00:00:00', '%Y-%m-%d %H:%i:%s')
            END
        ) DESC
        LIMIT ?
    ";

    $params[] = (int)$limit;

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $rows,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage()
    ]);
}
?>
