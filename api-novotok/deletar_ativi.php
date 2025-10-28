<?php
require_once 'cors_config.php';
// Inclui as classes Database e JwtUtils
require_once 'database.php';
require_once 'jwt_utils.php';

// Verifica se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Lê o corpo da requisição JSON
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    // Verifica se o JSON foi decodificado corretamente
    if ($input === null) {
        echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON.']);
        exit;
    }

    // Obtém o bearer_token do cabeçalho Authorization
    $headers = apache_request_headers();
    $bearer_token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    // Valida o bearer_token
    $user_id = JwtUtils::validateToken($bearer_token);
    if ($user_id === null) {
        echo json_encode(['success' => false, 'message' => 'Token inválido.']);
        exit;
    }

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Obtém o valor de id da requisição JSON
    $id = isset($input['id']) ? $input['id'] : null;

    // Verifica se o id foi enviado
    if ($id === null) {
        echo json_encode(['success' => false, 'message' => 'Parâmetro id é obrigatório.']);
        exit;
    }

    // Verifica se o id existe na base de dados
    if (!atividadeExists($conn, $id)) {
        echo json_encode(['success' => false, 'message' => 'Atividade não encontrada na base de dados.']);
        exit;
    }

    // Exclui a atividade da base de dados
    $sql = "DELETE FROM pcativi WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Atividade excluída com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao excluir atividade: ' . $stmt->errorInfo()[2]]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use DELETE.']);
}

// Função para verificar se o id da atividade existe na base de dados
function atividadeExists($conn, $id) {
    $sql = "SELECT id FROM pcativi WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}
?>