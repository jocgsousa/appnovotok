@echo off
echo Copiando sqlnet.ora para o diretorio Oracle Instant Client...
copy sqlnet.ora instantclient_19_25\sqlnet.ora
echo.
echo Arquivo sqlnet.ora copiado com sucesso!
echo.
echo Para testar a conexao Oracle, execute:
echo node test-oracle-connection.js
pause