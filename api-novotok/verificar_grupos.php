<?php
require_once 'database.php';

echo "=== VERIFICANDO GRUPOS DE METAS ===\n\n";

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar grupos existentes
    $stmt = $conn->prepare("SELECT * FROM grupos_metas ORDER BY id");
    $stmt->execute();
    $grupos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Total de grupos encontrados: " . count($grupos) . "\n\n";
    
    if (count($grupos) > 0) {
        echo "Grupos existentes:\n";
        foreach ($grupos as $grupo) {
            echo "  - ID: " . $grupo['id'] . "\n";
            echo "    Nome: " . $grupo['nome'] . "\n";
            echo "    Descrição: " . ($grupo['descricao'] ?? 'N/A') . "\n";
            echo "    Ativo: " . ($grupo['ativo'] ? 'Sim' : 'Não') . "\n";
            echo "    Criado em: " . $grupo['created_at'] . "\n\n";
        }
    } else {
        echo "❌ Nenhum grupo de metas encontrado!\n";
        echo "Criando grupo padrão...\n";
        
        $stmt = $conn->prepare("INSERT INTO grupos_metas (nome, descricao, ativo) VALUES (?, ?, ?)");
        $stmt->bindValue(1, 'Grupo Padrão');
        $stmt->bindValue(2, 'Grupo de metas padrão para lojas');
        $stmt->bindValue(3, 1);
        $stmt->execute();
        
        $grupo_id = $conn->lastInsertId();
        echo "✓ Grupo criado com ID: " . $grupo_id . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Erro: " . $e->getMessage() . "\n";
}
?>