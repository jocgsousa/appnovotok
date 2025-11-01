<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: DELETE");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é DELETE
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas DELETE é aceito."
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
    $usuario_id = $payload->data->user_id;
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Obter o ID da meta da URL
$meta_id = isset($_GET['id']) ? trim($_GET['id']) : '';

if (empty($meta_id)) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID da meta é obrigatório."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Verificar se a meta existe
    $sqlCheck = "SELECT id, nome_loja, mes, ano FROM metas_lojas WHERE id = ?";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindValue(1, $meta_id);
    $stmtCheck->execute();

    if ($stmtCheck->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "status" => 0,
            "message" => "Meta de loja não encontrada."
        ]);
        exit;
    }

    $meta = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    // Função para obter nome do mês
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
    }

    // Iniciar transação para garantir integridade dos dados
    $conn->beginTransaction();

    // Deletar dados das subseções relacionadas
    
    // 1. Deletar metas de produtos de todos os funcionários desta meta
    $sqlDeleteProdutos = "DELETE FROM meta_loja_produtos WHERE meta_loja_id = ?";
    $stmtDeleteProdutos = $conn->prepare($sqlDeleteProdutos);
    $stmtDeleteProdutos->bindValue(1, $meta_id);
    $stmtDeleteProdutos->execute();

    // 2. Deletar operadoras de caixa
    $sqlDeleteOperadoras = "DELETE FROM meta_loja_operadoras_caixa WHERE meta_loja_id = ?";
    $stmtDeleteOperadoras = $conn->prepare($sqlDeleteOperadoras);
    $stmtDeleteOperadoras->bindValue(1, $meta_id);
    $stmtDeleteOperadoras->execute();

    // 3. Deletar vendedoras
    $sqlDeleteVendedoras = "DELETE FROM meta_loja_vendedoras WHERE meta_loja_id = ?";
    $stmtDeleteVendedoras = $conn->prepare($sqlDeleteVendedoras);
    $stmtDeleteVendedoras->bindValue(1, $meta_id);
    $stmtDeleteVendedoras->execute();

    // 4. Deletar vendedoras bijou
    $sqlDeleteVendedorasBijou = "DELETE FROM meta_loja_vendedoras_bijou WHERE meta_loja_id = ?";
    $stmtDeleteVendedorasBijou = $conn->prepare($sqlDeleteVendedorasBijou);
    $stmtDeleteVendedorasBijou->bindValue(1, $meta_id);
    $stmtDeleteVendedorasBijou->execute();

    // 5. Deletar gerente
    $sqlDeleteGerente = "DELETE FROM meta_loja_gerente WHERE meta_loja_id = ?";
    $stmtDeleteGerente = $conn->prepare($sqlDeleteGerente);
    $stmtDeleteGerente->bindValue(1, $meta_id);
    $stmtDeleteGerente->execute();

    // 6. Deletar campanhas
    $sqlDeleteCampanhas = "DELETE FROM meta_loja_campanhas WHERE meta_loja_id = ?";
    $stmtDeleteCampanhas = $conn->prepare($sqlDeleteCampanhas);
    $stmtDeleteCampanhas->bindValue(1, $meta_id);
    $stmtDeleteCampanhas->execute();

    // 7. Deletar funcionários (outros)
    $sqlDeleteFuncionarios = "DELETE FROM meta_loja_funcionarios WHERE meta_loja_id = ?";
    $stmtDeleteFuncionarios = $conn->prepare($sqlDeleteFuncionarios);
    $stmtDeleteFuncionarios->bindValue(1, $meta_id);
    $stmtDeleteFuncionarios->execute();

    // 8. Deletar a meta de loja principal
    $sqlDelete = "DELETE FROM metas_lojas WHERE id = ?";
    $stmtDelete = $conn->prepare($sqlDelete);
    $stmtDelete->bindValue(1, $meta_id);
    $stmtDelete->execute();

    // Confirmar a transação
    $conn->commit();

    $periodo = getNomeMes((int)$meta['mes']) . '/' . $meta['ano'];

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Meta da loja '" . $meta['nome_loja'] . "' para o período " . $periodo . " e todos os dados relacionados excluídos com sucesso"
    ]);

} catch (Exception $e) {
    // Fazer rollback da transação em caso de erro
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>