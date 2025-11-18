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
    $filiaisCsv = isset($_GET['filiais']) ? trim($_GET['filiais']) : '';
    $departamentosCsv = isset($_GET['departamentos']) ? trim($_GET['departamentos']) : '';
    $secoesCsv = isset($_GET['secoes']) ? trim($_GET['secoes']) : '';
    $mes = isset($_GET['mes']) ? intval($_GET['mes']) : null;
    $ano = isset($_GET['ano']) ? intval($_GET['ano']) : null;

    $sql = "SELECT id, filial_id, codfilial, mes, ano, data_inicio, data_fim, valor_total, config_key, departamentos, secoes
            FROM bijou_filial_secoes_totais WHERE 1=1";
    $params = [];

    if ($mes !== null && $mes > 0) {
        $sql .= " AND mes = ?";
        $params[] = $mes;
    }
    if ($ano !== null && $ano > 0) {
        $sql .= " AND ano = ?";
        $params[] = $ano;
    }

    // Filtrar por filiais (codfilial)
    if (!empty($filiaisCsv)) {
        $filiais = array_filter(array_map('trim', explode(',', $filiaisCsv)));
        if (count($filiais) > 0) {
            // Normalizar números com zeros à esquerda (ex.: '04' => '4') para comparar com codfilial armazenado
            $filiaisNorm = array_map(function($f) {
                return ctype_digit($f) ? strval(intval($f)) : $f;
            }, $filiais);
            $placeholders = implode(',', array_fill(0, count($filiaisNorm), '?'));
            $sql .= " AND codfilial IN ($placeholders)";
            foreach ($filiaisNorm as $f) { $params[] = $f; }
        }
    }

    // Se departamentos/secoes forem fornecidos, filtrar por igualdade exata do CSV armazenado
    if (!empty($departamentosCsv)) {
        $sql .= " AND departamentos = ?";
        $params[] = $departamentosCsv;
    }
    if (!empty($secoesCsv)) {
        $sql .= " AND secoes = ?";
        $params[] = $secoesCsv;
    }

    $sql .= " ORDER BY ano DESC, mes DESC, codfilial ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([ 'success' => true, 'data' => $rows ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro interno', 'error' => $e->getMessage()]);
}
?>