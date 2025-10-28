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

// Verificando se o array de pedidos foi fornecido
if (!isset($data->pedidos) || !is_array($data->pedidos) || empty($data->pedidos)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Array de pedidos é obrigatório e não pode estar vazio."
    ]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Iniciar transação para garantir consistência
    $db->beginTransaction();
    
    $pedidos_processados = 0;
    $pedidos_atualizados = 0;
    $pedidos_inseridos = 0;
    $erros = [];
    
    foreach ($data->pedidos as $index => $pedido_data) {
        try {
            // Verificando se os campos necessários foram fornecidos para cada pedido
            if (!isset($pedido_data->pedido) || !isset($pedido_data->filial) || !isset($pedido_data->caixa) || !isset($pedido_data->data)) {
                $erros[] = "Pedido no índice {$index}: Pedido, filial, caixa e data são obrigatórios.";
                continue;
            }
            
            // Verificar se o pedido já existe
            $query_check = "SELECT pedido FROM pedidos WHERE pedido = :pedido";
            $stmt_check = $db->prepare($query_check);
            $stmt_check->bindParam(':pedido', $pedido_data->pedido);
            $stmt_check->execute();
            
            // Preparando os dados JSON para armazenamento
            $itens_json = json_encode($pedido_data->itens);
            $cancelados_json = json_encode($pedido_data->cancelados);
            
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
                $pedidos_atualizados++;
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
                $pedidos_inseridos++;
            }
            
            $stmt = $db->prepare($query);
            
            // Formatando a data para o formato MySQL
            $data_mysql = date('Y-m-d H:i:s', strtotime($pedido_data->data));
            $data_registro = isset($pedido_data->data_registro_produto) ? date('Y-m-d H:i:s', strtotime($pedido_data->data_registro_produto)) : null;
            
            // Vinculando os parâmetros
            $stmt->bindParam(':pedido', $pedido_data->pedido);
            $stmt->bindParam(':filial', $pedido_data->filial);
            $stmt->bindParam(':caixa', $pedido_data->caixa);
            $stmt->bindParam(':data', $data_mysql);
            $stmt->bindParam(':funccx', $pedido_data->funccx);
            $stmt->bindParam(':itens', $itens_json);
            $stmt->bindParam(':cancelados', $cancelados_json);
            $stmt->bindParam(':codcob', $pedido_data->codcob);
            $stmt->bindParam(':total_itens', $pedido_data->total_itens);
            $stmt->bindParam(':total_cancelados', $pedido_data->total_cancelados);
            $stmt->bindParam(':data_registro_produto', $data_registro);
            $stmt->bindParam(':vendedor', $pedido_data->vendedor);
            
            // Executando a consulta
            if ($stmt->execute()) {
                $pedidos_processados++;
            } else {
                $erros[] = "Erro ao processar pedido {$pedido_data->pedido}: Falha na execução da query.";
            }
            
        } catch (Exception $e) {
            $erros[] = "Erro ao processar pedido no índice {$index}: " . $e->getMessage();
        }
    }
    
    // Se houve erros críticos, fazer rollback
    if (count($erros) > 0 && $pedidos_processados == 0) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Falha ao processar lote de pedidos.",
            "errors" => $erros,
            "processed" => $pedidos_processados,
            "inserted" => $pedidos_inseridos,
            "updated" => $pedidos_atualizados
        ]);
    } else {
        // Confirmar transação
        $db->commit();
        
        $response = [
            "success" => true,
            "message" => "Lote de pedidos processado com sucesso.",
            "total_pedidos" => count($data->pedidos),
            "processed" => $pedidos_processados,
            "inserted" => $pedidos_inseridos,
            "updated" => $pedidos_atualizados
        ];
        
        // Incluir erros se houver, mas não falhar a operação
        if (count($erros) > 0) {
            $response["warnings"] = $erros;
        }
        
        echo json_encode($response);
    }
    
} catch (PDOException $e) {
    // Rollback em caso de erro de banco
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro no servidor.",
        "error" => $e->getMessage()
    ]);
} catch (Exception $e) {
    // Rollback em caso de erro geral
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro inesperado.",
        "error" => $e->getMessage()
    ]);
}
?>