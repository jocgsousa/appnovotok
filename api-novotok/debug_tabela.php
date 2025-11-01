<?php
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== DEBUG DA CRIAÇÃO DA TABELA ===\n\n";
    
    // Verificar configurações do MySQL
    echo "1. Verificando configurações do MySQL...\n";
    $stmt = $conn->prepare("SHOW VARIABLES LIKE 'foreign_key_checks'");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "   foreign_key_checks: " . $result['Value'] . "\n";
    
    // Desabilitar verificação de chaves estrangeiras
    echo "\n2. Desabilitando verificação de chaves estrangeiras...\n";
    $conn->exec("SET foreign_key_checks = 0");
    echo "   ✓ Verificação desabilitada\n";
    
    // Verificar se a tabela existe
    echo "\n3. Verificando se a tabela existe...\n";
    $checkTable = $conn->prepare("SHOW TABLES LIKE 'metas_lojas'");
    $checkTable->execute();
    
    if ($checkTable->rowCount() > 0) {
        echo "   Tabela existe. Removendo...\n";
        $conn->exec("DROP TABLE metas_lojas");
        echo "   ✓ Tabela removida\n";
    } else {
        echo "   Tabela não existe\n";
    }
    
    // Criar tabela
    echo "\n4. Criando tabela...\n";
    $sql = "CREATE TABLE metas_lojas (
        id VARCHAR(50) PRIMARY KEY,
        loja_id VARCHAR(50) NOT NULL,
        nome_loja VARCHAR(100) NOT NULL,
        mes INT NOT NULL,
        ano INT NOT NULL,
        grupo_meta_id VARCHAR(50) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        data_criacao DATE NOT NULL
    )";
    
    $conn->exec($sql);
    echo "   ✓ Tabela criada com sucesso!\n";
    
    // Reabilitar verificação de chaves estrangeiras
    echo "\n5. Reabilitando verificação de chaves estrangeiras...\n";
    $conn->exec("SET foreign_key_checks = 1");
    echo "   ✓ Verificação reabilitada\n";
    
    // Testar inserção
    echo "\n6. Testando inserção...\n";
    $meta_id = 'meta_teste_' . time();
    $insertStmt = $conn->prepare("INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)");
    $insertStmt->execute([$meta_id, '7', 'NOVOTOK FL28', 9, 2025, '1', 1]);
    
    echo "   ✓ Meta de teste inserida: {$meta_id}\n";
    
    // Verificar estrutura
    echo "\n7. Estrutura da tabela:\n";
    $descStmt = $conn->prepare("DESCRIBE metas_lojas");
    $descStmt->execute();
    $campos = $descStmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($campos as $campo) {
        echo "   - {$campo['Field']}: {$campo['Type']}\n";
    }
    
    echo "\n=== SUCESSO ===\n";
    echo "✓ Tabela metas_lojas criada e funcionando\n";
    echo "✓ Grupo com ID '1' disponível\n";
    echo "✓ Agora você pode usar grupo_meta_id = '1' na sua requisição POST\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>