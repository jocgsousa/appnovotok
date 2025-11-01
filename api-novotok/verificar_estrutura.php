<?php
require_once 'config.php';
require_once 'database.php';

$db = new Database();
$conn = $db->getConnection();

echo "=== ESTRUTURA DA TABELA METAS_LOJAS ===\n";
$stmt = $conn->query('DESCRIBE metas_lojas');
$result = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach($result as $row) {
    echo $row['Field'] . ': ' . $row['Type'] . ' (Key: ' . $row['Key'] . ', Null: ' . $row['Null'] . ', Default: ' . $row['Default'] . ')' . PHP_EOL;
}

echo "\n=== CHARSET E COLLATION ===\n";
$stmt = $conn->query("SHOW TABLE STATUS LIKE 'metas_lojas'");
$status = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Charset: " . $status['Collation'] . PHP_EOL;
echo "Engine: " . $status['Engine'] . PHP_EOL;
?>