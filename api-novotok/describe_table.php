<?php
require_once 'database.php';

// Instanciar a conexão com o banco de dados
$db = new Database();
$conn = $db->getConnection();

// Consultar a estrutura da tabela aparelhos
$stmt = $conn->query('DESCRIBE aparelhos');
$result = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Exibir a estrutura
echo "Estrutura da tabela aparelhos:\n";
print_r($result);

// Consultar alguns registros da tabela
$stmt = $conn->query('SELECT * FROM aparelhos LIMIT 5');
$aparelhos = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Exibir os registros
echo "\n\nRegistros da tabela aparelhos:\n";
print_r($aparelhos);

// Verificar especificamente o aparelho mencionado
$stmt = $conn->prepare('SELECT * FROM aparelhos WHERE codaparelho = :codaparelho');
$codaparelho = 'ad7af09b55235f4a';
$stmt->bindParam(':codaparelho', $codaparelho);
$stmt->execute();
$aparelho = $stmt->fetch(PDO::FETCH_ASSOC);

echo "\n\nAparelho específico (ad7af09b55235f4a):\n";
print_r($aparelho);
?> 