<?php
require_once 'cors_config.php';
// Inclui as classes Database e JwtUtils
require_once 'database.php';
require_once 'jwt_utils.php';


// Verifica se a requisição é do tipo GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    
    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Verifica se a conexão foi estabelecida com sucesso
    if (!$conn) {
        $errorInfo = $database->getConnectionError();
        echo json_encode(['success' => false, 'message' => 'Erro ao conectar ao banco de dados.', 'error' => $errorInfo]);
        exit;
    }

    // Consulta para listar todos os aparelhos
    $sql = "SELECT * FROM pccidade";
    $stmt = $conn->prepare($sql);

    // Verifica se a preparação da consulta foi bem-sucedida
    if (!$stmt) {
        $errorInfo = $conn->errorInfo();
        echo json_encode(['success' => false, 'message' => 'Erro ao preparar a consulta SQL.', 'error' => $errorInfo]);
        exit;
    }

    $stmt->execute();

    // Verifica se a execução da consulta foi bem-sucedida
    if ($stmt->errorCode() !== '00000') {
        $errorInfo = $stmt->errorInfo();
        echo json_encode(['success' => false, 'message' => 'Erro ao executar a consulta SQL.', 'error' => $errorInfo]);
        exit;
    }

    // Obtém os resultados da consulta
    $cidades = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Retorna os cidades como JSON
    echo json_encode(['success' => true, 'cidades' => $cidades]);
} else {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use GET.']);
}
?>