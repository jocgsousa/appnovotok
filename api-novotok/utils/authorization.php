<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../jwt_utils.php';

class Authorization {
    /**
     * Verifica se o usuário está autorizado através do token JWT
     * 
     * @return mixed ID do usuário se autorizado, false caso contrário
     */
    public function authorize() {
        // Obter cabeçalhos da requisição
        $headers = getallheaders();
        
        // Verificar se o cabeçalho Authorization existe
        if (!isset($headers['Authorization'])) {
            return false;
        }
        
        try {
            // Extrair o token Bearer
            $jwt = str_replace('Bearer ', '', $headers['Authorization']);
            
            // Validar o token usando a classe JwtUtils existente
            $user_id = JwtUtils::validateToken($jwt);
            
            if (!$user_id) {
                return false;
            }
            
            // Retornar os dados do usuário (por enquanto apenas o ID)
            return [
                'user_id' => $user_id
            ];
            
        } catch (Exception $e) {
            error_log('Erro na autorização: ' . $e->getMessage());
            return false;
        }
    }
} 