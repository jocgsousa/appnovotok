<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas GET é aceito."
    ]);
    exit;
}

// Verificar se o token JWT foi fornecido
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
try {
    $payload = decodeJWT($jwt);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Parâmetros de filtro opcionais
$vendedor_id = isset($_GET['vendedor_id']) ? intval($_GET['vendedor_id']) : null;
$mes = isset($_GET['mes']) ? intval($_GET['mes']) : null;
$ano = isset($_GET['ano']) ? intval($_GET['ano']) : null;
$tipo_meta = isset($_GET['tipo_meta']) ? $_GET['tipo_meta'] : null; // 'vendas' ou 'cadastro_clientes'

// Validar o tipo de meta se fornecido
if ($tipo_meta !== null && $tipo_meta !== 'vendas' && $tipo_meta !== 'cadastro_clientes') {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Tipo de meta inválido. Use 'vendas' ou 'cadastro_clientes'."
    ]);
    exit;
}

// Array para armazenar os resultados
$resultados = [];

// Formatar os nomes dos meses
$meses = [
    1 => 'Janeiro',
    2 => 'Fevereiro',
    3 => 'Março',
    4 => 'Abril',
    5 => 'Maio',
    6 => 'Junho',
    7 => 'Julho',
    8 => 'Agosto',
    9 => 'Setembro',
    10 => 'Outubro',
    11 => 'Novembro',
    12 => 'Dezembro'
];

// Se o tipo de meta não for especificado ou for 'vendas', buscar metas de vendas
if ($tipo_meta === null || $tipo_meta === 'vendas') {
    // Construir a consulta SQL para metas de vendas
    $sql = "SELECT m.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
            FROM metas_vendas m 
            JOIN vendedores v ON m.vendedor_id = v.id 
            WHERE 1=1";

    $params = [];

    if ($vendedor_id !== null) {
        $sql .= " AND m.vendedor_id = ?";
        $params[] = $vendedor_id;
    }

    if ($mes !== null) {
        $sql .= " AND m.mes = ?";
        $params[] = $mes;
    }

    if ($ano !== null) {
        $sql .= " AND m.ano = ?";
        $params[] = $ano;
    }

    $sql .= " ORDER BY m.ano DESC, m.mes DESC, v.nome ASC";

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);

    // Vincular parâmetros
    $paramIndex = 1;
    foreach ($params as $param) {
        $stmt->bindValue($paramIndex++, $param);
    }

    $stmt->execute();
    $metas_vendas = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $row['nome_mes'] = $meses[$row['mes']];
        $row['periodo'] = $meses[$row['mes']] . '/' . $row['ano'];
        $row['tipo_meta'] = 'vendas';
        
        $metas_vendas[] = $row;
    }

    $resultados['metas_vendas'] = $metas_vendas;
    $resultados['total_metas_vendas'] = count($metas_vendas);
}

// Se o tipo de meta não for especificado ou for 'cadastro_clientes', buscar metas de cadastro de clientes
if ($tipo_meta === null || $tipo_meta === 'cadastro_clientes') {
    // Construir a consulta SQL para metas de cadastro de clientes
    $sql = "SELECT m.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
            FROM metas_cadastro_clientes m 
            JOIN vendedores v ON m.vendedor_id = v.id 
            WHERE 1=1";

    $params = [];

    if ($vendedor_id !== null) {
        $sql .= " AND m.vendedor_id = ?";
        $params[] = $vendedor_id;
    }

    if ($mes !== null) {
        $sql .= " AND m.mes = ?";
        $params[] = $mes;
    }

    if ($ano !== null) {
        $sql .= " AND m.ano = ?";
        $params[] = $ano;
    }

    $sql .= " ORDER BY m.ano DESC, m.mes DESC, v.nome ASC";

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);

    // Vincular parâmetros
    $paramIndex = 1;
    foreach ($params as $param) {
        $stmt->bindValue($paramIndex++, $param);
    }

    $stmt->execute();
    $metas_cadastro = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $row['nome_mes'] = $meses[$row['mes']];
        $row['periodo'] = $meses[$row['mes']] . '/' . $row['ano'];
        $row['tipo_meta'] = 'cadastro_clientes';
        
        $metas_cadastro[] = $row;
    }

    $resultados['metas_cadastro_clientes'] = $metas_cadastro;
    $resultados['total_metas_cadastro'] = count($metas_cadastro);
}

// Retornar os resultados
$resultados['status'] = 1;
$resultados['message'] = "Metas listadas com sucesso";

http_response_code(200);
echo json_encode($resultados);
?> 