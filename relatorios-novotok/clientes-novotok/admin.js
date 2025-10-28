// Admin Panel JavaScript
// API Configuration
function getApiBaseUrl() {
  return localStorage.getItem('apiBaseUrl') || 'http://192.168.10.200:3334/api';
}

const API_BASE_URL = getApiBaseUrl();

// State variables
let currentPage = 1;
let totalPages = 1;
let users = [];
let filters = {
    search: '',
    role: '',
    status: ''
};

// DOM Elements
const elements = {
    // Controls
    searchInput: document.getElementById('searchInput'),
    roleFilter: document.getElementById('roleFilter'),
    statusFilter: document.getElementById('statusFilter'),
    addUserBtn: document.getElementById('addUserBtn'),
    backBtn: document.getElementById('backBtn'),
    
    // Table and display
    usersTable: document.getElementById('usersTable'),
    usersTableBody: document.getElementById('usersTableBody'),
    usersTableContainer: document.getElementById('usersTableContainer'),
    noUsers: document.getElementById('noUsers'),
    usersCount: document.getElementById('usersCount'),
    pagination: document.getElementById('pagination'),
    
    // Messages and loading
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('errorMessage'),
    successMessage: document.getElementById('successMessage'),
    
    // Modal
    userModal: document.getElementById('userModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalClose: document.getElementById('modalClose'),
    modalErrorMessage: document.getElementById('modalErrorMessage'),
    modalSuccessMessage: document.getElementById('modalSuccessMessage'),
    userForm: document.getElementById('userForm'),
    saveUserBtn: document.getElementById('saveUserBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    
    // Form fields
    userId: document.getElementById('userId'),
    userName: document.getElementById('userName'),
    userNickname: document.getElementById('userNickname'),
    userEmail: document.getElementById('userEmail'),
    userPassword: document.getElementById('userPassword'),
    userRole: document.getElementById('userRole'),
    userStatus: document.getElementById('userStatus'),
    
    // Title bar controls
    minimizeBtn: document.getElementById('minimizeBtn'),
    maximizeBtn: document.getElementById('maximizeBtn'),
    closeBtn: document.getElementById('closeBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userInfoName: document.getElementById('userNameDisplay'),
    userInfoRole: document.getElementById('userRole')
};

// Initialize the admin panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
    loadUserInfo();
    loadUsers();
    setupEventListeners();
});

// Initialize admin panel
function initializeAdminPanel() {
    console.log('Initializing admin panel...');
    
    // Set initial filter values
    elements.searchInput.value = '';
    elements.roleFilter.value = '';
    elements.statusFilter.value = '';
    
    // Reset pagination
    currentPage = 1;
    
    hideMessages();
}

// Load current user info
function loadUserInfo() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (document.getElementById('userNameDisplay')) {
                document.getElementById('userNameDisplay').textContent = user.name;
            }
            if (document.getElementById('userRole')) {
                document.getElementById('userRole').textContent = 'Administrador';
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Title bar controls
    if (elements.minimizeBtn) {
        elements.minimizeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.windowMinimize();
            }
        });
    }
    
    if (elements.maximizeBtn) {
        elements.maximizeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.windowMaximize();
            }
        });
    }
    
    if (elements.closeBtn) {
        elements.closeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.windowClose();
            }
        });
    }
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente sair do sistema?')) {
                // Destroy session manager
                if (window.sessionManager) {
                    window.sessionManager.destroy();
                }
                
                localStorage.removeItem('user');
                localStorage.removeItem('isLoggedIn');
                window.location.replace('login.html');
            }
        });
    }
    
    // Navigation
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Search and filters
    if (elements.searchInput) {
        let searchTimeout;
        elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filters.search = e.target.value.trim();
                currentPage = 1;
                loadUsers();
            }, 500);
        });
    }
    
    if (elements.roleFilter) {
        elements.roleFilter.addEventListener('change', (e) => {
            filters.role = e.target.value;
            currentPage = 1;
            loadUsers();
        });
    }
    
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', (e) => {
            filters.status = e.target.value;
            currentPage = 1;
            loadUsers();
        });
    }
    
    // Add user button
    if (elements.addUserBtn) {
        elements.addUserBtn.addEventListener('click', () => {
            openUserModal('add');
        });
    }
    
    // Modal events
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeModal);
    }
    
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', closeModal);
    }
    
    if (elements.userModal) {
        elements.userModal.addEventListener('click', (e) => {
            if (e.target === elements.userModal) {
                closeModal();
            }
        });
    }
    
    // Form submit
    if (elements.userForm) {
        elements.userForm.addEventListener('submit', handleUserSubmit);
    }
    
    if (elements.saveUserBtn) {
        elements.saveUserBtn.addEventListener('click', handleUserSubmit);
    }
}

// Load users from API
async function loadUsers() {
    try {
        showLoading(true);
        hideMessages();
        
        const queryParams = new URLSearchParams({
            page: currentPage,
            limit: 10,
            search: filters.search,
            role: filters.role,
            status: filters.status
        });
        
        console.log('Loading users with params:', queryParams.toString());
        
        const response = await fetch(`${API_BASE_URL}/users?${queryParams}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            users = data.data.users;
            totalPages = data.data.pagination.totalPages;
            
            console.log('Users loaded:', users.length);
            displayUsers();
            updatePagination(data.data.pagination);
            updateUsersCount(data.data.pagination.totalItems);
        } else {
            throw new Error(data.message || 'Erro ao carregar usuários');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Erro ao carregar usuários: ' + error.message);
        displayNoUsers();
    } finally {
        showLoading(false);
    }
}

// Display users in table
function displayUsers() {
    if (!users || users.length === 0) {
        displayNoUsers();
        return;
    }
    
    elements.usersTableContainer.style.display = 'block';
    elements.noUsers.style.display = 'none';
    
    const tbody = elements.usersTableBody;
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
}

// Create a user table row
function createUserRow(user) {
    const row = document.createElement('tr');
    
    // Safely access user properties with defaults
    const userName = user.name || 'N/A';
    const userNickname = user.nickname || 'N/A';
    const userEmail = user.email || 'N/A';
    const userRole = user.role || 'user';
    const userStatus = user.status || 'active';
    const userId = user.id;
    
    // Format last login
    const lastLogin = user.lastLogin 
        ? new Date(user.lastLogin).toLocaleString('pt-BR')
        : 'Nunca';
    
    row.innerHTML = `
        <td>${escapeHtml(userName)}</td>
        <td>${escapeHtml(userNickname)}</td>
        <td>${escapeHtml(userEmail)}</td>
        <td><span class="role-badge role-${userRole}">${userRole === 'admin' ? 'Administrador' : 'Usuário'}</span></td>
        <td><span class="status-badge status-${userStatus}">${userStatus === 'active' ? 'Ativo' : 'Inativo'}</span></td>
        <td>${lastLogin}</td>
        <td>
            <div class="action-buttons">
                <button class="btn-action btn-edit" onclick="openUserModal('edit', ${userId})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action ${userStatus === 'active' ? 'btn-block' : 'btn-unblock'}" 
                        onclick="toggleUserStatus(${userId}, '${userStatus === 'active' ? 'inactive' : 'active'}')" 
                        title="${userStatus === 'active' ? 'Bloquear' : 'Desbloquear'}">
                    <i class="fas fa-${userStatus === 'active' ? 'ban' : 'check'}"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteUser(${userId})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Display no users message
function displayNoUsers() {
    elements.usersTableContainer.style.display = 'none';
    elements.noUsers.style.display = 'block';
    elements.pagination.innerHTML = '';
}

// Update pagination
function updatePagination(pagination) {
    const { currentPage: page, totalPages, totalItems } = pagination;
    
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button ${page <= 1 ? 'disabled' : ''} onclick="goToPage(${page - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="${i === page ? 'page-active' : ''}" onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button ${page >= totalPages ? 'disabled' : ''} onclick="goToPage(${page + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    elements.pagination.innerHTML = paginationHTML;
}

// Go to specific page
function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    loadUsers();
}

// Update users count
function updateUsersCount(count) {
    const text = count === 1 ? '1 usuário' : `${count} usuários`;
    elements.usersCount.innerHTML = `<span class="badge">${text}</span>`;
}

// Open user modal for add/edit
async function openUserModal(mode, userId = null) {
    const isEdit = mode === 'edit';
    
    // Update modal title
    elements.modalTitle.innerHTML = isEdit 
        ? '<i class="fas fa-user-edit"></i> Editar Usuário'
        : '<i class="fas fa-user-plus"></i> Adicionar Usuário';
    
    // Reset form
    elements.userForm.reset();
    hideModalMessages();
    
    if (isEdit && userId) {
        try {
            // Show loading in modal while fetching user data
            elements.saveUserBtn.disabled = true;
            elements.saveUserBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            
            // Fetch user data from API to ensure we have the latest data
            const response = await fetch(`${API_BASE_URL}/users/${userId}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                const user = data.data;
                
                // Populate form with user data
                elements.userId.value = user.id;
                elements.userName.value = user.name || '';
                elements.userNickname.value = user.nickname || '';
                elements.userEmail.value = user.email || '';
                elements.userRole.value = user.role || 'user';
                elements.userStatus.value = user.status || 'active';
                elements.userPassword.value = ''; // Always empty for edit
                elements.userPassword.placeholder = 'Deixe em branco para manter a senha atual';
                elements.userPassword.removeAttribute('required');
                
                console.log('User data loaded for editing:', {
                    id: user.id,
                    name: user.name,
                    nickname: user.nickname,
                    email: user.email,
                    role: user.role,
                    status: user.status
                });
            } else {
                throw new Error(data.message || 'Erro ao carregar dados do usuário');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            showModalError('Erro ao carregar dados do usuário: ' + error.message);
            // Still show the modal but with empty form
            elements.userId.value = userId;
            elements.userPassword.placeholder = 'Deixe em branco para manter a senha atual';
            elements.userPassword.removeAttribute('required');
        } finally {
            // Reset save button
            elements.saveUserBtn.disabled = false;
            elements.saveUserBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
    } else {
        // Clear form for adding
        elements.userId.value = '';
        elements.userPassword.placeholder = 'Digite a senha';
        elements.userPassword.setAttribute('required', 'required');
    }
    
    // Show modal
    elements.userModal.style.display = 'block';
    setTimeout(() => elements.userName.focus(), 100);
}

// Close modal
function closeModal() {
    elements.userModal.style.display = 'none';
    elements.userForm.reset();
    hideModalMessages();
}

// Handle user form submit
async function handleUserSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(elements.userForm);
    const userData = {
        name: formData.get('name').trim(),
        nickname: formData.get('nickname').trim(),
        email: formData.get('email').trim(),
        role: formData.get('role'),
        status: formData.get('status')
    };
    
    const password = formData.get('password').trim();
    if (password) {
        userData.password = password;
    }
    
    const userId = formData.get('userId');
    const isEdit = userId && userId !== '';
    
    console.log('Submitting user form:', {
        isEdit,
        userId,
        userData: { ...userData, password: password ? '[HIDDEN]' : 'empty' }
    });
    
    try {
        elements.saveUserBtn.disabled = true;
        elements.saveUserBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        hideModalMessages();
        
        const url = isEdit 
            ? `${API_BASE_URL}/users/${userId}`
            : `${API_BASE_URL}/users`;
        
        const method = isEdit ? 'PUT' : 'POST';
        
        console.log(`${method} ${url}`, userData);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showModalSuccess(data.message);
            setTimeout(() => {
                closeModal();
                loadUsers(); // Reload users list
            }, 1500);
        } else {
            // Handle validation errors specifically
            if (data.errors && Array.isArray(data.errors)) {
                const errorMessages = data.errors.map(err => {
                    return `${err.path || 'Campo'}: ${err.msg}`;
                }).join('\n');
                throw new Error(`${data.message}\n\nDetalhes:\n${errorMessages}`);
            } else {
                throw new Error(data.message || 'Erro ao salvar usuário');
            }
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showModalError('Erro ao salvar usuário: ' + error.message);
    } finally {
        elements.saveUserBtn.disabled = false;
        elements.saveUserBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
    }
}

// Toggle user status (block/unblock)
async function toggleUserStatus(userId, newStatus) {
    // Find user data from current users list or fetch from API if not found
    let user = users.find(u => u.id === userId);
    
    if (!user) {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`);
            const data = await response.json();
            if (response.ok && data.success) {
                user = data.data;
            } else {
                throw new Error('Usuário não encontrado');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            showError('Erro ao carregar dados do usuário: ' + error.message);
            return;
        }
    }
    
    const action = newStatus === 'active' ? 'desbloquear' : 'bloquear';
    
    if (!confirm(`Deseja realmente ${action} o usuário "${user.name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess(`Usuário ${action === 'desbloquear' ? 'desbloqueado' : 'bloqueado'} com sucesso!`);
            loadUsers(); // Reload users list
        } else {
            throw new Error(data.message || `Erro ao ${action} usuário`);
        }
    } catch (error) {
        console.error(`Error ${action} user:`, error);
        showError(`Erro ao ${action} usuário: ` + error.message);
    }
}

// Delete user
async function deleteUser(userId) {
    // Find user data from current users list or fetch from API if not found
    let user = users.find(u => u.id === userId);
    
    if (!user) {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`);
            const data = await response.json();
            if (response.ok && data.success) {
                user = data.data;
            } else {
                throw new Error('Usuário não encontrado');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            showError('Erro ao carregar dados do usuário: ' + error.message);
            return;
        }
    }
    
    if (!confirm(`Deseja realmente excluir o usuário "${user.name}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Usuário excluído com sucesso!');
            loadUsers(); // Reload users list
        } else {
            throw new Error(data.message || 'Erro ao excluir usuário');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('Erro ao excluir usuário: ' + error.message);
    }
}

// Utility functions
function showLoading(show) {
    if (elements.loading) {
        elements.loading.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.style.display = 'block';
        elements.successMessage.style.display = 'none';
    }
}

function showSuccess(message) {
    if (elements.successMessage) {
        elements.successMessage.textContent = message;
        elements.successMessage.style.display = 'block';
        elements.errorMessage.style.display = 'none';
    }
    
    // Auto-hide success message after 3 seconds
    setTimeout(() => {
        if (elements.successMessage) {
            elements.successMessage.style.display = 'none';
        }
    }, 3000);
}

function hideMessages() {
    if (elements.errorMessage) elements.errorMessage.style.display = 'none';
    if (elements.successMessage) elements.successMessage.style.display = 'none';
}

function showModalError(message) {
    if (elements.modalErrorMessage) {
        // Replace newlines with HTML breaks for better display
        const formattedMessage = message.replace(/\n/g, '<br>');
        elements.modalErrorMessage.innerHTML = formattedMessage;
        elements.modalErrorMessage.style.display = 'block';
        elements.modalSuccessMessage.style.display = 'none';
    }
}

function showModalSuccess(message) {
    if (elements.modalSuccessMessage) {
        elements.modalSuccessMessage.textContent = message;
        elements.modalSuccessMessage.style.display = 'block';
        elements.modalErrorMessage.style.display = 'none';
    }
}

function hideModalMessages() {
    if (elements.modalErrorMessage) elements.modalErrorMessage.style.display = 'none';
    if (elements.modalSuccessMessage) elements.modalSuccessMessage.style.display = 'none';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}