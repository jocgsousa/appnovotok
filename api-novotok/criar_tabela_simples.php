<?php
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "Criando tabela metas_lojas...\n";
    
    // Primeiro, vamos verificar se a tabela já existe
    $checkTable = $conn->prepare("SHOW TABLES LIKE 'metas_lojas'");
    $checkTable->execute();
    
    if ($checkTable->rowCount() > 0) {
        echo "Tabela já existe. Removendo...\n";
        $conn->exec("DROP TABLE metas_lojas");
        echo "Tabela removida.\n";
    }
    
    // Criar tabela simples
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
    echo "✓ Tabela criada com sucesso!\n";
    
    // Testar inserção
    $meta_id = 'meta_teste_' . time();
    $insertStmt = $conn->prepare("INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)");
    $insertStmt->execute([$meta_id, '7', 'NOVOTOK FL28', 9, 2025, '1', 1]);
    
    echo "✓ Meta de teste inserida: {$meta_id}\n";
    echo "✓ Pronto! Agora você pode usar grupo_meta_id = '1'\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>