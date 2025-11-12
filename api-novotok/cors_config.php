<?php
// cors_config.php

// Domínios permitidos
$allowedDomains = [
    'https://novotokcosmeticos.com.br',
    'https://novotoksign.online',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    '*' // Permitir qualquer origem durante o desenvolvimento
];

// Origem da requisição
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Se houver origem definida e ela for permitida, refletir a origem; caso contrário, usar '*'
if (!empty($origin) && (in_array($origin, $allowedDomains) || in_array('*', $allowedDomains))) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
    // Não é válido usar credenciais com origem '*'
    header("Access-Control-Allow-Credentials: false");
}

// Métodos e cabeçalhos permitidos (inclui PATCH)
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

// Se for uma requisição OPTIONS (preflight), retornar 200 OK
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>