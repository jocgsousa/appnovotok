<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../database.php';
include_once '../cors_config.php';
include_once '../jwt_utils.php';

// Inicializa a resposta
$response = array(
    "success" => false,
    "message" => ""
);

// Verifica o método da requisição
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    $response["message"] = "Método não permitido.";
    echo json_encode($response);
    exit;
}

// Verifica a autenticação
$headers = apache_request_headers();
$jwt = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

if (!JwtUtils::validateToken($jwt)) {
    $response["message"] = "Acesso não autorizado.";
    echo json_encode($response);
    exit;
}

// Obtém os dados do corpo da requisição
$data = json_decode(file_get_contents("php://input"));

// Verifica se os dados obrigatórios foram fornecidos
if (!isset($data->id) || empty($data->id) || !isset($data->titulo) || empty($data->titulo) || !isset($data->texto) || empty($data->texto)) {
    $response["message"] = "Dados incompletos. ID, título e texto são obrigatórios.";
    echo json_encode($response);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Inicia a transação
    $db->beginTransaction();
    
    // Verifica se o informativo existe
    $query_check = "SELECT id FROM informativos WHERE id = ?";
    $stmt_check = $db->prepare($query_check);
    $stmt_check->bindParam(1, $data->id);
    $stmt_check->execute();
    
    if ($stmt_check->rowCount() === 0) {
        throw new Exception("Informativo não encontrado.");
    }
    
    // Prepara a query para atualizar o informativo
    $query = "UPDATE informativos 
              SET titulo = ?, texto = ?, ativo = ?, updated_at = NOW() 
              WHERE id = ?";
    
    $stmt = $db->prepare($query);
    
    // Limpa e sanitiza os dados
    $titulo = htmlspecialchars(strip_tags($data->titulo));
    $texto = htmlspecialchars(strip_tags($data->texto));
    $ativo = isset($data->ativo) ? $data->ativo : 1;
    $id = $data->id;
    
    // Vincula os parâmetros
    $stmt->bindParam(1, $titulo);
    $stmt->bindParam(2, $texto);
    $stmt->bindParam(3, $ativo);
    $stmt->bindParam(4, $id);
    
    // Executa a query
    if ($stmt->execute()) {
        // Se houver imagens para atualizar
        if (isset($data->imagens) && is_array($data->imagens)) {
            // Primeiro remove todas as imagens existentes
            $query_delete = "DELETE FROM informativos_imagens WHERE informativo_id = ?";
            $stmt_delete = $db->prepare($query_delete);
            $stmt_delete->bindParam(1, $id);
            $stmt_delete->execute();
            
            // Depois insere as novas imagens
            if (count($data->imagens) > 0) {
                $query_imagem = "INSERT INTO informativos_imagens (informativo_id, imagem, tipo_imagem, descricao, ordem) 
                                VALUES (?, ?, ?, ?, ?)";
                
                $stmt_imagem = $db->prepare($query_imagem);
                
                foreach ($data->imagens as $index => $imagem) {
                    if (!isset($imagem->imagem) || empty($imagem->imagem) || !isset($imagem->tipo_imagem)) {
                        continue; // Pula imagens sem dados
                    }
                    
                    // Decodifica a imagem de base64
                    $imagemBinaria = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $imagem->imagem));
                    
                    if ($imagemBinaria === false) {
                        continue; // Pula se a decodificação falhar
                    }
                    
                    $tipoImagem = htmlspecialchars(strip_tags($imagem->tipo_imagem));
                    $descricao = isset($imagem->descricao) ? htmlspecialchars(strip_tags($imagem->descricao)) : '';
                    $ordem = isset($imagem->ordem) ? $imagem->ordem : $index;
                    
                    $stmt_imagem->bindParam(1, $id);
                    $stmt_imagem->bindParam(2, $imagemBinaria, PDO::PARAM_LOB);
                    $stmt_imagem->bindParam(3, $tipoImagem);
                    $stmt_imagem->bindParam(4, $descricao);
                    $stmt_imagem->bindParam(5, $ordem);
                    
                    if (!$stmt_imagem->execute()) {
                        throw new Exception("Erro ao inserir imagem.");
                    }
                }
            }
        }
        
        // Commit da transação
        $db->commit();
        
        $response["success"] = true;
        $response["message"] = "Informativo atualizado com sucesso.";
    } else {
        throw new Exception("Erro ao atualizar informativo.");
    }
    
} catch (Exception $e) {
    // Rollback em caso de erro
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $response["message"] = "Erro ao atualizar informativo: " . $e->getMessage();
}

// Retorna a resposta em formato JSON
echo json_encode($response);
?> 