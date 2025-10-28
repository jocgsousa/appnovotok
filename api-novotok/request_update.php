<?php
// Definindo os cabeçalhos CORS
require_once 'cors_config.php';
include_once 'database.php';
include_once 'jwt_utils.php';

// Verificar o token JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Token inválido ou expirado."
    ]);
    exit;
}

// Decodificando o JSON recebido
$input_data = file_get_contents("php://input");
$data = json_decode($input_data);

// Verificando se o JSON foi decodificado corretamente
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "JSON inválido.",
        "error" => json_last_error_msg()
    ]);
    exit;
}

// Verificando se os campos necessários foram fornecidos
if (!isset($data->id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "ID da requisição é obrigatório."
    ]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Preparando a consulta SQL para atualizar o status da requisição
    $query = "UPDATE request SET 
              processando = :processando,
              completed = :completed,
              error = :error,
              message = :message,
              nregistros = :nregistros
              WHERE id = :id";

    $stmt = $db->prepare($query);

    // Vinculando os parâmetros
    $processando = isset($data->processando) ? $data->processando : false;
    $completed = isset($data->completed) ? $data->completed : false;
    $error = isset($data->error) ? $data->error : false;
    $message = isset($data->message) ? $data->message : null;
    $nregistros = isset($data->nregistros) ? $data->nregistros : 0;

    $stmt->bindParam(':processando', $processando, PDO::PARAM_BOOL);
    $stmt->bindParam(':completed', $completed, PDO::PARAM_BOOL);
    $stmt->bindParam(':error', $error, PDO::PARAM_BOOL);
    $stmt->bindParam(':message', $message);
    $stmt->bindParam(':nregistros', $nregistros, PDO::PARAM_INT);
    $stmt->bindParam(':id', $data->id, PDO::PARAM_INT);

    // Executando a consulta
    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Status da requisição atualizado com sucesso."
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Erro ao atualizar status da requisição."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro no servidor.",
        "error" => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro inesperado.",
        "error" => $e->getMessage()
    ]);
} 