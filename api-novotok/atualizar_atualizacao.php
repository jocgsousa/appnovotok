<?php
require_once 'cors_config.php';
require_once 'database.php';
include_once 'jwt_utils.php';

// Estabelecer conexão com o banco de dados
try {
    $database = new Database();
    $conn = $database->getConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco de dados: ' . $e->getMessage()]);
    exit;
}

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
    
    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['id']) || !isset($data['versao']) || !isset($data['titulo']) || 
        !isset($data['descricao']) || !isset($data['link_download'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        exit;
    }
    
    // Validar os dados
    $id = (int) $data['id'];
    $versao = trim($data['versao']);
    $titulo = trim($data['titulo']);
    $descricao = trim($data['descricao']);
    $link_download = trim($data['link_download']);
    $obrigatoria = isset($data['obrigatoria']) ? (bool) $data['obrigatoria'] : false;
    $ativa = isset($data['ativa']) ? (bool) $data['ativa'] : true;
    
    // Validar formato da versão (x.y.z)
    if (!preg_match('/^\d+\.\d+\.\d+$/', $versao)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Formato de versão inválido. Use o formato x.y.z']);
        exit;
    }
    
    // Validar URL do link de download
    if (!filter_var($link_download, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Link de download inválido']);
        exit;
    }
    
    try {
        // Iniciar transação
        $conn->beginTransaction();
        
        // Verificar se a atualização existe
        $stmt = $conn->prepare("SELECT COUNT(*) FROM sistema_atualizacoes WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $atualizacaoExiste = $stmt->fetchColumn();
        
        if (!$atualizacaoExiste) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Atualização não encontrada']);
            exit;
        }
        
        // Verificar se já existe outra atualização com a mesma versão
        $stmt = $conn->prepare("SELECT COUNT(*) FROM sistema_atualizacoes WHERE versao = :versao AND id != :id");
        $stmt->execute(['versao' => $versao, 'id' => $id]);
        $versaoExiste = $stmt->fetchColumn();
        
        if ($versaoExiste) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Já existe outra atualização com esta versão']);
            exit;
        }
        
        // Atualizar os dados
        $stmt = $conn->prepare("
            UPDATE sistema_atualizacoes 
            SET versao = :versao, 
                titulo = :titulo, 
                descricao = :descricao, 
                link_download = :link_download, 
                obrigatoria = :obrigatoria, 
                ativa = :ativa 
            WHERE id = :id
        ");
        
        $stmt->execute([
            'id' => $id,
            'versao' => $versao,
            'titulo' => $titulo,
            'descricao' => $descricao,
            'link_download' => $link_download,
            'obrigatoria' => $obrigatoria ? 1 : 0,
            'ativa' => $ativa ? 1 : 0
        ]);
        
        // Confirmar transação
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Atualização modificada com sucesso'
        ]);
        
    } catch (PDOException $e) {
        // Reverter transação em caso de erro
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao atualizar dados: ' . $e->getMessage()
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?>