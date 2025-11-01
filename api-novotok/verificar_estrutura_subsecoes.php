<?php
require_once 'database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "=== ESTRUTURA DAS TABELAS DE SUBSEÇÕES ===\n\n";
    
    $tabelas = [
        'meta_loja_operadoras_caixa',
        'meta_loja_vendedoras',
        'meta_loja_vendedoras_bijou',
        'meta_loja_gerente',
        'meta_loja_campanhas',
        'meta_loja_funcionarios',
        'meta_loja_produtos'
    ];
    
    foreach ($tabelas as $tabela) {
        echo "Tabela: $tabela\n";
        echo "----------------------------------------\n";
        
        try {
            $stmt = $conn->prepare("DESCRIBE $tabela");
            $stmt->execute();
            $campos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($campos as $campo) {
                echo "- {$campo['Field']}: {$campo['Type']} | Null: {$campo['Null']} | Key: {$campo['Key']}\n";
            }
        } catch (Exception $e) {
            echo "Erro ao descrever tabela: " . $e->getMessage() . "\n";
        }
        
        echo "\n";
    }
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
?>