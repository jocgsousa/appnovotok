<?php
require_once 'cors_config.php';
require_once 'database.php';

// Retorna informações sobre atualizações disponíveis para o aplicativo
// Parâmetro opcional: versao_atual - a versão atual do aplicativo do cliente

// Resposta em formato JSON
header('Content-Type: application/json');

// Inicializar a conexão com o banco de dados
$database = new Database();
$conn = $database->getConnection();

// Obter a versão atual do cliente (se fornecida)
$versao_atual = isset($_GET['versao_atual']) ? $_GET['versao_atual'] : '0.0.0';

try {
    // Consultar atualizações ativas no banco de dados
    $stmt = $conn->prepare("
        SELECT id, versao, titulo, descricao, link_download, obrigatoria 
        FROM sistema_atualizacoes 
        WHERE ativa = 1 
        ORDER BY data_lancamento DESC 
        LIMIT 1
    ");
    $stmt->execute();
    $atualizacao = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($atualizacao) {
        // Verificar se a versão do cliente é menor que a versão disponível
        $versao_disponivel = $atualizacao['versao'];
        $tem_atualizacao = version_compare($versao_atual, $versao_disponivel, '<');
        
        echo json_encode([
            'success' => true,
            'tem_atualizacao' => $tem_atualizacao,
            'versao_disponivel' => $versao_disponivel,
            'titulo' => $atualizacao['titulo'],
            'descricao' => $atualizacao['descricao'],
            'link_download' => $atualizacao['link_download'],
            'obrigatoria' => (bool)$atualizacao['obrigatoria']
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'tem_atualizacao' => false,
            'mensagem' => 'Nenhuma atualização disponível'
        ]);
    }
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'tem_atualizacao' => false,
        'mensagem' => 'Erro ao verificar atualizações: ' . $e->getMessage()
    ]);
}
?> 