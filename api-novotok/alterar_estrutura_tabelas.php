<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: POST");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

try {
    // Remover a restrição de chave única da tabela metas_vendas
    $conn->exec("ALTER TABLE metas_vendas DROP INDEX unique_meta_vendedor_periodo");
    
    // Remover a restrição de chave única da tabela metas_cadastro_clientes
    $conn->exec("ALTER TABLE metas_cadastro_clientes DROP INDEX unique_meta_cadastro_vendedor_periodo");
    
    echo json_encode([
        "status" => 1,
        "message" => "Restrições de chave única removidas com sucesso das tabelas de metas."
    ]);
} catch (PDOException $e) {
    echo json_encode([
        "status" => 0,
        "message" => "Erro ao alterar estrutura das tabelas: " . $e->getMessage()
    ]);
}
?> 