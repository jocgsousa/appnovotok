<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: DELETE");
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
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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

// Verifica se o ID foi fornecido
if (!isset($_GET['id']) || empty($_GET['id'])) {
    $response["message"] = "ID do informativo não fornecido.";
    echo json_encode($response);
    exit;
}

$id = $_GET['id'];

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Inicia a transação
    $db->beginTransaction();
    
    // Verifica se o informativo existe
    $query_check = "SELECT id FROM informativos WHERE id = ?";
    $stmt_check = $db->prepare($query_check);
    $stmt_check->bindParam(1, $id);
    $stmt_check->execute();
    
    if ($stmt_check->rowCount() === 0) {
        throw new Exception("Informativo não encontrado.");
    }
    
    // Primeiro exclui as imagens relacionadas ao informativo
    $query_delete_images = "DELETE FROM informativos_imagens WHERE informativo_id = ?";
    $stmt_delete_images = $db->prepare($query_delete_images);
    $stmt_delete_images->bindParam(1, $id);
    
    if (!$stmt_delete_images->execute()) {
        throw new Exception("Erro ao excluir imagens do informativo.");
    }
    
    // Depois exclui o informativo
    $query_delete = "DELETE FROM informativos WHERE id = ?";
    $stmt_delete = $db->prepare($query_delete);
    $stmt_delete->bindParam(1, $id);
    
    if ($stmt_delete->execute()) {
        // Commit da transação
        $db->commit();
        
        $response["success"] = true;
        $response["message"] = "Informativo excluído com sucesso.";
    } else {
        throw new Exception("Erro ao excluir informativo.");
    }
    
} catch (Exception $e) {
    // Rollback em caso de erro
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $response["message"] = "Erro ao excluir informativo: " . $e->getMessage();
}

// Retorna a resposta em formato JSON
echo json_encode($response);
?> 