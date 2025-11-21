<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt_utils.php';
require_once __DIR__ . '/cors_config.php';

// cors_config.php já define os cabeçalhos CORS

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

// Valida o token JWT
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (strpos($authHeader, 'Bearer ') !== 0) {
    http_response_code(401);
    echo json_encode(['error' => 'Token ausente ou inválido']);
    exit;
}

$token = substr($authHeader, 7);
$jwtData = decodeJWT($token);
if (!$jwtData) {
    http_response_code(401);
    echo json_encode(['error' => 'Token inválido']);
    exit;
}

// Parâmetros: minutos, filiais (csv), limit
$minutos = isset($_GET['minutos']) ? intval($_GET['minutos']) : 60;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
$filiaisCsv = isset($_GET['filiais']) ? trim($_GET['filiais']) : '';
$numpedParam = isset($_GET['numped']) ? trim($_GET['numped']) : '';
$filiais = [];
if ($filiaisCsv !== '') {
    // Tenta decodificar JSON (ex.: "[8,9]" ou "[\"8\"]")
    $decoded = json_decode($filiaisCsv, true);
    if (is_array($decoded)) {
        foreach ($decoded as $val) {
            // Remove aspas e espaços
            if (is_string($val)) {
                $val = trim($val, " \t\n\r\0\x0B\"");
            }
            if ($val !== '' && $val !== null) {
                $filiais[] = (string)$val;
            }
        }
    } else {
        // Caso não seja JSON, normaliza separadores e remove colchetes/aspas
        $sanitizado = preg_replace('/[\[\]\"]+/', '', $filiaisCsv);
        $parts = preg_split('/[,;\s]+/', $sanitizado);
        foreach ($parts as $p) {
            $p = trim($p);
            if ($p !== '') $filiais[] = $p;
        }
    }
}

try {
    $pdo = (new Database())->getConnection();

    $where = [];
    $params = [];

    // Usa exclusivamente dtfat/horafat/minutofat como referência temporal; se ausente, cai para data (23:59:59)
    // STR_TO_DATE garante robustez quando colunas estiverem como VARCHAR
    // Filtro por pedido específico (numped). Quando informado, ignora a janela temporal.
    if ($numpedParam !== '') {
        $where[] = 'pv.numped = ?';
        $params[] = intval($numpedParam);
    } else {
        // Usa um único timestamp de evento com fallback: dtfat+hora+minuto -> created_at -> data fim do dia
        $where[] = "(
            CASE 
                WHEN pv.dtfat IS NOT NULL AND pv.horafat IS NOT NULL AND pv.minutofat IS NOT NULL THEN (
                    CASE 
                        WHEN pv.dtfat LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y%m%d %H:%i:%s')
                    END
                )
                WHEN pv.created_at IS NOT NULL THEN CAST(pv.created_at AS DATETIME)
                WHEN pv.data IS NOT NULL THEN (
                    CASE 
                        WHEN pv.data LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y%m%d %H:%i:%s')
                    END
                )
                ELSE STR_TO_DATE('1970-01-01 00:00:00', '%Y-%m-%d %H:%i:%s')
            END
        ) BETWEEN DATE_SUB(NOW(), INTERVAL ? MINUTE) AND NOW()";
        $params[] = $minutos;
    }

    if (!empty($filiais)) {
        $placeholders = implode(',', array_fill(0, count($filiais), '?'));
        $where[] = "pv.codfilial IN ($placeholders)";
        foreach ($filiais as $f) {
            $params[] = $f;
        }
    }

    $sql = "
        SELECT
            pv.numped       AS NUMPED,
            pv.codfilial    AS CODFILIAL,
            pv.data         AS DATA,
            pv.vltotal      AS VLTOTAL,
            pv.codcli       AS CODCLI,
            pv.cliente      AS CLIENTE,
            pv.numcaixa     AS NUMCAIXA,
            pv.created_at   AS CREATED_AT,
            c.billingPhone  AS BILLING_PHONE
        FROM pedidos_vendas pv
        LEFT JOIN clientes c ON c.codcli = pv.codcli
        " . (count($where) ? ('WHERE ' . implode(' AND ', $where)) : '') . "
        ORDER BY (
            CASE 
                WHEN pv.dtfat IS NOT NULL AND pv.horafat IS NOT NULL AND pv.minutofat IS NOT NULL THEN (
                    CASE 
                        WHEN pv.dtfat LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.dtfat, ' ', LPAD(pv.horafat, 2, '0'), ':', LPAD(pv.minutofat, 2, '0'), ':00'), '%Y%m%d %H:%i:%s')
                    END
                )
                WHEN pv.created_at IS NOT NULL THEN CAST(pv.created_at AS DATETIME)
                WHEN pv.data IS NOT NULL THEN (
                    CASE 
                        WHEN pv.data LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(pv.data, ' 23:59:59'), '%Y%m%d %H:%i:%s')
                    END
                )
                ELSE STR_TO_DATE('1970-01-01 00:00:00', '%Y-%m-%d %H:%i:%s')
            END
        ) DESC
        LIMIT ?
    ";

    $params[] = $limit;

    // Modo de diagnóstico: bypass do filtro temporal para verificar presença de dados
    if (!empty($_GET['debug']) && intval($_GET['debug']) === 1) {
        $sqlDebug = 'SELECT pv.* FROM pedidos_vendas pv';
        $paramsDebug = [];
        if (!empty($filiais)) {
            $inPlaceholders = implode(',', array_fill(0, count($filiais), '?'));
            $sqlDebug .= ' WHERE pv.codfilial IN (' . $inPlaceholders . ')';
            $paramsDebug = array_map('intval', $filiais);
        }
        $sqlDebug .= ' LIMIT ?';
        $paramsDebug[] = $limit;
        $stmtDebug = $pdo->prepare($sqlDebug);
        $stmtDebug->execute($paramsDebug);
        $rowsDebug = $stmtDebug->fetchAll(PDO::FETCH_ASSOC);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($rowsDebug);
        return;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Log simples para diagnóstico
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0777, true);
    }
    @file_put_contents($logDir . '/nps_sync_api_pedidos_vendas_recentes.log',
        '[' . date('Y-m-d H:i:s') . '] minutos=' . $minutos .
        '; filiais=' . (!empty($filiais) ? implode(',', $filiais) : 'all') .
        '; numped=' . ($numpedParam !== '' ? $numpedParam : 'none') .
        '; count=' . count($rows) . PHP_EOL,
        FILE_APPEND
    );

    echo json_encode([
        'ok' => true,
        'minutos' => $minutos,
        'count' => count($rows),
        'numped' => ($numpedParam !== '' ? intval($numpedParam) : null),
        'pedidos' => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao consultar pedidos_vendas recentes', 'details' => $e->getMessage()]);
}
?>