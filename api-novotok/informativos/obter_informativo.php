<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../database.php';
include_once '../cors_config.php';

// Inicializa a resposta
$response = array(
    "success" => false,
    "message" => "",
    "informativo" => null
);

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

    // Consulta para obter o informativo pelo ID
    $query = "SELECT id, titulo, texto, data, ativo, created_at, updated_at 
              FROM informativos 
              WHERE id = ? AND ativo = 1";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(1, $id);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        extract($row);
        
        // Buscar as imagens relacionadas a este informativo
        $query_imagens = "SELECT id, imagem, tipo_imagem, descricao, ordem 
                         FROM informativos_imagens 
                         WHERE informativo_id = ? 
                         ORDER BY ordem ASC";
        
        $stmt_imagens = $db->prepare($query_imagens);
        $stmt_imagens->bindParam(1, $id);
        $stmt_imagens->execute();
        
        $imagens = array();
        
        while ($img = $stmt_imagens->fetch(PDO::FETCH_ASSOC)) {
            // Converte a imagem binária para base64
            $imagemBase64 = base64_encode($img["imagem"]);
            $tipoImagem = $img["tipo_imagem"];
            
            // Formata como data URI
            $imagemDataUri = 'data:' . $tipoImagem . ';base64,' . $imagemBase64;
            
            $imagens[] = array(
                "id" => $img["id"],
                "imagem" => $imagemDataUri,
                "tipo_imagem" => $tipoImagem,
                "descricao" => $img["descricao"],
                "ordem" => $img["ordem"]
            );
        }
        
        // Cria o objeto informativo com suas imagens
        $informativo = array(
            "id" => $id,
            "titulo" => $titulo,
            "texto" => $texto,
            "data" => $data,
            "ativo" => $ativo,
            "created_at" => $created_at,
            "updated_at" => $updated_at,
            "imagens" => $imagens
        );
        
        $response["success"] = true;
        $response["message"] = "Informativo encontrado com sucesso.";
        $response["informativo"] = $informativo;
    } else {
        $response["message"] = "Informativo não encontrado ou inativo.";
    }
    
} catch (Exception $e) {
    $response["message"] = "Erro ao buscar informativo: " . $e->getMessage();
}

// Retorna a resposta em formato JSON
echo json_encode($response);
?> 