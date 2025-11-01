<?php
require 'config.php';
require 'database.php';

try {
    echo "=== VERIFICAÇÃO DA ESTRUTURA DA TABELA METAS_LOJAS ===\n\n";
    
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se a tabela existe
    $stmt = $conn->prepare("SHOW TABLES LIKE 'metas_lojas'");
    $stmt->execute();
    $tableExists = $stmt->rowCount() > 0;
    
    if (!$tableExists) {
        echo "❌ Tabela 'metas_lojas' não existe!\n";
        exit;
    }
    
    echo "✅ Tabela 'metas_lojas' existe\n\n";
    
    // Verificar estrutura da tabela
    $stmt = $conn->prepare('DESCRIBE metas_lojas');
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "📋 Estrutura da tabela metas_lojas:\n";
    echo "┌─────────────────────┬─────────────────────┬──────┬─────┬─────────┬───────┐\n";
    echo "│ Field               │ Type                │ Null │ Key │ Default │ Extra │\n";
    echo "├─────────────────────┼─────────────────────┼──────┼─────┼─────────┼───────┤\n";
    
    foreach ($columns as $column) {
        printf("│ %-19s │ %-19s │ %-4s │ %-3s │ %-7s │ %-5s │\n",
            $column['Field'],
            $column['Type'],
            $column['Null'],
            $column['Key'],
            $column['Default'] ?? 'NULL',
            $column['Extra']
        );
    }
    echo "└─────────────────────┴─────────────────────┴──────┴─────┴─────────┴───────┘\n\n";
    
    // Verificar quais colunas estão sendo usadas no SQL do listar_metas_lojas.php
    echo "🔍 Colunas que o arquivo listar_metas_lojas.php está tentando acessar:\n";
    $colunasUsadas = [
        'id', 'loja_id', 'nome_loja', 'mes', 'ano', 'grupo_meta_id', 
        'ativo', 'data_criacao', 'created_at', 'updated_at'
    ];
    
    $colunasExistentes = array_column($columns, 'Field');
    
    foreach ($colunasUsadas as $coluna) {
        $existe = in_array($coluna, $colunasExistentes);
        echo ($existe ? "✅" : "❌") . " {$coluna}\n";
    }
    
    echo "\n📊 Resumo:\n";
    echo "- Total de colunas na tabela: " . count($columns) . "\n";
    echo "- Colunas que existem: " . count(array_intersect($colunasUsadas, $colunasExistentes)) . "\n";
    echo "- Colunas que faltam: " . count(array_diff($colunasUsadas, $colunasExistentes)) . "\n";
    
    $colunasFaltando = array_diff($colunasUsadas, $colunasExistentes);
    if (!empty($colunasFaltando)) {
        echo "\n❌ Colunas que faltam:\n";
        foreach ($colunasFaltando as $coluna) {
            echo "   - {$coluna}\n";
        }
    }
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>