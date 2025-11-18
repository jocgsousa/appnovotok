<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once 'database.php';
require_once 'jwt_utils.php';
require_once 'cors_config.php';

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit();
}

// Validar token
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit();
}

try {
    $db = new Database();
    $pdo = $db->getConnection();

    // Parâmetros
    $rcasCsv = isset($_GET['rcas']) ? trim($_GET['rcas']) : '';
    $vendedorIdsCsv = isset($_GET['vendedor_ids']) ? trim($_GET['vendedor_ids']) : '';
    $departamentosCsv = isset($_GET['departamentos']) ? trim($_GET['departamentos']) : '';
    $secoesCsv = isset($_GET['secoes']) ? trim($_GET['secoes']) : '';
    $mes = isset($_GET['mes']) ? intval($_GET['mes']) : null;
    $ano = isset($_GET['ano']) ? intval($_GET['ano']) : null;

    $sql = "SELECT id, vendedor_id, codusur, mes, ano, data_inicio, data_fim, valor_total, config_key, departamentos, secoes
            FROM bijou_vendedor_secoes_totais WHERE 1=1";
    $params = [];

    if ($mes !== null && $mes > 0) {
        $sql .= " AND mes = ?";
        $params[] = $mes;
    }
    if ($ano !== null && $ano > 0) {
        $sql .= " AND ano = ?";
        $params[] = $ano;
    }

    if (!empty($rcasCsv)) {
        $rcas = array_filter(array_map('trim', explode(',', $rcasCsv)));
        if (count($rcas) > 0) {
            $placeholders = implode(',', array_fill(0, count($rcas), '?'));
            $sql .= " AND codusur IN ($placeholders)";
            foreach ($rcas as $r) { $params[] = $r; }
        }
    }

    if (!empty($vendedorIdsCsv)) {
        $ids = array_filter(array_map('trim', explode(',', $vendedorIdsCsv)));
        if (count($ids) > 0) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sql .= " AND vendedor_id IN ($placeholders)";
            foreach ($ids as $id) { $params[] = intval($id); }
        }
    }

    if (!empty($departamentosCsv)) {
        $sql .= " AND departamentos = ?";
        $params[] = $departamentosCsv;
    }
    if (!empty($secoesCsv)) {
        $sql .= " AND secoes = ?";
        $params[] = $secoesCsv;
    }

    $sql .= " ORDER BY ano DESC, mes DESC, codusur ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro interno', 'error' => $e->getMessage()]);
}
?>