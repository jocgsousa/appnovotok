<?php
try {
    $conn = new PDO('mysql:host=localhost;dbname=novotok', 'root', '@Ntkti1793');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Primeiro, verificar quais tabelas existem
    echo "=== VERIFICANDO TABELAS EXISTENTES ===\n";
    $result = $conn->query("SHOW TABLES LIKE 'meta_loja_%'");
    $existingTables = [];
    while($row = $result->fetch(PDO::FETCH_NUM)) {
        $existingTables[] = $row[0];
        echo "✓ " . $row[0] . "\n";
    }
    
    if (empty($existingTables)) {
        echo "❌ Nenhuma tabela de subseções encontrada!\n";
        echo "Verificando se a tabela principal existe...\n";
        $result = $conn->query("SHOW TABLES LIKE 'metas_lojas'");
        if ($result->fetch()) {
            echo "✓ Tabela metas_lojas existe\n";
        } else {
            echo "❌ Tabela metas_lojas não existe\n";
        }
        exit;
    }
    
    // Verificar estrutura das tabelas existentes
    foreach($existingTables as $table) {
        echo "\n=== Estrutura da tabela $table ===\n";
        try {
            $result = $conn->query("DESCRIBE $table");
            while($row = $result->fetch(PDO::FETCH_ASSOC)) {
                echo $row['Field'] . ' - ' . $row['Type'] . "\n";
            }
        } catch(PDOException $e) {
            echo "Erro ao descrever tabela $table: " . $e->getMessage() . "\n";
        }
    }
    
} catch(PDOException $e) {
    echo "Erro de conexão: " . $e->getMessage() . "\n";
}
?>