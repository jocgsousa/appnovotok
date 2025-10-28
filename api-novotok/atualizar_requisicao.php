<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: PUT');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

include_once 'database.php';
include_once 'utils/authorization.php';

// Verificar autorização
$auth = new Authorization();
$user_data = $auth->authorize();

if (!$user_data) {
    echo json_encode(['message' => 'Não autorizado']);
    exit();
}

// Inicializar banco de dados
$database = new Database();
$conn = $database->getConnection();

// Obter dados do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

// Verificar se o ID foi fornecido
if (!isset($data->id)) {
    echo json_encode([
        'error' => true,
        'message' => 'ID da requisição não fornecido.'
    ]);
    exit();
}

try {
    // Verificar se a requisição existe
    $check_query = "SELECT id FROM request WHERE id = :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->bindParam(':id', $data->id);
    $check_stmt->execute();
    
    if ($check_stmt->rowCount() == 0) {
        echo json_encode([
            'error' => true,
            'message' => 'Requisição não encontrada.'
        ]);
        exit();
    }
    
    // Construir a consulta de atualização
    $query = "UPDATE request SET ";
    $params = [];
    
    // Adicionar campos a serem atualizados
    if (isset($data->completed)) {
        $query .= "completed = :completed, ";
        $params[':completed'] = $data->completed;
    }
    
    if (isset($data->processando)) {
        $query .= "processando = :processando, ";
        $params[':processando'] = $data->processando;
    }
    
    if (isset($data->error)) {
        $query .= "error = :error, ";
        $params[':error'] = $data->error;
    }
    
    if (isset($data->initial)) {
        $query .= "initial = :initial, ";
        $params[':initial'] = $data->initial;
    }
    
    if (isset($data->message)) {
        $query .= "message = :message, ";
        $params[':message'] = $data->message;
    }
    
    if (isset($data->nregistros)) {
        $query .= "nregistros = :nregistros, ";
        $params[':nregistros'] = $data->nregistros;
    }
    
    // Remover a vírgula e o espaço finais
    $query = rtrim($query, ", ");
    
    // Adicionar a condição WHERE
    $query .= " WHERE id = :id";
    $params[':id'] = $data->id;
    
    // Verificar se há campos para atualizar
    if (count($params) <= 1) { // Apenas o ID
        echo json_encode([
            'error' => true,
            'message' => 'Nenhum campo para atualizar foi fornecido.'
        ]);
        exit();
    }
    
    // Preparar e executar a consulta
    $stmt = $conn->prepare($query);
    
    // Vincular parâmetros
    foreach ($params as $param => $value) {
        if ($param == ':completed' || $param == ':processando' || $param == ':error' || $param == ':initial') {
            $stmt->bindValue($param, $value, PDO::PARAM_BOOL);
        } else {
            $stmt->bindValue($param, $value);
        }
    }
    
    // Executar a atualização
    if ($stmt->execute()) {
        echo json_encode([
            'message' => 'Requisição atualizada com sucesso.',
            'id' => $data->id
        ]);
    } else {
        echo json_encode([
            'error' => true,
            'message' => 'Não foi possível atualizar a requisição.'
        ]);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'error' => true,
        'message' => 'Erro ao atualizar requisição: ' . $e->getMessage()
    ]);
} 