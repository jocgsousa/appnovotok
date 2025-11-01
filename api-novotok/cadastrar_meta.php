<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas POST é aceito."
    ]);
    exit;
}

// Obter o conteúdo do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

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
    $usuario_id = $payload->data->user_id; // ID do usuário que está criando a meta
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se todos os dados necessários foram fornecidos
if (!isset($data->vendedor_id) || !isset($data->mes) || !isset($data->ano) || !isset($data->tipo_meta)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Dados incompletos. Forneça vendedor_id, mes, ano e tipo_meta."
    ]);
    exit;
}

// Validar os dados básicos
$vendedor_id = intval($data->vendedor_id);
$mes = intval($data->mes);
$ano = intval($data->ano);
$tipo_meta = $data->tipo_meta; // 'vendas' ou 'cadastro_clientes'
$observacoes = isset($data->observacoes) ? $data->observacoes : null;

// Verificar se o tipo de meta é válido
if ($tipo_meta !== 'vendas' && $tipo_meta !== 'cadastro_clientes') {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Tipo de meta inválido. Use 'vendas' ou 'cadastro_clientes'."
    ]);
    exit;
}

// Verificar se o mês é válido (1-12)
if ($mes < 1 || $mes > 12) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Mês inválido. Deve ser um número entre 1 e 12."
    ]);
    exit;
}

// Verificar se o ano é válido (atual ou futuro)
$ano_atual = intval(date('Y'));
if ($ano < $ano_atual) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Ano inválido. Deve ser o ano atual ou futuro."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Verificar se o vendedor existe
$stmt = $conn->prepare("SELECT id FROM vendedores WHERE id = ?");
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

// Verificar dados específicos do tipo de meta
if ($tipo_meta === 'vendas') {
    // Verificar se o valor da meta foi fornecido
    if (!isset($data->valor_meta)) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Valor da meta de vendas não fornecido."
        ]);
        exit;
    }
    
    $valor_meta = floatval($data->valor_meta);
    
    // Verificar se o valor da meta é positivo
    if ($valor_meta <= 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Valor da meta deve ser maior que zero."
        ]);
        exit;
    }
    
    // Inserir a nova meta de vendas
    $stmt = $conn->prepare("INSERT INTO metas_vendas (vendedor_id, mes, ano, valor_meta, observacoes) VALUES (?, ?, ?, ?, ?)");
    $stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
    $stmt->bindParam(2, $mes, PDO::PARAM_INT);
    $stmt->bindParam(3, $ano, PDO::PARAM_INT);
    $stmt->bindParam(4, $valor_meta, PDO::PARAM_STR);
    $stmt->bindParam(5, $observacoes, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        $meta_id = $conn->lastInsertId();
        
        // Registrar no histórico
        $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                               (tipo_meta, meta_id, vendedor_id, mes, ano, valor_novo, observacoes, usuario) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
        $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
        $stmt->bindParam(3, $vendedor_id, PDO::PARAM_INT);
        $stmt->bindParam(4, $mes, PDO::PARAM_INT);
        $stmt->bindParam(5, $ano, PDO::PARAM_INT);
        $stmt->bindParam(6, $valor_meta, PDO::PARAM_STR);
        $stmt->bindParam(7, $observacoes, PDO::PARAM_STR);
        $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
        $stmt->bindParam(8, $usuario_nome, PDO::PARAM_STR);
        $stmt->execute();
        
        // Buscar a meta recém-criada para retornar todos os dados
        $stmt = $conn->prepare("SELECT m.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
                               FROM metas_vendas m 
                               JOIN vendedores v ON m.vendedor_id = v.id 
                               WHERE m.id = ?");
        $stmt->bindParam(1, $meta_id, PDO::PARAM_INT);
        $stmt->execute();
        $meta = $stmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(201);
        echo json_encode([
            "status" => 1,
            "message" => "Meta de vendas cadastrada com sucesso",
            "meta" => $meta
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => 0,
            "message" => "Erro ao cadastrar meta de vendas."
        ]);
    }
} else {
    // Meta de cadastro de clientes
    // Verificar se a quantidade da meta foi fornecida
    if (!isset($data->quantidade_meta)) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Quantidade da meta de cadastro de clientes não fornecida."
        ]);
        exit;
    }
    
    $quantidade_meta = intval($data->quantidade_meta);
    
    // Verificar se a quantidade da meta é positiva
    if ($quantidade_meta <= 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Quantidade da meta deve ser maior que zero."
        ]);
        exit;
    }
    
    // Inserir a nova meta de cadastro de clientes
    $stmt = $conn->prepare("INSERT INTO metas_cadastro_clientes (vendedor_id, mes, ano, quantidade_meta, observacoes) VALUES (?, ?, ?, ?, ?)");
    $stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
    $stmt->bindParam(2, $mes, PDO::PARAM_INT);
    $stmt->bindParam(3, $ano, PDO::PARAM_INT);
    $stmt->bindParam(4, $quantidade_meta, PDO::PARAM_INT);
    $stmt->bindParam(5, $observacoes, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        $meta_id = $conn->lastInsertId();
        
        // Registrar no histórico
        $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                               (tipo_meta, meta_id, vendedor_id, mes, ano, quantidade_nova, observacoes, usuario) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
        $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
        $stmt->bindParam(3, $vendedor_id, PDO::PARAM_INT);
        $stmt->bindParam(4, $mes, PDO::PARAM_INT);
        $stmt->bindParam(5, $ano, PDO::PARAM_INT);
        $stmt->bindParam(6, $quantidade_meta, PDO::PARAM_INT);
        $stmt->bindParam(7, $observacoes, PDO::PARAM_STR);
        $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
        $stmt->bindParam(8, $usuario_nome, PDO::PARAM_STR);
        $stmt->execute();
        
        // Buscar a meta recém-criada para retornar todos os dados
        $stmt = $conn->prepare("SELECT m.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
                               FROM metas_cadastro_clientes m 
                               JOIN vendedores v ON m.vendedor_id = v.id 
                               WHERE m.id = ?");
        $stmt->bindParam(1, $meta_id, PDO::PARAM_INT);
        $stmt->execute();
        $meta = $stmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(201);
        echo json_encode([
            "status" => 1,
            "message" => "Meta de cadastro de clientes cadastrada com sucesso",
            "meta" => $meta
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "status" => 0,
            "message" => "Erro ao cadastrar meta de cadastro de clientes."
        ]);
    }
}
?>