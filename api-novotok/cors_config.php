<?php
// cors_config.php

// Domínios permitidos
$allowedDomains = [
    'https://novotokcosmeticos.com.br',
    'https://novotoksign.online',
    'http://localhost:3000',
    '*' // Permitir qualquer origem durante o desenvolvimento
];

// Verifica se o domínio da requisição está na lista de permitidos
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Configurações CORS para permitir acesso de diferentes origens
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Se for uma requisição OPTIONS (preflight), retornar 200 OK
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>