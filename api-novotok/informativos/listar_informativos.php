<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../database.php';
include_once '../cors_config.php';
include_once '../jwt_utils.php';

// Inicializa a resposta
$response = array(
    "success" => false,
    "message" => "",
    "informativos" => array()
);

try {
    $database = new Database();
    $db = $database->getConnection();

    // Verifica se há token de autenticação (para o dashboard)
    $headers = apache_request_headers();
    $jwt = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';
    $is_dashboard = JwtUtils::validateToken($jwt);

    // Consulta para obter os informativos
    // Se for o dashboard, mostra todos (ativos e inativos)
    // Se for o app, mostra apenas os ativos
    $query = "SELECT id, titulo, texto, data, ativo, created_at, updated_at 
              FROM informativos";
    
    if (!$is_dashboard) {
        $query .= " WHERE ativo = 1";
    }
    
    $query .= " ORDER BY data DESC";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $informativos = array();
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
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
            
            // Adiciona o informativo com suas imagens ao array
            $informativo_item = array(
                "id" => $id,
                "titulo" => $titulo,
                "texto" => $texto,
                "data" => $data,
                "ativo" => $ativo,
                "created_at" => $created_at,
                "updated_at" => $updated_at,
                "imagens" => $imagens
            );
            
            $informativos[] = $informativo_item;
        }
        
        $response["success"] = true;
        $response["message"] = "Informativos encontrados com sucesso.";
        $response["informativos"] = $informativos;
    } else {
        $response["message"] = "Nenhum informativo encontrado.";
    }
    
} catch (Exception $e) {
    $response["message"] = "Erro ao buscar informativos: " . $e->getMessage();
}

// Retorna a resposta em formato JSON
echo json_encode($response);
?> 