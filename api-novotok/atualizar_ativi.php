<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Verifica se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Lê o corpo da requisição JSON
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    // Verifica se o JSON foi decodificado corretamente
    if ($input === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON.']);
        exit;
    }

    // Obtém o bearer_token do cabeçalho Authorization
    $headers = apache_request_headers();
    $bearer_token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    // Valida o bearer_token
    $user_id = JwtUtils::validateToken($bearer_token);
    if ($user_id === null) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido.']);
        exit;
    }

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Obtém os valores da requisição JSON
    $id = isset($input['id']) ? $input['id'] : null;
    $codativi = isset($input['codativi']) ? $input['codativi'] : null;
    $ramo = isset($input['ramo']) ? $input['ramo'] : null;

    // Verifica se os campos obrigatórios foram enviados
    if ($id === null || $codativi === null || $ramo === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Campos id, codativi e ramo são obrigatórios.']);
        exit;
    }

    // Verifica se o id existe na base de dados
    if (!atividadeExists($conn, $id)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Atividade não encontrada na base de dados.']);
        exit;
    }

    // Verifica se o codativi já existe para outro registro
    if (codativiExistsForAnother($conn, $codativi, $id)) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Código de atividade já está em uso por outro registro.']);
        exit;
    }

    // Atualiza o ramo de atividade na base de dados
    $sql = "UPDATE pcativi SET codativi = :codativi, ramo = :ramo, updated_at = NOW() WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codativi', $codativi);
    $stmt->bindParam(':ramo', $ramo);
    $stmt->bindParam(':id', $id);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Ramo de atividade atualizado com sucesso!']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar ramo de atividade: ' . $stmt->errorInfo()[2]]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use POST.']);
}

// Função para verificar se o id da atividade existe na base de dados
function atividadeExists($conn, $id) {
    $sql = "SELECT id FROM pcativi WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}

// Função para verificar se o codativi já existe para outro registro
function codativiExistsForAnother($conn, $codativi, $id) {
    $sql = "SELECT id FROM pcativi WHERE codativi = :codativi AND id != :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codativi', $codativi);
    $stmt->bindParam(':id', $id);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}
?> 