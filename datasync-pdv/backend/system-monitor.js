const fs = require('fs');
const path = require('path');
const os = require('os');

class SystemMonitor {
    constructor() {
        this.stateFilePath = path.join(__dirname, 'sync-state.json');
        this.monitorInterval = null;
    }
    
    // Iniciar monitoramento do sistema
    startMonitoring(intervalMs = 60000) { // Default: 1 minuto
        console.log('🔍 [MONITOR] Iniciando monitoramento do sistema...');
        
        this.monitorInterval = setInterval(() => {
            this.logSystemInfo();
        }, intervalMs);
        
        // Log inicial
        this.logSystemInfo();
    }
    
    // Parar monitoramento
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('🛑 [MONITOR] Monitoramento do sistema parado');
        }
    }
    
    // Registrar informações do sistema
    logSystemInfo() {
        try {
            const timestamp = new Date().toISOString();
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const uptime = process.uptime();
            
            // Verificar estado da sincronização
            let syncState = null;
            try {
                if (fs.existsSync(this.stateFilePath)) {
                    const stateData = fs.readFileSync(this.stateFilePath, 'utf8');
                    syncState = JSON.parse(stateData);
                }
            } catch (error) {
                syncState = { error: error.message };
            }
            
            const systemInfo = {
                timestamp,
                process: {
                    pid: process.pid,
                    uptime: uptime,
                    memoryUsage: {
                        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
                    },
                    cpuUsage
                },
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
                    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
                    loadAverage: os.loadavg(),
                    uptime: os.uptime()
                },
                syncState: syncState
            };
            
            // Log resumido no console
            console.log(`🔍 [MONITOR] PID: ${process.pid} | Uptime: ${Math.round(uptime)}s | Memory: ${systemInfo.process.memoryUsage.heapUsed} | Sync Active: ${syncState?.isActive || 'unknown'}`);
            
        } catch (error) {
            console.error('❌ [MONITOR] Erro ao registrar informações do sistema:', error);
        }
    }
    
    // Função removida - não há mais logs em arquivo para limpar
}

module.exports = SystemMonitor;