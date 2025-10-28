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
if (!isset($data->filial) || !isset($data->caixa)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Filial e caixa são obrigatórios."
    ]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Consulta para buscar requisições pendentes para a filial e caixa especificadas
    // Requisições pendentes são aquelas onde processando = false, completed = false e error = false
    $query = "SELECT * FROM request 
              WHERE filial = :filial 
              AND caixa = :caixa 
              AND processando = false 
              AND completed = false 
              AND error = false
              ORDER BY created_at ASC";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':filial', $data->filial);
    $stmt->bindParam(':caixa', $data->caixa);
    $stmt->execute();

    $requests = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Formatando a data para o formato ISO
        $row['datavendas'] = date('Y-m-d', strtotime($row['datavendas']));
        $row['created_at'] = date('Y-m-d\TH:i:s', strtotime($row['created_at']));
        
        // Convertendo valores booleanos
        $row['processando'] = (bool)$row['processando'];
        $row['completed'] = (bool)$row['completed'];
        $row['error'] = (bool)$row['error'];
        $row['initial'] = (bool)$row['initial'];
        
        $requests[] = $row;
    }

    // Retornando as requisições encontradas
    echo json_encode($requests);
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