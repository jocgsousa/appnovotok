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
    $usuario_id = $payload->id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se todos os dados necessários foram fornecidos
if (!isset($data->nome) || !isset($data->descricao) || !isset($data->metas)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Dados incompletos. Forneça nome, descricao e metas."
    ]);
    exit;
}

// Validar os dados básicos
$nome = trim($data->nome);
$descricao = trim($data->descricao);
$metas = $data->metas;
$ativo = isset($data->ativo) ? (bool)$data->ativo : true;

// Validações
if (empty($nome)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Nome do grupo é obrigatório."
    ]);
    exit;
}

if (!is_array($metas) || empty($metas)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "É necessário fornecer pelo menos uma meta."
    ]);
    exit;
}

// Validar cada meta
foreach ($metas as $index => $meta) {
    if (!isset($meta->nomeProdutoMarca) || !isset($meta->qtdMeta) || !isset($meta->percentualSobreVenda)) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Meta " . ($index + 1) . " está incompleta. Forneça nomeProdutoMarca, qtdMeta e percentualSobreVenda."
        ]);
        exit;
    }

    if (empty(trim($meta->nomeProdutoMarca))) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Nome do produto/marca é obrigatório na meta " . ($index + 1) . "."
        ]);
        exit;
    }

    if (!is_numeric($meta->qtdMeta) || $meta->qtdMeta < 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Quantidade meta deve ser um número válido na meta " . ($index + 1) . "."
        ]);
        exit;
    }

    if (!is_numeric($meta->percentualSobreVenda) || $meta->percentualSobreVenda < 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Percentual sobre venda deve ser um número válido na meta " . ($index + 1) . "."
        ]);
        exit;
    }
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Iniciar transação
    $conn->beginTransaction();

    // Gerar ID único para o grupo
    $grupo_id = uniqid('grupo_', true);

    // Verificar se já existe um grupo com o mesmo nome
    $sqlCheck = "SELECT id FROM grupos_metas_produtos WHERE nome = ?";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindValue(1, $nome);
    $stmtCheck->execute();

    if ($stmtCheck->rowCount() > 0) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Já existe um grupo com este nome."
        ]);
        exit;
    }

    // Inserir o grupo
    $sqlGrupo = "INSERT INTO grupos_metas_produtos (id, nome, descricao, data_criacao, ativo) 
                 VALUES (?, ?, ?, CURDATE(), ?)";
    $stmtGrupo = $conn->prepare($sqlGrupo);
    $stmtGrupo->bindValue(1, $grupo_id);
    $stmtGrupo->bindValue(2, $nome);
    $stmtGrupo->bindValue(3, $descricao);
    $stmtGrupo->bindValue(4, $ativo ? 1 : 0);
    $stmtGrupo->execute();

    // Inserir as metas do grupo
    $sqlMeta = "INSERT INTO metas_produtos_grupo (id, grupo_id, nome_produto_marca, qtd_meta, percentual_sobre_venda) 
                VALUES (?, ?, ?, ?, ?)";
    $stmtMeta = $conn->prepare($sqlMeta);

    foreach ($metas as $meta) {
        $meta_id = uniqid('meta_', true);
        $stmtMeta->bindValue(1, $meta_id);
        $stmtMeta->bindValue(2, $grupo_id);
        $stmtMeta->bindValue(3, trim($meta->nomeProdutoMarca));
        $stmtMeta->bindValue(4, (int)$meta->qtdMeta);
        $stmtMeta->bindValue(5, (float)$meta->percentualSobreVenda);
        $stmtMeta->execute();
    }

    // Confirmar transação
    $conn->commit();

    // Buscar o grupo criado para retornar
    $sqlSelect = "SELECT g.*, COUNT(m.id) as total_metas
                  FROM grupos_metas_produtos g 
                  LEFT JOIN metas_produtos_grupo m ON g.id = m.grupo_id 
                  WHERE g.id = ?
                  GROUP BY g.id";
    $stmtSelect = $conn->prepare($sqlSelect);
    $stmtSelect->bindValue(1, $grupo_id);
    $stmtSelect->execute();
    $grupo = $stmtSelect->fetch(PDO::FETCH_ASSOC);

    // Buscar as metas do grupo
    $sqlMetas = "SELECT * FROM metas_produtos_grupo WHERE grupo_id = ? ORDER BY nome_produto_marca";
    $stmtMetas = $conn->prepare($sqlMetas);
    $stmtMetas->bindValue(1, $grupo_id);
    $stmtMetas->execute();
    
    $metasRetorno = [];
    while ($meta = $stmtMetas->fetch(PDO::FETCH_ASSOC)) {
        $metasRetorno[] = [
            'id' => $meta['id'],
            'nomeProdutoMarca' => $meta['nome_produto_marca'],
            'qtdMeta' => (int)$meta['qtd_meta'],
            'percentualSobreVenda' => (float)$meta['percentual_sobre_venda']
        ];
    }

    $grupoRetorno = [
        'id' => $grupo['id'],
        'nome' => $grupo['nome'],
        'descricao' => $grupo['descricao'],
        'metas' => $metasRetorno,
        'dataCriacao' => $grupo['data_criacao'],
        'ativo' => (bool)$grupo['ativo'],
        'totalMetas' => (int)$grupo['total_metas']
    ];

    http_response_code(201);
    echo json_encode([
        "status" => 1,
        "message" => "Grupo de metas cadastrado com sucesso",
        "data" => $grupoRetorno
    ]);

} catch (Exception $e) {
    // Reverter transação em caso de erro
    $conn->rollBack();
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>