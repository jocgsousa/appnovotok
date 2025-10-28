<?php
header("Content-Type: application/json; charset=UTF-8");
require_once "jwt_utils.php";

// Parâmetros
$vendedor_id = isset($_GET["vendedor_id"]) ? intval($_GET["vendedor_id"]) : 0;
$nome = isset($_GET["nome"]) ? $_GET["nome"] : "Vendedor";
$rca = isset($_GET["rca"]) ? $_GET["rca"] : "12345";

if ($vendedor_id <= 0) {
    echo json_encode([
        "status" => 0,
        "message" => "ID do vendedor inválido ou não fornecido"
    ]);
    exit;
}

// Criar um token para o vendedor
$token = JwtUtils::createToken($vendedor_id);

// Retornar o token
echo json_encode([
    "status" => 1,
    "message" => "Token gerado com sucesso",
    "token" => $token,
    "vendedor" => [
        "id" => $vendedor_id,
        "nome" => $nome,
        "rca" => $rca
    ]
]);
?>