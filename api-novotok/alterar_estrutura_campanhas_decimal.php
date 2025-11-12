<?php
// Script para alterar a coluna quantidade_vendida para DECIMAL(15,2)
require_once 'config.php';

try {
    // Obter configuração do banco de dados
    $config = Config::get();
    $dbConfig = $config['database'];

    // Conectar ao banco de dados
    $conn = new PDO(
        "mysql:host={$dbConfig['host']};dbname={$dbConfig['name']};charset={$dbConfig['charset']}", 
        $dbConfig['username'], 
        $dbConfig['password']
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Conectado ao banco de dados com sucesso!\n";

    // Alterar tipo da coluna
    $sql = "ALTER TABLE meta_loja_campanhas MODIFY quantidade_vendida DECIMAL(15,2) NOT NULL DEFAULT 0";
    $conn->exec($sql);
    echo "✓ Coluna quantidade_vendida alterada para DECIMAL(15,2) com sucesso!\n";

} catch (Exception $e) {
    http_response_code(500);
    echo "Erro ao alterar estrutura: " . $e->getMessage() . "\n";
}

?>