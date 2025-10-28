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
if (!isset($data->pedido) || !isset($data->filial) || !isset($data->caixa) || !isset($data->data)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Pedido, filial, caixa e data são obrigatórios."
    ]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Verificar se o pedido já existe
    $query_check = "SELECT pedido FROM pedidos WHERE pedido = :pedido";
    $stmt_check = $db->prepare($query_check);
    $stmt_check->bindParam(':pedido', $data->pedido);
    $stmt_check->execute();

    // Preparando os dados JSON para armazenamento
    $itens_json = json_encode($data->itens);
    $cancelados_json = json_encode($data->cancelados);

    // Se o pedido já existe, atualiza
    if ($stmt_check->rowCount() > 0) {
        $query = "UPDATE pedidos SET 
                  filial = :filial, 
                  caixa = :caixa, 
                  data = :data, 
                  funccx = :funccx, 
                  itens = :itens, 
                  cancelados = :cancelados, 
                  codcob = :codcob,
                  total_itens = :total_itens,
                  total_cancelados = :total_cancelados,
                  data_registro_produto = :data_registro_produto,
                  vendedor = :vendedor
                  WHERE pedido = :pedido";
    } else {
        // Se não existe, insere um novo
        $query = "INSERT INTO pedidos (
                    pedido, 
                    filial, 
                    caixa, 
                    data, 
                    funccx, 
                    itens, 
                    cancelados, 
                    codcob,
                    total_itens,
                    total_cancelados,
                    data_registro_produto,
                    vendedor
                  ) VALUES (
                    :pedido, 
                    :filial, 
                    :caixa, 
                    :data, 
                    :funccx, 
                    :itens, 
                    :cancelados, 
                    :codcob,
                    :total_itens,
                    :total_cancelados,
                    :data_registro_produto,
                    :vendedor
                  )";
    }

    $stmt = $db->prepare($query);

    // Formatando a data para o formato MySQL
    $data_mysql = date('Y-m-d H:i:s', strtotime($data->data));
    $data_registro = isset($data->data_registro_produto) ? date('Y-m-d H:i:s', strtotime($data->data_registro_produto)) : null;

    // Vinculando os parâmetros
    $stmt->bindParam(':pedido', $data->pedido);
    $stmt->bindParam(':filial', $data->filial);
    $stmt->bindParam(':caixa', $data->caixa);
    $stmt->bindParam(':data', $data_mysql);
    $stmt->bindParam(':funccx', $data->funccx);
    $stmt->bindParam(':itens', $itens_json);
    $stmt->bindParam(':cancelados', $cancelados_json);
    $stmt->bindParam(':codcob', $data->codcob);
    $stmt->bindParam(':total_itens', $data->total_itens);
    $stmt->bindParam(':total_cancelados', $data->total_cancelados);
    $stmt->bindParam(':data_registro_produto', $data_registro);
    $stmt->bindParam(':vendedor', $data->vendedor);

    // Executando a consulta
    if ($stmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Pedido registrado com sucesso.",
            "pedido" => $data->pedido
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Erro ao registrar pedido."
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