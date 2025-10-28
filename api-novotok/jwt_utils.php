<?php
require_once __DIR__ . '/vendor/autoload.php';

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

class JwtUtils {
    private static $secret_key = '99ee8b4be05b1ee4e6706bebb04624c5';
    private static $encryption_algorithm = 'HS256';

    public static function createToken($user_id) {
        $issuedAt = time();
        $expiration = $issuedAt + 604800; // Expira em 7 dias

        $payload = array(
            "iss" => "http://localhost",  // emissor
            "aud" => "http://localhost",  // audiência
            "iat" => $issuedAt,           // emitido em
            "exp" => $expiration,         // expira
            "data" => [
                "user_id" => $user_id
            ]
        );

        return JWT::encode($payload, self::$secret_key, self::$encryption_algorithm);
    }

    public static function validateToken($jwt) {
        try {
            $decoded = JWT::decode($jwt, new Key(self::$secret_key, self::$encryption_algorithm));
            return $decoded->data->user_id;
        } catch (Exception $e) {
            return null;
        }
    }
    
    // Adicionando método estático para decodificar JWT
    public static function decodeJWT($jwt) {
        try {
            $decoded = JWT::decode($jwt, new Key(self::$secret_key, self::$encryption_algorithm));
            return $decoded;
        } catch (Exception $e) {
            throw new Exception("Erro ao decodificar o token: " . $e->getMessage());
        }
    }
    
    // Método para extrair o ID do usuário mesmo de tokens expirados
    public static function extractUserIdFromToken($jwt) {
        try {
            // Dividir o token em suas partes (header, payload, signature)
            $parts = explode('.', $jwt);
            
            if (count($parts) != 3) {
                return null;
            }
            
            // Decodificar a parte do payload (segunda parte)
            $payload = base64_decode(str_replace(
                ['-', '_'], 
                ['+', '/'], 
                $parts[1]
            ));
            
            if ($payload === false) {
                return null;
            }
            
            // Converter o payload JSON para um objeto PHP
            $data = json_decode($payload);
            
            if ($data === null || !isset($data->data->user_id)) {
                return null;
            }
            
            return $data->data->user_id;
        } catch (Exception $e) {
            error_log("Erro ao extrair user_id do token: " . $e->getMessage());
            return null;
        }
    }
}

// Função para obter o token Bearer do cabeçalho Authorization
function get_bearer_token() {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
            return $matches[1];
        }
    }
    return null;
}

// Função para validar o token JWT
function is_jwt_valid($token) {
    return JwtUtils::validateToken($token) !== null;
}

// Função para decodificar o token JWT e retornar o payload
function decodeJWT($jwt) {
    return JwtUtils::decodeJWT($jwt);
}
