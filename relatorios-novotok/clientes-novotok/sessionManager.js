// Session Management System
class SessionManager {
    constructor() {
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
        this.WARNING_TIME = 5 * 60 * 1000; // 5 minutes warning before logout
        this.CHECK_INTERVAL = 1000; // Check every second
        
        this.sessionTimer = null;
        this.warningTimer = null;
        this.countdownInterval = null;
        this.lastActivity = Date.now();
        
        this.warningModal = null;
        this.countdownElement = null;
        
        this.init();
    }
    
    init() {
        // Only initialize if user is logged in
        if (this.isLoggedIn()) {
            this.createWarningModal();
            this.startSession();
            this.bindActivityEvents();
            console.log('Session manager initialized - 30 minute timeout active');
        }
    }
    
    isLoggedIn() {
        return localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('user');
    }
    
    saveLastNickname(nickname) {
        if (nickname && nickname.trim()) {
            localStorage.setItem('lastNickname', nickname.trim());
        }
    }
    
    getLastNickname() {
        return localStorage.getItem('lastNickname') || '';
    }
    
    // Legacy email methods for backward compatibility
    saveLastEmail(email) {
        if (email && email.trim()) {
            localStorage.setItem('lastEmail', email.trim());
        }
    }
    
    getLastEmail() {
        return localStorage.getItem('lastEmail') || '';
    }
    
    startSession() {
        this.lastActivity = Date.now();
        this.resetTimers();
        
        // Main session timer
        this.sessionTimer = setTimeout(() => {
            this.logout('Sessão expirada por inatividade');
        }, this.SESSION_TIMEOUT);
        
        // Warning timer (5 minutes before logout)
        this.warningTimer = setTimeout(() => {
            this.showWarning();
        }, this.SESSION_TIMEOUT - this.WARNING_TIME);
        
        console.log('Session started - auto logout in 30 minutes');
    }
    
    resetSession() {
        this.lastActivity = Date.now();
        this.hideWarning();
        this.resetTimers();
        this.startSession();
    }
    
    resetTimers() {
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
    }
    
    bindActivityEvents() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                const now = Date.now();
                // Only reset if there was significant activity (prevent too frequent resets)
                if (now - this.lastActivity > 30000) { // 30 seconds threshold
                    this.resetSession();
                }
            }, true);
        });
    }
    
    createWarningModal() {
        const modalHTML = `
            <div id="sessionWarningModal" class="session-modal" style="display: none;">
                <div class="session-modal-content">
                    <div class="session-modal-header">
                        <h3>
                            <i class="fas fa-clock"></i>
                            Sessão Expirando
                        </h3>
                    </div>
                    <div class="session-modal-body">
                        <p>Sua sessão expirará em <strong id="sessionCountdown">5:00</strong> por inatividade.</p>
                        <p>Clique em "Continuar" para manter-se conectado.</p>
                    </div>
                    <div class="session-modal-footer">
                        <button class="btn btn-secondary" id="sessionLogoutBtn">
                            <i class="fas fa-sign-out-alt"></i> Sair Agora
                        </button>
                        <button class="btn btn-primary" id="sessionContinueBtn">
                            <i class="fas fa-clock"></i> Continuar Sessão
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal styles
        const modalStyles = `
            <style id="sessionModalStyles">
                .session-modal {
                    position: fixed;
                    z-index: 10000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .session-modal-content {
                    background: white;
                    border-radius: 15px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                    animation: sessionModalSlideIn 0.3s ease-out;
                }
                
                @keyframes sessionModalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                .session-modal-header {
                    padding: 20px 25px;
                    border-bottom: 1px solid #e1e8ed;
                    text-align: center;
                }
                
                .session-modal-header h3 {
                    margin: 0;
                    color: #e74c3c;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    font-size: 1.2rem;
                }
                
                .session-modal-body {
                    padding: 25px;
                    text-align: center;
                    line-height: 1.6;
                }
                
                .session-modal-body p {
                    margin: 0 0 15px 0;
                    color: #2c3e50;
                }
                
                .session-modal-footer {
                    padding: 15px 25px;
                    border-top: 1px solid #e1e8ed;
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                }
                
                #sessionCountdown {
                    color: #e74c3c;
                    font-size: 1.2em;
                    font-weight: bold;
                }
            </style>
        `;
        
        // Add styles to head
        document.head.insertAdjacentHTML('beforeend', modalStyles);
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        this.warningModal = document.getElementById('sessionWarningModal');
        this.countdownElement = document.getElementById('sessionCountdown');
        
        // Bind modal events
        document.getElementById('sessionContinueBtn').addEventListener('click', () => {
            this.resetSession();
        });
        
        document.getElementById('sessionLogoutBtn').addEventListener('click', () => {
            this.logout('Logout manual durante aviso de sessão');
        });
    }
    
    showWarning() {
        if (!this.warningModal) return;
        
        this.warningModal.style.display = 'flex';
        this.startCountdown();
        
        console.log('Session warning displayed - 5 minutes remaining');
    }
    
    hideWarning() {
        if (this.warningModal) {
            this.warningModal.style.display = 'none';
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }
    
    startCountdown() {
        let remainingTime = this.WARNING_TIME; // 5 minutes
        
        this.countdownInterval = setInterval(() => {
            remainingTime -= 1000;
            
            if (remainingTime <= 0) {
                clearInterval(this.countdownInterval);
                this.logout('Sessão expirada - tempo esgotado');
                return;
            }
            
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            
            if (this.countdownElement) {
                this.countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    logout(reason = 'Logout') {
        console.log('Session logout:', reason);
        
        this.resetTimers();
        this.hideWarning();
        
        // Clear session data
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        
        // Show logout message briefly
        if (reason.includes('expirada') || reason.includes('inatividade')) {
            alert('Sua sessão expirou por inatividade. Você será redirecionado para a tela de login.');
        }
        
        // Redirect to login
        window.location.replace('login.html');
    }
    
    extendSession() {
        this.resetSession();
        console.log('Session extended by user activity');
    }
    
    getTimeRemaining() {
        const elapsed = Date.now() - this.lastActivity;
        const remaining = this.SESSION_TIMEOUT - elapsed;
        return Math.max(0, remaining);
    }
    
    getTimeRemainingFormatted() {
        const remaining = this.getTimeRemaining();
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    destroy() {
        this.resetTimers();
        this.hideWarning();
        
        // Remove modal and styles
        const modal = document.getElementById('sessionWarningModal');
        const styles = document.getElementById('sessionModalStyles');
        
        if (modal) modal.remove();
        if (styles) styles.remove();
        
        console.log('Session manager destroyed');
    }
}

// Create global session manager instance
window.sessionManager = new SessionManager();