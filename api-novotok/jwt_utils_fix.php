<?php
// Função para gerar um token JWT
function generateJWT($payload) {
    return JwtUtils::createToken($payload["id"]);
}
?>