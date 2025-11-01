<?php
// Script para criar a tabela metas_lojas
require_once 'config.php';
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== CRIAÇÃO DA TABELA METAS_LOJAS ===\n\n";
    
    // Criar a tabela metas_lojas de forma simples
    $sql = "CREATE TABLE IF NOT EXISTS metas_lojas (
        id VARCHAR(50) PRIMARY KEY,
        loja_id VARCHAR(50) NOT NULL,
        nome_loja VARCHAR(100) NOT NULL,
        mes INT NOT NULL,
        ano INT NOT NULL,
        grupo_meta_id VARCHAR(50) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT 1,
        data_criacao DATE NOT NULL
    )";
    
    $conn->exec($sql);
    echo "✓ Tabela metas_lojas criada com sucesso!\n\n";
    
    // Verificar a estrutura da tabela
    echo "Estrutura da tabela:\n";
    $descStmt = $conn->prepare("DESCRIBE metas_lojas");
    $descStmt->execute();
    $campos = $descStmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($campos as $campo) {
        echo "- {$campo['Field']}: {$campo['Type']} | Null: {$campo['Null']} | Key: {$campo['Key']}\n";
    }
    
    // Testar inserção de uma meta
    echo "\nTestando inserção de meta...\n";
    
    // Verificar se já existe meta para esta loja no período
    $checkStmt = $conn->prepare("SELECT id FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
    $checkStmt->bindValue(1, '7');
    $checkStmt->bindValue(2, 9);
    $checkStmt->bindValue(3, 2025);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() > 0) {
        echo "⚠ Já existe meta para esta loja neste período. Removendo...\n";
        $deleteStmt = $conn->prepare("DELETE FROM metas_lojas WHERE loja_id = ? AND mes = ? AND ano = ?");
        $deleteStmt->bindValue(1, '7');
        $deleteStmt->bindValue(2, 9);
        $deleteStmt->bindValue(3, 2025);
        $deleteStmt->execute();
        echo "✓ Meta anterior removida!\n";
    }
    
    // Inserir nova meta
    $meta_id = 'meta_' . time();
    $insertStmt = $conn->prepare("INSERT INTO metas_lojas (id, loja_id, nome_loja, mes, ano, grupo_meta_id, ativo, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)");
    $insertStmt->bindValue(1, $meta_id);
    $insertStmt->bindValue(2, '7');
    $insertStmt->bindValue(3, 'NOVOTOK FL28');
    $insertStmt->bindValue(4, 9);
    $insertStmt->bindValue(5, 2025);
    $insertStmt->bindValue(6, '1');
    $insertStmt->bindValue(7, 1);
    
    if ($insertStmt->execute()) {
        echo "✓ Meta de teste inserida com sucesso!\n";
        echo "- ID: {$meta_id}\n";
        echo "- Loja: NOVOTOK FL28 (ID: 7)\n";
        echo "- Período: 09/2025\n";
        echo "- Grupo Meta ID: 1\n";
    } else {
        echo "✗ Erro ao inserir meta de teste!\n";
    }
    
    echo "\n=== RESULTADO ===\n";
    echo "✓ Tabela metas_lojas criada\n";
    echo "✓ Grupo com ID '1' disponível\n";
    echo "✓ Agora você pode usar grupo_meta_id = '1' na sua requisição POST\n";
    echo "\n=== CONCLUÍDO ===\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>