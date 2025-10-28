<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

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

// Depuração dos headers recebidos
error_log("Headers recebidos: " . json_encode($headers));

$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if (empty($authHeader) && isset($headers['authorization'])) {
    // Tentar com 'authorization' em minúsculas (alguns servidores modificam o case)
    $authHeader = $headers['authorization'];
}

error_log("Auth Header: " . $authHeader);

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];
error_log("Token extraído: " . $jwt);

// Validar o token JWT
try {
    // Usar o método is_jwt_valid em vez de decodeJWT para verificação simples
    if (!is_jwt_valid($jwt)) {
        throw new Exception("Token inválido ou expirado");
    }
    
    $payload = decodeJWT($jwt);
    error_log("Token decodificado com sucesso");
} catch (Exception $e) {
    error_log("Erro na validação do token: " . $e->getMessage());
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se o ID do vendedor foi fornecido
if (!isset($_GET['vendedor_id'])) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID do vendedor não fornecido."
    ]);
    exit;
}

$vendedor_id = intval($_GET['vendedor_id']);
error_log("Processando requisição para vendedor ID: " . $vendedor_id);

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Parâmetros de filtro opcionais
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

// Verificar se o vendedor existe
$stmt = $conn->prepare("SELECT id, nome, rca FROM vendedores WHERE id = ?");
$stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
$stmt->execute();

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        "status" => 0,
        "message" => "Vendedor não encontrado."
    ]);
    exit;
}

$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

// Array para armazenar os resultados
$resultados = [
    "status" => 1,
    "message" => "Metas do vendedor listadas com sucesso",
    "vendedor" => $vendedor
];

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
    $sql = "SELECT * FROM metas_vendas WHERE vendedor_id = ?";
    $params = [$vendedor_id];

    if ($mes !== null) {
        $sql .= " AND mes = ?";
        $params[] = $mes;
    }

    if ($ano !== null) {
        $sql .= " AND ano = ?";
        $params[] = $ano;
    }

    $sql .= " ORDER BY ano DESC, mes DESC";

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
    $sql = "SELECT * FROM metas_cadastro_clientes WHERE vendedor_id = ?";
    $params = [$vendedor_id];

    if ($mes !== null) {
        $sql .= " AND mes = ?";
        $params[] = $mes;
    }

    if ($ano !== null) {
        $sql .= " AND ano = ?";
        $params[] = $ano;
    }

    $sql .= " ORDER BY ano DESC, mes DESC";

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
http_response_code(200);
echo json_encode($resultados);
?> 