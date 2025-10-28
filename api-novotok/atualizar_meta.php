<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: PUT");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é PUT
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas PUT é aceito."
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
    $usuario_id = $payload->id; // ID do usuário que está atualizando a meta
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se o ID da meta e o tipo de meta foram fornecidos
if (!isset($data->id) || !isset($data->tipo_meta)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta e tipo de meta não fornecidos."
    ]);
    exit;
}

$meta_id = intval($data->id);
$tipo_meta = $data->tipo_meta; // 'vendas' ou 'cadastro_clientes'

// Validar o tipo de meta
if ($tipo_meta !== 'vendas' && $tipo_meta !== 'cadastro_clientes') {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Tipo de meta inválido. Use 'vendas' ou 'cadastro_clientes'."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Verificar se a meta existe na tabela correta
$tabela = $tipo_meta === 'vendas' ? 'metas_vendas' : 'metas_cadastro_clientes';

$stmt = $conn->prepare("SELECT * FROM {$tabela} WHERE id = ?");
$stmt->bindParam(1, $meta_id, PDO::PARAM_INT);
$stmt->execute();

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        "status" => 0,
        "message" => "Meta não encontrada."
    ]);
    exit;
}

$meta_atual = $stmt->fetch(PDO::FETCH_ASSOC);

// Preparar os dados para atualização
$vendedor_id = isset($data->vendedor_id) ? intval($data->vendedor_id) : $meta_atual['vendedor_id'];
$mes = isset($data->mes) ? intval($data->mes) : $meta_atual['mes'];
$ano = isset($data->ano) ? intval($data->ano) : $meta_atual['ano'];
$observacoes = isset($data->observacoes) ? $data->observacoes : $meta_atual['observacoes'];

// Validar os dados
// Verificar se o mês é válido (1-12)
if ($mes < 1 || $mes > 12) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Mês inválido. Deve ser um número entre 1 e 12."
    ]);
    exit;
}

// Verificar se o vendedor existe
if ($vendedor_id !== $meta_atual['vendedor_id']) {
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
}

// Verificar se já existe outra meta para este vendedor neste mês/ano (exceto a atual)
if ($vendedor_id !== $meta_atual['vendedor_id'] || $mes !== $meta_atual['mes'] || $ano !== $meta_atual['ano']) {
    $stmt = $conn->prepare("SELECT id FROM {$tabela} WHERE vendedor_id = ? AND mes = ? AND ano = ? AND id != ?");
    $stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
    $stmt->bindParam(2, $mes, PDO::PARAM_INT);
    $stmt->bindParam(3, $ano, PDO::PARAM_INT);
    $stmt->bindParam(4, $meta_id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode([
            "status" => 0,
            "message" => "Já existe outra meta cadastrada para este vendedor neste período."
        ]);
        exit;
    }
}

// Processar dados específicos do tipo de meta
if ($tipo_meta === 'vendas') {
    $valor_meta = isset($data->valor_meta) ? floatval($data->valor_meta) : $meta_atual['valor_meta'];
    
    // Verificar se o valor da meta é positivo
    if ($valor_meta <= 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Valor da meta deve ser maior que zero."
        ]);
        exit;
    }
    
    // Registrar no histórico
    if ($valor_meta !== $meta_atual['valor_meta']) {
        // Verificar se a tabela existe
        $query_check = "SELECT COUNT(*) FROM information_schema.tables 
                       WHERE table_schema = DATABASE() 
                       AND table_name = 'historico_atualizacao_metas'";
        $stmt_check = $conn->prepare($query_check);
        $stmt_check->execute();
        $table_exists = (bool)$stmt_check->fetchColumn();
        
        if (!$table_exists) {
            // Criar a tabela se não existir
            $query_create = "CREATE TABLE historico_atualizacao_metas (
                id INT(11) NOT NULL AUTO_INCREMENT,
                meta_id INT(11) NOT NULL,
                tipo_meta VARCHAR(50) NOT NULL,
                vendedor_id INT(11) NOT NULL,
                mes INT(11) NOT NULL,
                ano INT(11) NOT NULL,
                valor_anterior DECIMAL(10,2) NULL DEFAULT NULL,
                valor_novo DECIMAL(10,2) NULL DEFAULT NULL,
                quantidade_anterior INT(11) NULL DEFAULT NULL,
                quantidade_nova INT(11) NULL DEFAULT NULL,
                observacoes TEXT NULL DEFAULT NULL,
                data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100) NOT NULL,
                PRIMARY KEY (id),
                INDEX fk_historico_vendedor_idx (vendedor_id ASC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";
            
            $stmt_create = $conn->prepare($query_create);
            $stmt_create->execute();
        }
        
        $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                               (tipo_meta, meta_id, vendedor_id, mes, ano, valor_anterior, valor_novo, observacoes, usuario) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
        $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
        $stmt->bindParam(3, $vendedor_id, PDO::PARAM_INT);
        $stmt->bindParam(4, $mes, PDO::PARAM_INT);
        $stmt->bindParam(5, $ano, PDO::PARAM_INT);
        $stmt->bindParam(6, $meta_atual['valor_meta'], PDO::PARAM_STR);
        $stmt->bindParam(7, $valor_meta, PDO::PARAM_STR);
        $stmt->bindParam(8, $observacoes, PDO::PARAM_STR);
        $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
        $stmt->bindParam(9, $usuario_nome, PDO::PARAM_STR);
        $stmt->execute();
    }
    
    // Atualizar a meta
    $stmt = $conn->prepare("UPDATE metas_vendas SET vendedor_id = ?, mes = ?, ano = ?, valor_meta = ?, observacoes = ? WHERE id = ?");
    $stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
    $stmt->bindParam(2, $mes, PDO::PARAM_INT);
    $stmt->bindParam(3, $ano, PDO::PARAM_INT);
    $stmt->bindParam(4, $valor_meta, PDO::PARAM_STR);
    $stmt->bindParam(5, $observacoes, PDO::PARAM_STR);
    $stmt->bindParam(6, $meta_id, PDO::PARAM_INT);
} else {
    // Meta de cadastro de clientes
    $quantidade_meta = isset($data->quantidade_meta) ? intval($data->quantidade_meta) : $meta_atual['quantidade_meta'];
    
    // Verificar se a quantidade da meta é positiva
    if ($quantidade_meta <= 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Quantidade da meta deve ser maior que zero."
        ]);
        exit;
    }
    
    // Registrar no histórico
    if ($quantidade_meta !== $meta_atual['quantidade_meta']) {
        // Verificar se a tabela existe
        $query_check = "SELECT COUNT(*) FROM information_schema.tables 
                       WHERE table_schema = DATABASE() 
                       AND table_name = 'historico_atualizacao_metas'";
        $stmt_check = $conn->prepare($query_check);
        $stmt_check->execute();
        $table_exists = (bool)$stmt_check->fetchColumn();
        
        if (!$table_exists) {
            // Criar a tabela se não existir
            $query_create = "CREATE TABLE historico_atualizacao_metas (
                id INT(11) NOT NULL AUTO_INCREMENT,
                meta_id INT(11) NOT NULL,
                tipo_meta VARCHAR(50) NOT NULL,
                vendedor_id INT(11) NOT NULL,
                mes INT(11) NOT NULL,
                ano INT(11) NOT NULL,
                valor_anterior DECIMAL(10,2) NULL DEFAULT NULL,
                valor_novo DECIMAL(10,2) NULL DEFAULT NULL,
                quantidade_anterior INT(11) NULL DEFAULT NULL,
                quantidade_nova INT(11) NULL DEFAULT NULL,
                observacoes TEXT NULL DEFAULT NULL,
                data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100) NOT NULL,
                PRIMARY KEY (id),
                INDEX fk_historico_vendedor_idx (vendedor_id ASC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";
            
            $stmt_create = $conn->prepare($query_create);
            $stmt_create->execute();
        }
        
        $stmt = $conn->prepare("INSERT INTO historico_atualizacao_metas 
                               (tipo_meta, meta_id, vendedor_id, mes, ano, quantidade_anterior, quantidade_nova, observacoes, usuario) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bindParam(1, $tipo_meta, PDO::PARAM_STR);
        $stmt->bindParam(2, $meta_id, PDO::PARAM_INT);
        $stmt->bindParam(3, $vendedor_id, PDO::PARAM_INT);
        $stmt->bindParam(4, $mes, PDO::PARAM_INT);
        $stmt->bindParam(5, $ano, PDO::PARAM_INT);
        $stmt->bindParam(6, $meta_atual['quantidade_meta'], PDO::PARAM_INT);
        $stmt->bindParam(7, $quantidade_meta, PDO::PARAM_INT);
        $stmt->bindParam(8, $observacoes, PDO::PARAM_STR);
        $usuario_nome = isset($payload->usuario) ? $payload->usuario : "Sistema";
        $stmt->bindParam(9, $usuario_nome, PDO::PARAM_STR);
        $stmt->execute();
    }
    
    // Atualizar a meta
    $stmt = $conn->prepare("UPDATE metas_cadastro_clientes SET vendedor_id = ?, mes = ?, ano = ?, quantidade_meta = ?, observacoes = ? WHERE id = ?");
    $stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
    $stmt->bindParam(2, $mes, PDO::PARAM_INT);
    $stmt->bindParam(3, $ano, PDO::PARAM_INT);
    $stmt->bindParam(4, $quantidade_meta, PDO::PARAM_INT);
    $stmt->bindParam(5, $observacoes, PDO::PARAM_STR);
    $stmt->bindParam(6, $meta_id, PDO::PARAM_INT);
}

if ($stmt->execute()) {
    // Buscar a meta atualizada para retornar todos os dados
    $stmt = $conn->prepare("SELECT m.*, v.nome as nome_vendedor, v.rca as rca_vendedor 
                           FROM {$tabela} m 
                           JOIN vendedores v ON m.vendedor_id = v.id 
                           WHERE m.id = ?");
    $stmt->bindParam(1, $meta_id, PDO::PARAM_INT);
    $stmt->execute();
    $meta = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Adicionar o tipo de meta ao resultado
    $meta['tipo_meta'] = $tipo_meta;
    
    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta atualizada com sucesso",
        "meta" => $meta
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro ao atualizar meta."
    ]);
}
?> 