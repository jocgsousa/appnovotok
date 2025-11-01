<?php
require 'config.php';
require 'database.php';

try {
    echo "=== VERIFICAÇÃO DAS TABELAS DE GRUPOS DE METAS ===\n\n";
    
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar grupos_metas
    $stmt = $conn->prepare("SHOW TABLES LIKE 'grupos_metas'");
    $stmt->execute();
    $gruposMetas = $stmt->rowCount() > 0;
    echo "📋 grupos_metas: " . ($gruposMetas ? "✅ EXISTS" : "❌ NOT EXISTS") . "\n";
    
    // Verificar grupos_metas_produtos
    $stmt = $conn->prepare("SHOW TABLES LIKE 'grupos_metas_produtos'");
    $stmt->execute();
    $gruposMetasProdutos = $stmt->rowCount() > 0;
    echo "📋 grupos_metas_produtos: " . ($gruposMetasProdutos ? "✅ EXISTS" : "❌ NOT EXISTS") . "\n\n";
    
    // Se grupos_metas_produtos existe, mostrar sua estrutura
    if ($gruposMetasProdutos) {
        echo "📊 Estrutura da tabela grupos_metas_produtos:\n";
        $stmt = $conn->prepare('DESCRIBE grupos_metas_produtos');
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($columns as $column) {
            echo "   - {$column['Field']} ({$column['Type']})\n";
        }
        
        echo "\n📋 Dados na tabela grupos_metas_produtos:\n";
        $stmt = $conn->prepare('SELECT id, nome, descricao, ativo FROM grupos_metas_produtos LIMIT 5');
        $stmt->execute();
        $grupos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($grupos as $grupo) {
            echo "   - ID: {$grupo['id']}, Nome: {$grupo['nome']}, Ativo: " . ($grupo['ativo'] ? 'Sim' : 'Não') . "\n";
        }
    }
    
    // Se grupos_metas existe, mostrar sua estrutura
    if ($gruposMetas) {
        echo "\n📊 Estrutura da tabela grupos_metas:\n";
        $stmt = $conn->prepare('DESCRIBE grupos_metas');
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($columns as $column) {
            echo "   - {$column['Field']} ({$column['Type']})\n";
        }
        
        echo "\n📋 Dados na tabela grupos_metas:\n";
        $stmt = $conn->prepare('SELECT id, nome, descricao, ativo FROM grupos_metas LIMIT 5');
        $stmt->execute();
        $grupos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($grupos as $grupo) {
            echo "   - ID: {$grupo['id']}, Nome: {$grupo['nome']}, Ativo: " . ($grupo['ativo'] ? 'Sim' : 'Não') . "\n";
        }
    }
    
    echo "\n💡 Recomendação:\n";
    if ($gruposMetasProdutos && !$gruposMetas) {
        echo "   - Use 'grupos_metas_produtos' no JOIN do SQL\n";
    } elseif ($gruposMetas && !$gruposMetasProdutos) {
        echo "   - Use 'grupos_metas' no JOIN do SQL\n";
    } elseif ($gruposMetas && $gruposMetasProdutos) {
        echo "   - Ambas as tabelas existem. Verifique qual é a correta para usar\n";
    } else {
        echo "   - Nenhuma tabela de grupos de metas encontrada!\n";
    }
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>