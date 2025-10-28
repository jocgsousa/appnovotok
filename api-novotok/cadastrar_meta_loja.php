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
if (!isset($data->loja_id) || !isset($data->nome_loja) || !isset($data->mes) || !isset($data->ano) || !isset($data->grupo_meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Dados incompletos. Forneça loja_id, nome_loja, mes, ano e grupo_meta_id."
    ]);
    exit;
}

// Validar os dados
$loja_id = trim($data->loja_id);
$nome_loja = trim($data->nome_loja);
$mes = (int)$data->mes;
$ano = (int)$data->ano;
$grupo_meta_id = trim($data->grupo_meta_id);
$ativo = isset($data->ativo) ? (bool)$data->ativo : true;

// Validações
if (empty($loja_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da loja é obrigatório."
    ]);
    exit;
}

if (empty($nome_loja)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Nome da loja é obrigatório."
    ]);
    exit;
}

if ($mes < 1 || $mes > 12) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Mês deve estar entre 1 e 12."
    ]);
    exit;
}

if ($ano < 2020 || $ano > 2050) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Ano deve estar entre 2020 e 2050."
    ]);
    exit;
}

if (empty($grupo_meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID do grupo de metas é obrigatório."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Verificar se o grupo de metas existe e está ativo
    $sqlCheckGrupo = "SELECT id, nome, ativo FROM grupos_metas_produtos WHERE id = ?";
    $stmtCheckGrupo = $conn->prepare($sqlCheckGrupo);
    $stmtCheckGrupo->bindValue(1, $grupo_meta_id);
    $stmtCheckGrupo->execute();

    if ($stmtCheckGrupo->rowCount() === 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Grupo de metas não encontrado."
        ]);
        exit;
    }

    $grupo = $stmtCheckGrupo->fetch(PDO::FETCH_ASSOC);
    if (!$grupo['ativo']) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Não é possível usar um grupo de metas inativo."
        ]);
        exit;
    }

    // Verificar se já existe uma meta para esta loja no mesmo período
    $sqlCheckExistente = "SELECT id FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?";
    $stmtCheckExistente = $conn->prepare($sqlCheckExistente);
    $stmtCheckExistente->bindValue(1, $loja_id);
    $stmtCheckExistente->bindValue(2, $mes);
    $stmtCheckExistente->bindValue(3, $ano);
    $stmtCheckExistente->execute();

    if ($stmtCheckExistente->rowCount() > 0) {
        http_response_code(400);
        echo json_encode([
            "status" => 0,
            "message" => "Já existe uma meta para esta loja no período informado."
        ]);
        exit;
    }

    // Gerar ID único para a meta
    $meta_id = uniqid('meta_loja_', true);

    // Inserir a meta de loja
    $sql = "INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(1, $meta_id);
    $stmt->bindValue(2, $loja_id);
    $stmt->bindValue(3, $nome_loja);
    $stmt->bindValue(4, $mes);
    $stmt->bindValue(5, $ano);
    $stmt->bindValue(6, $grupo_meta_id);
    $stmt->bindValue(7, $ativo ? 1 : 0);
    $stmt->execute();

    // Buscar a meta criada para retornar
    $sqlSelect = "SELECT 
                    ml.id,
                    ml.loja_id,
                    ml.nome_loja,
                    ml.mes,
                    ml.ano,
                    ml.grupo_meta_id,
                    gmp.nome as grupo_meta_nome,
                    gmp.descricao as grupo_meta_descricao,
                    ml.data_criacao,
                    ml.ativo,
                    COUNT(mpg.id) as total_metas_produtos
                  FROM metas_lojas ml
                  LEFT JOIN grupos_metas_produtos gmp ON ml.grupo_meta_id = gmp.id
                  LEFT JOIN metas_produtos_grupo mpg ON gmp.id = mpg.grupo_id
                  WHERE ml.id = ?
                  GROUP BY ml.id";
    $stmtSelect = $conn->prepare($sqlSelect);
    $stmtSelect->bindValue(1, $meta_id);
    $stmtSelect->execute();
    $meta = $stmtSelect->fetch(PDO::FETCH_ASSOC);

    // Função para obter nome do mês
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
    }

    $metaRetorno = [
        'id' => $meta['id'],
        'lojaId' => $meta['loja_id'],
        'nomeLoja' => $meta['nome_loja'],
        'mes' => (int)$meta['mes'],
        'nomeMes' => getNomeMes((int)$meta['mes']),
        'ano' => (int)$meta['ano'],
        'periodo' => getNomeMes((int)$meta['mes']) . '/' . $meta['ano'],
        'grupoMetaId' => $meta['grupo_meta_id'],
        'grupoMetaNome' => $meta['grupo_meta_nome'],
        'grupoMetaDescricao' => $meta['grupo_meta_descricao'],
        'totalMetasProdutos' => (int)$meta['total_metas_produtos'],
        'dataCriacao' => $meta['data_criacao'],
        'ativo' => (bool)$meta['ativo']
    ];

    http_response_code(201);
    echo json_encode([
        "status" => 1,
        "message" => "Meta de loja cadastrada com sucesso",
        "data" => $metaRetorno
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>