<?php
require_once __DIR__ . '/cors_config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt_utils.php';

// Headers CORS são aplicados diretamente por cors_config.php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

// Autenticação via Bearer JWT
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (strpos($authHeader, 'Bearer ') !== 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Token ausente ou inválido']);
    exit;
}
$token = substr($authHeader, 7);
if (!is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Token inválido ou expirado']);
    exit;
}

$limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 30;
$filiaisCsv = isset($_GET['filiais']) ? trim($_GET['filiais']) : '';
$filiais = [];
if ($filiaisCsv !== '') {
    $decoded = json_decode($filiaisCsv, true);
    if (is_array($decoded)) {
        foreach ($decoded as $val) {
            if (is_string($val)) { $val = trim($val, " \t\n\r\0\x0B\""); }
            if ($val !== '' && $val !== null) { $filiais[] = (string)$val; }
        }
    } else {
        $sanitizado = preg_replace('/[\[\]\"]+/', '', $filiaisCsv);
        $parts = preg_split('/[,;\s]+/', $sanitizado);
        foreach ($parts as $p) { $p = trim($p); if ($p !== '') $filiais[] = $p; }
    }
}

try {
    $pdo = (new Database())->getConnection();

    // Verifica existência das tabelas antes de consultar
    $stmtTbl = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?");
    $stmtTbl->execute(['pedidos_vendas']);
    $existsPV = (int)$stmtTbl->fetchColumn() > 0;
    $stmtTbl->execute(['pedidos_vendas_produtos']);
    $existsPVP = (int)$stmtTbl->fetchColumn() > 0;

    if (!$existsPV) {
        echo json_encode([
            'success' => false,
            'error' => 'Tabela pedidos_vendas inexistente no schema atual',
            'details' => [ 'schema' => $pdo->query('SELECT DATABASE()')->fetchColumn(), 'pedidos_vendas_produtos_existe' => $existsPVP ]
        ]);
        return;
    }

    // Contagens básicas
    $countAll = (int)$pdo->query('SELECT COUNT(*) FROM pedidos_vendas')->fetchColumn();
    $countDTFAT = (int)$pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE dtfat IS NOT NULL AND CAST(dtfat AS CHAR) <> ''")->fetchColumn();
    $countSemDTFAT = (int)$pdo->query("SELECT COUNT(*) FROM pedidos_vendas WHERE dtfat IS NULL OR CAST(dtfat AS CHAR) = ''")->fetchColumn();

    // Datas mínimas e máximas (data cabeçalho)
    $stmtMaxData = $pdo->query("SELECT MAX(CASE WHEN data LIKE '%-%' THEN STR_TO_DATE(data, '%Y-%m-%d') ELSE STR_TO_DATE(data, '%Y%m%d') END) AS max_data");
    $maxData = $stmtMaxData->fetchColumn();
    $stmtMinData = $pdo->query("SELECT MIN(CASE WHEN data LIKE '%-%' THEN STR_TO_DATE(data, '%Y-%m-%d') ELSE STR_TO_DATE(data, '%Y%m%d') END) AS min_data");
    $minData = $stmtMinData->fetchColumn();

    // Máxima data de faturamento composta (dtfat/horafat/minutofat)
    $stmtMaxFaturamento = $pdo->query(
        "SELECT MAX( 
            CASE 
              WHEN dtfat IS NOT NULL AND dtfat <> '' THEN 
                CASE WHEN dtfat LIKE '%-%' 
                  THEN STR_TO_DATE(CONCAT(dtfat, ' ', LPAD(COALESCE(horafat, '00'), 2, '0'), ':', LPAD(COALESCE(minutofat, '00'), 2, '0'), ':00'), '%Y-%m-%d %H:%i:%s') 
                  ELSE STR_TO_DATE(CONCAT(dtfat, ' ', LPAD(COALESCE(horafat, '00'), 2, '0'), ':', LPAD(COALESCE(minutofat, '00'), 2, '0'), ':00'), '%Y%m%d %H:%i:%s') 
                END 
              ELSE NULL 
            END
          ) AS max_dtfat_composta 
         FROM pedidos_vendas"
    );
    $maxDTFATComposta = $stmtMaxFaturamento->fetchColumn();

    // Distribuição por filial
    $sqlFiliais = 'SELECT codfilial, COUNT(*) AS total FROM pedidos_vendas GROUP BY codfilial ORDER BY total DESC LIMIT 20';
    $filiaisDistrib = $pdo->query($sqlFiliais)->fetchAll(PDO::FETCH_ASSOC);

    // Amostras: últimos por faturamento e últimos por data cabeçalho
    $paramsAmostra = [];
    $whereFilial = '';
    if (!empty($filiais)) {
        $ph = implode(',', array_fill(0, count($filiais), '?'));
        $whereFilial = " WHERE codfilial IN ($ph)";
        foreach ($filiais as $f) { $paramsAmostra[] = $f; }
    }

    $sqlAmostraFat = 
        "SELECT numped, codfilial, data, dtfat, horafat, minutofat, vltotal, created_at 
           FROM pedidos_vendas" . $whereFilial . 
        " ORDER BY (
            CASE 
                WHEN dtfat IS NOT NULL AND horafat IS NOT NULL AND minutofat IS NOT NULL THEN 
                    (CASE WHEN dtfat LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(dtfat, ' ', LPAD(horafat,2,'0'), ':', LPAD(minutofat,2,'0'), ':00'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(dtfat, ' ', LPAD(horafat,2,'0'), ':', LPAD(minutofat,2,'0'), ':00'), '%Y%m%d %H:%i:%s')
                    END)
                WHEN data IS NOT NULL THEN 
                    (CASE WHEN data LIKE '%-%' 
                        THEN STR_TO_DATE(CONCAT(data, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
                        ELSE STR_TO_DATE(CONCAT(data, ' 23:59:59'), '%Y%m%d %H:%i:%s')
                    END)
                ELSE STR_TO_DATE('1970-01-01 00:00:00', '%Y-%m-%d %H:%i:%s')
            END
        ) DESC LIMIT ?";
    $paramsAmostraFat[] = $limit;
    $stmtAmostraFat = $pdo->prepare($sqlAmostraFat);
    $stmtAmostraFat->execute($paramsAmostraFat);
    $amostraFaturamento = $stmtAmostraFat->fetchAll(PDO::FETCH_ASSOC);

    $paramsAmostraData = [];
    if (!empty($filiais)) { $paramsAmostraData = array_map('intval', $filiais); }
    $sqlAmostraData = 
        "SELECT numped, codfilial, data, dtfat, horafat, minutofat, vltotal, created_at 
           FROM pedidos_vendas" . $whereFilial . 
        " ORDER BY data DESC LIMIT ?";
    $paramsAmostraData[] = $limit;
    $stmtAmostraData = $pdo->prepare($sqlAmostraData);
    $stmtAmostraData->execute($paramsAmostraData);
    $amostraData = $stmtAmostraData->fetchAll(PDO::FETCH_ASSOC);

    // Amostra onde dtfat está ausente
    $paramsAmostraSem = [];
    $whereSem = ' WHERE (dtfat IS NULL OR CAST(dtfat AS CHAR) = '')';
    if (!empty($filiais)) {
        $phs = implode(',', array_fill(0, count($filiais), '?'));
        $whereSem .= " AND codfilial IN ($phs)";
        foreach ($filiais as $f) { $paramsAmostraSem[] = $f; }
    }
    $sqlAmostraSem = 
        "SELECT numped, codfilial, data, dtfat, horafat, minutofat, vltotal, created_at 
           FROM pedidos_vendas" . $whereSem . 
        " ORDER BY data DESC LIMIT ?";
    $paramsAmostraSem[] = $limit;
    $stmtAmostraSem = $pdo->prepare($sqlAmostraSem);
    $stmtAmostraSem->execute($paramsAmostraSem);
    $amostraSemDTFAT = $stmtAmostraSem->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'summary' => [
            'total_rows' => $countAll,
            'com_dtfat' => $countDTFAT,
            'sem_dtfat' => $countSemDTFAT,
            'max_data' => $maxData,
            'min_data' => $minData,
            'max_dtfat_composta' => $maxDTFATComposta,
        ],
        'tabelas' => [ 'pedidos_vendas' => $existsPV, 'pedidos_vendas_produtos' => $existsPVP ],
        'filiais_distribuicao' => $filiaisDistrib,
        'amostra_faturamento' => $amostraFaturamento,
        'amostra_data' => $amostraData,
        'amostra_sem_dtfat' => $amostraSemDTFAT,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    // Log de erro
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) { @mkdir($logDir, 0777, true); }
    @file_put_contents($logDir . '/debug_pedidos_vendas.log', '[' . date('Y-m-d H:i:s') . "] " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(['success' => false, 'error' => 'Falha no diagnóstico de pedidos_vendas', 'details' => $e->getMessage()]);
}
?>