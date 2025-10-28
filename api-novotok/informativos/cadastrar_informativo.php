<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../database.php';
include_once '../cors_config.php';
include_once '../jwt_utils.php';

// Inicializa a resposta
$response = array(
    "success" => false,
    "message" => "",
    "informativo_id" => null
);

// Verifica o método da requisição
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
if (!isset($data->titulo) || empty($data->titulo) || !isset($data->texto) || empty($data->texto)) {
    $response["message"] = "Dados incompletos. Título e texto são obrigatórios.";
    echo json_encode($response);
    exit;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Inicia a transação
    $db->beginTransaction();
    
    // Prepara a query para inserir o informativo
    $query = "INSERT INTO informativos (titulo, texto, data, ativo) 
              VALUES (?, ?, NOW(), ?)";
    
    $stmt = $db->prepare($query);
    
    // Limpa e sanitiza os dados
    $titulo = htmlspecialchars(strip_tags($data->titulo));
    $texto = htmlspecialchars(strip_tags($data->texto));
    $ativo = isset($data->ativo) ? $data->ativo : 1;
    
    // Vincula os parâmetros
    $stmt->bindParam(1, $titulo);
    $stmt->bindParam(2, $texto);
    $stmt->bindParam(3, $ativo);
    
    // Executa a query
    if ($stmt->execute()) {
        $informativo_id = $db->lastInsertId();
        
        // Se houver imagens, insere-as
        if (isset($data->imagens) && is_array($data->imagens) && count($data->imagens) > 0) {
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
                
                $stmt_imagem->bindParam(1, $informativo_id);
                $stmt_imagem->bindParam(2, $imagemBinaria, PDO::PARAM_LOB);
                $stmt_imagem->bindParam(3, $tipoImagem);
                $stmt_imagem->bindParam(4, $descricao);
                $stmt_imagem->bindParam(5, $ordem);
                
                if (!$stmt_imagem->execute()) {
                    throw new Exception("Erro ao inserir imagem.");
                }
            }
        }
        
        // Commit da transação
        $db->commit();
        
        $response["success"] = true;
        $response["message"] = "Informativo cadastrado com sucesso.";
        $response["informativo_id"] = $informativo_id;
    } else {
        throw new Exception("Erro ao cadastrar informativo.");
    }
    
} catch (Exception $e) {
    // Rollback em caso de erro
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $response["message"] = "Erro ao cadastrar informativo: " . $e->getMessage();
}

// Retorna a resposta em formato JSON
echo json_encode($response);
?> 