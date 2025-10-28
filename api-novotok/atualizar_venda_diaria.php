<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se o ID foi fornecido
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID não fornecido']);
        exit;
    }
    
    // Verificar se pelo menos um campo para atualização foi fornecido
    $campos_atualizaveis = ['data', 'codusur', 'nome', 'media_itens', 'ticket_medio', 'vlcustofin', 
                           'qtcliente', 'qtd_pedidos', 'via', 'vlvendadodia', 'vldevolucao', 'valor_total'];
    
    $tem_campo_para_atualizar = false;
    foreach ($campos_atualizaveis as $campo) {
        if (isset($data[$campo])) {
            $tem_campo_para_atualizar = true;
            break;
        }
    }
    
    if (!$tem_campo_para_atualizar) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhum campo para atualização fornecido']);
        exit;
    }
    
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se o registro existe
    $stmt = $conn->prepare("SELECT COUNT(*) FROM vendas_diarias WHERE id = :id");
    $stmt->execute(['id' => $data['id']]);
    
    if ($stmt->fetchColumn() == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Registro não encontrado']);
        exit;
    }
    
    // Construir a consulta de atualização
    $sql = "UPDATE vendas_diarias SET ";
    $params = ['id' => $data['id']];
    
    // Log dos valores recebidos para diagnóstico
    error_log("===== VALORES RECEBIDOS EM atualizar_venda_diaria.php =====");
    error_log("id: " . $data['id']);
    
    $campos_atualizados = [];
    foreach ($campos_atualizaveis as $campo) {
        if (isset($data[$campo])) {
            $campos_atualizados[] = "$campo = :$campo";
            
            // Converter para o tipo apropriado
            if (in_array($campo, ['media_itens', 'ticket_medio', 'vlcustofin', 'via', 'vlvendadodia', 'vldevolucao', 'valor_total'])) {
                $params[$campo] = (float) $data[$campo];
                error_log("$campo: " . $data[$campo] . " -> " . $params[$campo] . " (convertido para float)");
            } else if (in_array($campo, ['qtcliente', 'qtd_pedidos'])) {
                $params[$campo] = (int) $data[$campo];
                error_log("$campo: " . $data[$campo] . " -> " . $params[$campo] . " (convertido para int)");
            } else {
                $params[$campo] = $data[$campo];
                error_log("$campo: " . $data[$campo]);
            }
        }
    }
    
    error_log("=====================================================");
    
    $sql .= implode(', ', $campos_atualizados);
    $sql .= " WHERE id = :id";
    
    // Preparar e executar a atualização
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    echo json_encode([
        'success' => true,
        'message' => 'Venda diária atualizada com sucesso',
        'rows_affected' => $stmt->rowCount()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao atualizar venda diária: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 