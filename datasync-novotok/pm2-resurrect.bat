@echo off
:: Aguarda 10 segundos para garantir que o sistema inicializou
timeout /t 10 > nul
:: Restaura os processos salvos
pm2 resurrect
