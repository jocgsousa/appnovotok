<?php

require_once 'cors_config.php';
require_once 'database.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Lê o corpo da requisição JSON
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    // Verifica se o JSON foi decodificado corretamente
    if ($input === null) {
        echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON.']);
        exit;
    }

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Obtém os valores de codativi e ramo
    $codativi = isset($input['codativi']) ? $input['codativi'] : null;
    $ramo = isset($input['ramo']) ? $input['ramo'] : null;

    // Valida os dados obrigatórios
    if ($codativi === null || $ramo === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Campos codativi e ramo são obrigatórios.']);
        exit;
    }

    // Verifica se o codativi já existe na tabela
    if (codativiExists($conn, $codativi)) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Ramo de atividade já cadastrado.', 'codativi' => $codativi]);
        exit;
    }

    // Insere o novo ramo de atividade no banco de dados
    $sql = "INSERT INTO pcativi (codativi, ramo) VALUES (:codativi, :ramo)";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codativi', $codativi);
    $stmt->bindParam(':ramo', $ramo);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Ramo de atividade cadastrado com sucesso!', 'codativi' => $codativi]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao cadastrar ramo de atividade: ' . $stmt->errorInfo()[2]]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use POST.']);
}

// Função para verificar se o codativi já existe no banco de dados
function codativiExists($conn, $codativi) {
    $sql = "SELECT id FROM pcativi WHERE codativi = :codativi";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codativi', $codativi);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}

?>