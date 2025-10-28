// Global variables
let currentData = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

// Initialize API Service on page load
function initializeApiService() {
    // Ensure API service is initialized
    if (!window.apiService) {
        console.warn('API Service not loaded, creating new instance');
        window.apiService = new ApiService();
    }
}

// DOM elements
const filterForm = document.getElementById('filterForm');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const selectAllColumnsBtn = document.getElementById('selectAllColumns');
const deselectAllColumnsBtn = document.getElementById('deselectAllColumns');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');
const resultsSection = document.getElementById('resultsSection');
const resultsTableBody = document.getElementById('resultsTableBody');
const recordCount = document.getElementById('recordCount');
const loading = document.getElementById('loading');
const statusMessage = document.getElementById('statusMessage');

// Server status elements
const serverStatus = document.getElementById('serverStatus');
const statusText = document.getElementById('statusText');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const apiUrlInput = document.getElementById('apiUrlInput');
const settingsConnectionStatus = document.getElementById('settingsConnectionStatus');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');
const settingsSaveBtn = document.getElementById('settingsSaveBtn');

// Lookup elements
const lookupModal = document.getElementById('lookupModal');
const modalContent = lookupModal.querySelector('.modal-content');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const searchContainer = document.getElementById('searchContainer');
const modalSearchInput = document.getElementById('modalSearchInput');
const lookupLoading = document.getElementById('lookupLoading');
const lookupList = document.getElementById('lookupList');
const productLookupBtn = document.getElementById('productLookupBtn');
const departmentLookupBtn = document.getElementById('departmentLookupBtn');
const activityLookupBtn = document.getElementById('activityLookupBtn');
const branchLookupBtn = document.getElementById('branchLookupBtn');
const brandLookupBtn = document.getElementById('brandLookupBtn');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApiService();
    initializeApp();
    setupServerStatus();
});

function initializeApp() {
    // Set default dates
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = formatDateForInput(firstDayOfMonth);
    document.getElementById('endDate').value = formatDateForInput(today);

    // Add event listeners
    filterForm.addEventListener('submit', handleSearch);
    clearBtn.addEventListener('click', clearForm);
    exportBtn.addEventListener('click', handleExport);
    testConnectionBtn.addEventListener('click', handleTestConnection);
    selectAllColumnsBtn.addEventListener('click', selectAllColumns);
    deselectAllColumnsBtn.addEventListener('click', deselectAllColumns);
    
    // Title bar controls
    if (window.electronAPI) {
        minimizeBtn.addEventListener('click', () => window.electronAPI.windowMinimize());
        maximizeBtn.addEventListener('click', () => window.electronAPI.windowMaximize());
        closeBtn.addEventListener('click', () => window.electronAPI.windowClose());
    }
    
    // Lookup buttons
    productLookupBtn.addEventListener('click', () => openProductLookup());
    departmentLookupBtn.addEventListener('click', () => openDepartmentLookup());
    activityLookupBtn.addEventListener('click', () => openActivityLookup());
    branchLookupBtn.addEventListener('click', () => openBranchLookup());
    brandLookupBtn.addEventListener('click', () => openBrandLookup());
    
    // Add validation on blur and input with debouncing for manual input fields
    document.getElementById('department').addEventListener('blur', () => validateDepartment());
    document.getElementById('activity').addEventListener('blur', () => validateActivity());
    document.getElementById('brand').addEventListener('blur', () => validateBrand());
    document.getElementById('branch').addEventListener('blur', () => validateBranch());
    document.getElementById('productCode').addEventListener('blur', () => validateProduct());
    
    // Add debounced validation on input for better UX
    document.getElementById('department').addEventListener('input', debounce(() => validateDepartment(), 1000));
    document.getElementById('activity').addEventListener('input', debounce(() => validateActivity(), 1000));
    document.getElementById('brand').addEventListener('input', debounce(() => validateBrand(), 1000));
    document.getElementById('branch').addEventListener('input', debounce(() => validateBranch(), 1000));
    document.getElementById('productCode').addEventListener('input', debounce(() => validateProduct(), 1000));
    
    // Modal events
    modalClose.addEventListener('click', () => cancelLookupModal());
    modalCancel.addEventListener('click', () => cancelLookupModal());
    modalConfirm.addEventListener('click', closeLookupModal);
    
    // Prevent modal content clicks from bubbling to background
    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    lookupModal.addEventListener('click', (e) => {
        if (e.target === lookupModal) {
            // Only close when clicking the dark overlay, not the modal content
            cancelLookupModal();
        }
    });
}

// Setup server status functionality
function setupServerStatus() {
    // Check server status on load
    checkServerStatus();
    
    // Check server status every 30 seconds
    setInterval(checkServerStatus, 30000);

    // Settings modal event listeners
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }

    if (settingsModalClose) {
        settingsModalClose.addEventListener('click', closeSettingsModal);
    }

    if (settingsCancelBtn) {
        settingsCancelBtn.addEventListener('click', closeSettingsModal);
    }

    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener('click', saveApiSettings);
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    if (apiUrlInput) {
        apiUrlInput.addEventListener('input', testApiConnection);
    }
}

// Server status functions
async function checkServerStatus() {
    try {
        const response = await fetch(`${window.apiService.getApiBaseUrl()}/health`);
        if (response.ok) {
            serverStatus.className = 'server-status server-online';
            statusText.textContent = '🟢 Servidor Online';
        } else {
            throw new Error('Server not responding');
        }
    } catch (error) {
        serverStatus.className = 'server-status server-offline';
        statusText.textContent = '🔴 Servidor Offline';
    }
}

function openSettingsModal() {
    apiUrlInput.value = window.apiService.getApiBaseUrl();
    settingsModal.style.display = 'block';
    testApiConnection();
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

async function testApiConnection() {
    const testUrl = apiUrlInput.value.trim();
    if (!testUrl) {
        settingsConnectionStatus.innerHTML = '<span style="color: #dc3545;">URL inválida</span>';
        settingsConnectionStatus.style.backgroundColor = '#f8d7da';
        return;
    }

    settingsConnectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
    settingsConnectionStatus.style.backgroundColor = '#e2e3e5';

    try {
        const response = await fetch(`${testUrl}/health`);
        if (response.ok) {
            settingsConnectionStatus.innerHTML = '🟢 Conexão bem-sucedida';
            settingsConnectionStatus.style.backgroundColor = '#d4edda';
            settingsConnectionStatus.style.color = '#155724';
        } else {
            throw new Error('Server not responding');
        }
    } catch (error) {
        settingsConnectionStatus.innerHTML = '🔴 Falha na conexão';
        settingsConnectionStatus.style.backgroundColor = '#f8d7da';
        settingsConnectionStatus.style.color = '#721c24';
    }
}

function saveApiSettings() {
    const newUrl = apiUrlInput.value.trim();
    if (!newUrl) {
        alert('Por favor, insira uma URL válida.');
        return;
    }

    localStorage.setItem('apiBaseUrl', newUrl);
    window.apiService = new ApiService(); // Reinitialize with new URL
    closeSettingsModal();
    
    checkServerStatus();
    showStatus('Configurações salvas com sucesso!', 'success');
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function selectAllColumns() {
    const checkboxes = document.querySelectorAll('th input[type="checkbox"][data-column]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateColumnVisibility();
}

function deselectAllColumns() {
    const checkboxes = document.querySelectorAll('th input[type="checkbox"][data-column]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateColumnVisibility();
}

function setDefaultColumns() {
    // Define default columns to be checked
    const defaultColumns = ['CODCLI', 'CLIENTE', 'CODUSUR1', 'TELCELENT'];
    
    // First, uncheck all columns
    const allCheckboxes = document.querySelectorAll('th input[type="checkbox"][data-column]');
    allCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Then check only the default columns
    defaultColumns.forEach(columnName => {
        const checkbox = document.querySelector(`th input[type="checkbox"][data-column="${columnName}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    // Update visual feedback
    updateColumnVisibility();
}

function updateColumnVisibility() {
    // This function now only updates visual feedback for checkboxes
    // Columns remain visible in the table regardless of checkbox state
    // Checkboxes only affect Excel export, not table display
    
    const checkboxes = document.querySelectorAll('th input[type="checkbox"][data-column]');
    
    checkboxes.forEach((checkbox) => {
        const header = checkbox.closest('th');
        const label = header.querySelector('.column-checkbox');
        
        // Add visual feedback for unchecked columns
        if (checkbox.checked) {
            label.style.opacity = '1';
            label.style.fontWeight = '600';
        } else {
            label.style.opacity = '0.6';
            label.style.fontWeight = '400';
        }
    });
}

function getSelectedColumns() {
    const selectedColumns = [];
    const checkboxes = document.querySelectorAll('th input[type="checkbox"][data-column]:checked');
    
    checkboxes.forEach(checkbox => {
        const columnKey = checkbox.getAttribute('data-column');
        const columnHeader = checkbox.closest('th').querySelector('.column-checkbox span').textContent;
        selectedColumns.push({
            key: columnKey,
            header: columnHeader
        });
    });
    
    return selectedColumns;
}

// Validation functions for manual input
async function validateDepartment() {
    const input = document.getElementById('department');
    const value = input.value.trim();
    
    if (!value) {
        clearFieldValidation(input);
        return;
    }
    
    try {
        const result = await window.apiService.lookupDepartments();
        if (result.success) {
            const found = result.data.find(dept => dept.CODEPTO == value);
            if (found) {
                setFieldValid(input, found.DESCRICAO);
            } else {
                setFieldInvalid(input, 'Departamento não encontrado');
            }
        }
    } catch (error) {
        setFieldInvalid(input, 'Erro ao validar departamento');
    }
}

async function validateActivity() {
    const input = document.getElementById('activity');
    const value = input.value.trim();
    
    if (!value) {
        clearFieldValidation(input);
        return;
    }
    
    try {
        const result = await window.apiService.lookupActivities();
        if (result.success) {
            const found = result.data.find(act => act.CODATIV == value);
            if (found) {
                setFieldValid(input, found.RAMO);
            } else {
                setFieldInvalid(input, 'Atividade não encontrada');
            }
        }
    } catch (error) {
        setFieldInvalid(input, 'Erro ao validar atividade');
    }
}

async function validateBranch() {
    const input = document.getElementById('branch');
    const value = input.value.trim();
    
    if (!value) {
        clearFieldValidation(input);
        return;
    }
    
    try {
        const result = await window.apiService.lookupBranches(value);
        if (result.success) {
            const found = result.data.find(branch => branch.CODIGO == value);
            if (found) {
                setFieldValid(input, found.FANTASIA);
            } else {
                setFieldInvalid(input, 'Filial não encontrada');
            }
        }
    } catch (error) {
        setFieldInvalid(input, 'Erro ao validar filial');
    }
}

async function validateBrand() {
    const input = document.getElementById('brand');
    const value = input.value.trim();
    
    if (!value) {
        clearFieldValidation(input);
        return;
    }
    
    // Handle multiple brand codes (comma-separated)
    const codes = value.split(',').map(code => code.trim()).filter(code => code);
    const validCodes = [];
    const invalidCodes = [];
    
    try {
        for (const code of codes) {
            if (!/^\d+$/.test(code)) {
                invalidCodes.push(code);
                continue;
            }
            
            const result = await window.apiService.lookupBrands('', code);
            if (result.success && result.data.length > 0) {
                const found = result.data.find(brand => brand.CODMARCA == code);
                if (found) {
                    validCodes.push({ code, name: found.MARCA });
                } else {
                    invalidCodes.push(code);
                }
            } else {
                invalidCodes.push(code);
            }
        }
        
        if (invalidCodes.length === 0) {
            const names = validCodes.map(item => item.name).join(', ');
            setFieldValid(input, names);
        } else if (validCodes.length > 0) {
            const validNames = validCodes.map(item => item.name).join(', ');
            setFieldInvalid(input, `Válidas: ${validNames}. Inválidas: ${invalidCodes.join(', ')}`);
        } else {
            setFieldInvalid(input, `Marcas não encontradas: ${invalidCodes.join(', ')} (use apenas números)`);
        }
    } catch (error) {
        setFieldInvalid(input, 'Erro ao validar marcas');
    }
}

async function validateProduct() {
    const input = document.getElementById('productCode');
    const value = input.value.trim();
    
    if (!value) {
        clearFieldValidation(input);
        return;
    }
    
    // Handle multiple product codes (comma-separated)
    const codes = value.split(',').map(code => code.trim()).filter(code => code);
    const validCodes = [];
    const invalidCodes = [];
    
    try {
        // For products, we need to validate each code individually
        // since we can't load all products due to performance
        for (const code of codes) {
            if (!/^\d+$/.test(code)) {
                invalidCodes.push(code);
                continue;
            }
            
            // We'll validate the format here and let the SQL query handle the actual validation
            // This is a basic validation - the main validation happens in the SQL query
            if (code.length > 0 && /^\d+$/.test(code)) {
                validCodes.push({ code, name: `Produto ${code}` });
            } else {
                invalidCodes.push(code);
            }
        }
        
        if (invalidCodes.length === 0) {
            const names = validCodes.map(item => `${item.code}`).join(', ');
            setFieldValid(input, `Códigos: ${names}`);
        } else {
            setFieldInvalid(input, `Códigos inválidos: ${invalidCodes.join(', ')} (apenas números)`);
        }
    } catch (error) {
        setFieldInvalid(input, 'Erro ao validar produtos');
    }
}

// Helper functions for field validation styling
function setFieldValid(input, description) {
    input.style.borderColor = '#28a745';
    input.style.backgroundColor = '#e8f5e8';
    input.style.color = '#2c3e50';
    input.title = description;
    
    // Remove any existing validation message
    clearValidationMessage(input);
}

function setFieldInvalid(input, message) {
    input.style.borderColor = '#dc3545';
    input.style.backgroundColor = '#ffeaea';
    input.style.color = '#721c24';
    input.title = message;
    
    // Show validation message
    showValidationMessage(input, message);
}

function clearFieldValidation(input) {
    input.style.borderColor = '';
    input.style.backgroundColor = '';
    input.style.color = '';
    input.title = '';
    
    // Remove any existing validation message
    clearValidationMessage(input);
}

function showValidationMessage(input, message) {
    // Remove existing message
    clearValidationMessage(input);
    
    // Create new validation message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'validation-message';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        color: #dc3545;
        font-size: 0.8rem;
        margin-top: 4px;
        position: absolute;
        z-index: 1000;
        background: white;
        padding: 2px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    // Insert after the input's parent container
    const container = input.closest('.form-group');
    if (container) {
        container.style.position = 'relative';
        container.appendChild(messageDiv);
    }
}

function clearValidationMessage(input) {
    const container = input.closest('.form-group');
    if (container) {
        const existingMessage = container.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    }
}

// Lookup modal functions
let currentLookupType = null;
let currentTargetInput = null;
let currentLookupData = [];
let selectedLookupItems = [];

function openProductLookup() {
    currentLookupType = 'products';
    currentTargetInput = document.getElementById('productCode');
    selectedLookupItems = [];
    
    // Parse existing values
    const currentValue = currentTargetInput.value.trim();
    if (currentValue) {
        selectedLookupItems = currentValue.split(',').map(v => v.trim()).filter(v => v);
    }
    
    modalTitle.textContent = 'Buscar Produtos (Seleção Múltipla)';
    searchContainer.style.display = 'block';
    modalSearchInput.placeholder = 'Digite o nome do produto para buscar...';
    modalSearchInput.value = '';
    modalConfirm.style.display = 'inline-flex';
    modalConfirm.innerHTML = '<i class="fas fa-check"></i> Confirmar Seleção';
    lookupModal.style.display = 'flex';
    
    // Show initial message instead of loading data immediately
    showInitialSearchMessage('Digite o nome do produto para iniciar a busca');
    
    // Add search functionality with minimum character requirement
    modalSearchInput.oninput = debounce(() => {
        const searchTerm = modalSearchInput.value.trim();
        if (searchTerm.length >= 2) {
            loadLookupData('products', searchTerm);
        } else if (searchTerm.length === 0) {
            showInitialSearchMessage('Digite o nome do produto para iniciar a busca');
        } else {
            showInitialSearchMessage('Digite pelo menos 2 caracteres para buscar');
        }
    }, 300);
    
    // Focus on search input
    setTimeout(() => modalSearchInput.focus(), 100);
}

function openDepartmentLookup() {
    currentLookupType = 'departments';
    currentTargetInput = document.getElementById('department');
    modalTitle.textContent = 'Selecionar Departamento';
    searchContainer.style.display = 'none';
    modalConfirm.style.display = 'none';
    lookupModal.style.display = 'flex';
    
    loadLookupData('departments');
}

function openActivityLookup() {
    currentLookupType = 'activities';
    currentTargetInput = document.getElementById('activity');
    modalTitle.textContent = 'Selecionar Atividade';
    searchContainer.style.display = 'none';
    modalConfirm.style.display = 'none';
    lookupModal.style.display = 'flex';
    
    loadLookupData('activities');
}

function openBranchLookup() {
    currentLookupType = 'branches';
    currentTargetInput = document.getElementById('branch');
    modalTitle.textContent = 'Selecionar Filial';
    searchContainer.style.display = 'none';
    modalConfirm.style.display = 'none';
    lookupModal.style.display = 'flex';
    
    loadLookupData('branches');
}

function openBrandLookup() {
    currentLookupType = 'brands';
    currentTargetInput = document.getElementById('brand');
    selectedLookupItems = [];
    
    // Parse existing values
    const currentValue = currentTargetInput.value.trim();
    if (currentValue) {
        selectedLookupItems = currentValue.split(',').map(v => v.trim()).filter(v => v);
    }
    
    modalTitle.textContent = 'Buscar Marcas (Seleção Múltipla)';
    searchContainer.style.display = 'block';
    modalSearchInput.placeholder = 'Digite o nome da marca para buscar...';
    modalSearchInput.value = '';
    modalConfirm.style.display = 'inline-flex';
    modalConfirm.innerHTML = '<i class="fas fa-check"></i> Confirmar Seleção';
    lookupModal.style.display = 'flex';
    
    // Show initial message instead of loading data immediately
    showInitialSearchMessage('Digite o nome da marca para iniciar a busca');
    
    // Add search functionality with minimum character requirement
    modalSearchInput.oninput = debounce(() => {
        const searchTerm = modalSearchInput.value.trim();
        if (searchTerm.length >= 2) {
            loadLookupData('brands', searchTerm);
        } else if (searchTerm.length === 0) {
            showInitialSearchMessage('Digite o nome da marca para iniciar a busca');
        } else {
            showInitialSearchMessage('Digite pelo menos 2 caracteres para buscar');
        }
    }, 300);
    
    // Focus on search input
    setTimeout(() => modalSearchInput.focus(), 100);
}

function cancelLookupModal() {
    // Cancel without saving changes
    lookupModal.style.display = 'none';
    currentLookupType = null;
    currentTargetInput = null;
    currentLookupData = [];
    selectedLookupItems = [];
    lookupList.innerHTML = '';
    modalSearchInput.value = '';
}

function closeLookupModal() {
    // Update input value for multiple selection types before closing
    if ((currentLookupType === 'products' || currentLookupType === 'brands') && selectedLookupItems.length > 0) {
        currentTargetInput.value = selectedLookupItems.join(',');
        currentTargetInput.style.backgroundColor = '#e8f5e8';
        currentTargetInput.style.color = '#2c3e50';
    }
    
    lookupModal.style.display = 'none';
    currentLookupType = null;
    currentTargetInput = null;
    currentLookupData = [];
    selectedLookupItems = [];
    lookupList.innerHTML = '';
    modalSearchInput.value = '';
}

function showInitialSearchMessage(message) {
    lookupLoading.style.display = 'none';
    lookupList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6c757d;">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
            <p style="font-size: 1rem; margin: 0;">${message}</p>
        </div>
    `;
}

async function loadLookupData(type, searchTerm = '') {
    lookupLoading.style.display = 'flex';
    lookupList.innerHTML = '';
    
    try {
        let result;
        
        switch (type) {
            case 'products':
                result = await window.apiService.lookupProducts(searchTerm);
                break;
            case 'departments':
                result = await window.apiService.lookupDepartments();
                break;
            case 'activities':
                result = await window.apiService.lookupActivities();
                break;
            case 'branches':
                result = await window.apiService.lookupBranches();
                break;
            case 'brands':
                result = await window.apiService.lookupBrands(searchTerm, null);
                break;
        }
        
        if (result.success) {
            currentLookupData = result.data;
            displayLookupResults(result.data, type);
        } else {
            lookupList.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">Erro: ${result.error}</div>`;
        }
    } catch (error) {
        lookupList.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">Erro inesperado: ${error.message}</div>`;
    } finally {
        lookupLoading.style.display = 'none';
    }
}

function displayLookupResults(data, type) {
    if (data.length === 0) {
        lookupList.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">Nenhum resultado encontrado.</div>';
        return;
    }
    
    lookupList.innerHTML = '';
    
    // Add selection info for multiple selection types
    if (type === 'products' || type === 'brands') {
        const selectionInfo = document.createElement('div');
        selectionInfo.style.cssText = 'padding: 10px 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; color: #495057;';
        selectionInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-info-circle"></i> Selecionados: <strong>${selectedLookupItems.length}</strong></span>
                ${selectedLookupItems.length > 0 ? '<button id="clearSelection" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-times"></i> Limpar</button>' : ''}
            </div>
        `;
        lookupList.appendChild(selectionInfo);
        
        // Add clear selection functionality
        const clearBtn = selectionInfo.querySelector('#clearSelection');
        if (clearBtn) {
            clearBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent any bubbling
                selectedLookupItems = [];
                displayLookupResults(data, type); // Refresh display
                updateConfirmButtonText();
            });
        }
        
        // Update confirm button text
        updateConfirmButtonText();
    }
    
    data.forEach(item => {
        const lookupItem = document.createElement('div');
        
        let title, subtitle, value, isSelected = false;
        
        switch (type) {
            case 'products':
                title = item.DESCRICAO;
                subtitle = `Código: ${item.CODPROD}`;
                value = item.CODPROD;
                isSelected = selectedLookupItems.includes(value);
                break;
            case 'departments':
                title = item.DESCRICAO;
                subtitle = `Código: ${item.CODEPTO}`;
                value = item.CODEPTO;
                break;
            case 'activities':
                title = item.RAMO;
                subtitle = `Código: ${item.CODATIV}`;
                value = item.CODATIV;
                break;
            case 'branches':
                title = item.FANTASIA;
                subtitle = `Código: ${item.CODIGO}`;
                value = item.CODIGO;
                break;
            case 'brands':
                title = item.MARCA;
                subtitle = `Código: ${item.CODMARCA}${item.ATIVO === 'S' ? ' - Ativo' : ' - Inativo'}`;
                value = item.CODMARCA;
                isSelected = selectedLookupItems.includes(value);
                break;
        }
        
        // Set base class and selected state
        lookupItem.className = isSelected ? 'lookup-item selected' : 'lookup-item';
        
        lookupItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div class="lookup-item-title">${title}</div>
                    <div class="lookup-item-subtitle">${subtitle}</div>
                </div>
                ${(type === 'products' || type === 'brands') ? 
                    `<div style="color: ${isSelected ? '#28a745' : '#6c757d'}; font-size: 1.2rem;">
                        <i class="fas fa-${isSelected ? 'check-circle' : 'circle'}"></i>
                    </div>` : ''}
            </div>
        `;
        
        lookupItem.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent modal background click
            selectLookupItem(value, title, type);
        });
        
        lookupList.appendChild(lookupItem);
    });
}

function selectLookupItem(value, displayText, type) {
    if (type === 'products' || type === 'brands') {
        // Handle multiple selection for products and brands
        const index = selectedLookupItems.indexOf(value);
        if (index > -1) {
            // Remove if already selected
            selectedLookupItems.splice(index, 1);
        } else {
            // Add if not selected
            selectedLookupItems.push(value);
        }
        
        // Refresh the display to show updated selection
        displayLookupResults(currentLookupData, type);
        
        // Update confirm button text with selection count
        updateConfirmButtonText();
        
        // DO NOT close modal - let user continue selecting
    } else {
        // Single selection for other types - close modal immediately
        currentTargetInput.value = value;
        currentTargetInput.setAttribute('data-display', displayText);
        
        // Update placeholder to show selection
        currentTargetInput.style.backgroundColor = '#e8f5e8';
        currentTargetInput.style.color = '#2c3e50';
        
        closeLookupModal();
    }
}

function updateConfirmButtonText() {
    if (selectedLookupItems.length > 0) {
        modalConfirm.innerHTML = `<i class="fas fa-check"></i> Confirmar (${selectedLookupItems.length} selecionado${selectedLookupItems.length > 1 ? 's' : ''})`;
    } else {
        modalConfirm.innerHTML = '<i class="fas fa-check"></i> Confirmar Seleção';
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function handleTestConnection() {
    try {
        testConnectionBtn.disabled = true;
        testConnectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
        hideStatus();

        const result = await window.apiService.testConnection();

        if (result.success) {
            showStatus(result.message, 'success');
        } else {
            showStatus(`Erro na conexão: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Erro inesperado: ${error.message}`, 'error');
        console.error('Test connection error:', error);
    } finally {
        testConnectionBtn.disabled = false;
        testConnectionBtn.innerHTML = '<i class="fas fa-database"></i> Testar Conexão';
    }
}

async function handleSearch(event) {
    event.preventDefault();
    
    const formData = new FormData(filterForm);
    const filters = {
        startDate: formData.get('startDate') || null,
        endDate: formData.get('endDate') || null,
        productCode: formData.get('productCode') || null,
        department: formData.get('department') ? parseInt(formData.get('department')) : null,
        activity: formData.get('activity') ? parseInt(formData.get('activity')) : null,
        brand: formData.get('brand') || null,
        branch: formData.get('branch') || null,
        consultProducts: formData.get('consultProducts') || null
    };

    // Validate required fields
    if (!filters.startDate || !filters.endDate) {
        showStatus('Por favor, preencha as datas de início e fim.', 'error');
        return;
    }

    if (filters.startDate && filters.endDate && new Date(filters.startDate) > new Date(filters.endDate)) {
        showStatus('A data de início deve ser anterior à data de fim.', 'error');
        return;
    }

    try {
        showLoading(true);
        hideStatus();
        hideResults();

        const result = await window.apiService.executeQuery(filters);

        if (result.success) {
            currentData = result.data;
            displayResults(result.data);
            
            let statusMsg = `Pesquisa realizada com sucesso! ${result.rowCount} registros encontrados.`;
            
            // Show filtering information if records were filtered
            const totalFiltered = (result.phoneFilteredCount || 0) + (result.duplicatesCount || 0);
            if (totalFiltered > 0) {
                let filterDetails = [];
                
                if (result.phoneFilteredCount > 0) {
                    filterDetails.push(`${result.phoneFilteredCount} por telefones inválidos`);
                }
                
                if (result.duplicatesCount > 0) {
                    filterDetails.push(`${result.duplicatesCount} duplicados detectados`);
                }
                
                statusMsg += ` (${totalFiltered} registros foram filtrados: ${filterDetails.join(' e ')})`;
            }
            
            showStatus(statusMsg, 'success');
        } else {
            showStatus(`Erro na consulta: ${result.error}`, 'error');
            console.error('Query error:', result.error);
        }
    } catch (error) {
        showStatus(`Erro inesperado: ${error.message}`, 'error');
        console.error('Search error:', error);
    } finally {
        showLoading(false);
    }
}

function displayResults(data) {
    // Clear previous results
    resultsTableBody.innerHTML = '';

    if (data.length === 0) {
        resultsTableBody.innerHTML = `
            <tr>
                <td colspan="14" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    Nenhum registro encontrado com os filtros aplicados.
                </td>
            </tr>
        `;
    } else {
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.CODCLI || ''}</td>
                <td>${row.CLIENTE || ''}</td>
                <td>${row.CODUSUR1 || ''}</td>
                <td>${formatPhone(row.TELCELENT || '')}</td>
                <td>${row.CGCENT || ''}</td>
                <td>${row.ENDERENT || ''}</td>
                <td>${row.BAIRROENT || ''}</td>
                <td>${row.MUNICENT || ''}</td>
                <td>${row.ESTENT || ''}</td>
                <td>${row.CODUSUR2 || ''}</td>
                <td>${formatNumber(row.QT)}</td>
                <td>${formatCurrency(row.VLVENDA)}</td>
                <td>${formatCurrency(row.VLCUSTOFIN)}</td>
                <td>${formatNumber(row.TOTPESO, 3)}</td>
            `;
            resultsTableBody.appendChild(tr);
        });
    }

    // Update record count
    recordCount.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}`;

    // Show results section
    showResults();
    
    // Set default selected columns
    setDefaultColumns();
    
    // Add event listeners to column checkboxes
    const columnCheckboxes = document.querySelectorAll('th input[type="checkbox"][data-column]');
    columnCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateColumnVisibility);
    });
    
    // Add sorting functionality to table headers
    setupColumnSorting();
}

function formatPhone(phone) {
    if (!phone) return '';
    
    // Remove non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Validate phone number - require at least 8 digits
    if (cleaned.length < 8) {
        return ''; // Return empty for invalid phones
    }
    
    // Format as (XX) XXXXX-XXXX for 11 digits
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } 
    // Format as (XX) XXXX-XXXX for 10 digits
    else if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    // Format as (XX) XXX-XXXX for 9 digits
    else if (cleaned.length === 9) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }
    // Format as (XX) XX-XXXX for 8 digits
    else if (cleaned.length === 8) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
    }
    // For other lengths, return the cleaned number as is
    else {
        return cleaned;
    }
}

function formatCurrency(value) {
    if (!value && value !== 0) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(parseFloat(value));
}

function formatNumber(value, decimals = 2) {
    if (!value && value !== 0) return '0';
    
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(parseFloat(value));
}

async function handleExport() {
    if (currentData.length === 0) {
        showStatus('Não há dados para exportar. Realize uma pesquisa primeiro.', 'warning');
        return;
    }

    const selectedColumns = getSelectedColumns();
    if (selectedColumns.length === 0) {
        showStatus('Selecione pelo menos uma coluna para exportar usando os checkboxes.', 'warning');
        return;
    }

    try {
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exportando ${selectedColumns.length} colunas...`;

        // Get sorted data and filter to only include selected columns
        const sortedData = getSortedData();
        const filteredData = sortedData.map(row => {
            const filteredRow = {};
            selectedColumns.forEach(col => {
                filteredRow[col.key] = row[col.key];
            });
            return filteredRow;
        });

        const result = await window.electronAPI.exportToExcel({
            data: filteredData,
            columns: selectedColumns
        });

        if (result.success) {
            showStatus(result.message, 'success');
        } else {
            showStatus(`Erro na exportação: ${result.error || result.message}`, 'error');
        }
    } catch (error) {
        showStatus(`Erro inesperado na exportação: ${error.message}`, 'error');
        console.error('Export error:', error);
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Exportar para Excel';
    }
}

// Column sorting functions
function setupColumnSorting() {
    const headers = document.querySelectorAll('#resultsTable th[data-column]');
    
    headers.forEach(header => {
        // Add sortable class and sort indicator
        header.classList.add('sortable');
        
        // Create sort indicator if it doesn't exist
        if (!header.querySelector('.sort-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            header.appendChild(indicator);
        }
        
        // Add click event listener
        header.addEventListener('click', (e) => {
            // Prevent sorting when clicking on checkbox
            if (e.target.type === 'checkbox' || e.target.closest('label')) {
                return;
            }
            
            const column = header.getAttribute('data-column');
            sortByColumn(column);
        });
    });
}

function sortByColumn(column) {
    // Determine sort direction
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Sort the data
    const sortedData = [...currentData].sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];
        
        // Handle null/undefined values
        if (valueA == null) valueA = '';
        if (valueB == null) valueB = '';
        
        // Convert to string for comparison
        valueA = String(valueA);
        valueB = String(valueB);
        
        // Check if values are numeric
        const numA = parseFloat(valueA.replace(/[^\d.-]/g, ''));
        const numB = parseFloat(valueB.replace(/[^\d.-]/g, ''));
        
        let comparison = 0;
        
        if (!isNaN(numA) && !isNaN(numB)) {
            // Numeric comparison
            comparison = numA - numB;
        } else {
            // String comparison (case insensitive)
            comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
        }
        
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Update the display without recreating event listeners
    updateSortIndicators();
    displaySortedResults(sortedData);
}

function updateSortIndicators() {
    // Clear all sort indicators
    const headers = document.querySelectorAll('#resultsTable th[data-column]');
    headers.forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Add sort indicator to current column
    if (currentSortColumn) {
        const currentHeader = document.querySelector(`#resultsTable th[data-column="${currentSortColumn}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${currentSortDirection}`);
        }
    }
}

function displaySortedResults(data) {
    // Clear previous results
    resultsTableBody.innerHTML = '';

    if (data.length === 0) {
        resultsTableBody.innerHTML = `
            <tr>
                <td colspan="14" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    Nenhum registro encontrado com os filtros aplicados.
                </td>
            </tr>
        `;
    } else {
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.CODCLI || ''}</td>
                <td>${row.CLIENTE || ''}</td>
                <td>${row.CODUSUR1 || ''}</td>
                <td>${formatPhone(row.TELCELENT || '')}</td>
                <td>${row.CGCENT || ''}</td>
                <td>${row.ENDERENT || ''}</td>
                <td>${row.BAIRROENT || ''}</td>
                <td>${row.MUNICENT || ''}</td>
                <td>${row.ESTENT || ''}</td>
                <td>${row.CODUSUR2 || ''}</td>
                <td>${formatNumber(row.QT)}</td>
                <td>${formatCurrency(row.VLVENDA)}</td>
                <td>${formatCurrency(row.VLCUSTOFIN)}</td>
                <td>${formatNumber(row.TOTPESO, 3)}</td>
            `;
            resultsTableBody.appendChild(tr);
        });
    }

    // Update record count
    recordCount.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}`;
}

function getSortedData() {
    if (!currentSortColumn) {
        return currentData;
    }
    
    return [...currentData].sort((a, b) => {
        let valueA = a[currentSortColumn];
        let valueB = b[currentSortColumn];
        
        // Handle null/undefined values
        if (valueA == null) valueA = '';
        if (valueB == null) valueB = '';
        
        // Convert to string for comparison
        valueA = String(valueA);
        valueB = String(valueB);
        
        // Check if values are numeric
        const numA = parseFloat(valueA.replace(/[^\d.-]/g, ''));
        const numB = parseFloat(valueB.replace(/[^\d.-]/g, ''));
        
        let comparison = 0;
        
        if (!isNaN(numA) && !isNaN(numB)) {
            // Numeric comparison
            comparison = numA - numB;
        } else {
            // String comparison (case insensitive)
            comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
        }
        
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
}

function clearForm() {
    filterForm.reset();
    
    // Reset dates to default
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = formatDateForInput(firstDayOfMonth);
    document.getElementById('endDate').value = formatDateForInput(today);
    
    // Remove any invalid styling from date inputs
    document.getElementById('startDate').classList.remove('invalid');
    document.getElementById('endDate').classList.remove('invalid');
    
    // Reset lookup fields
    const lookupFields = ['department', 'activity', 'branch', 'brand', 'productCode'];
    lookupFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Clear validation styling
            clearFieldValidation(field);
            // Remove any display attributes
            field.removeAttribute('data-display');
        }
    });
    
    hideResults();
    hideStatus();
    currentData = [];
}

function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
    searchBtn.disabled = show;
    
    if (show) {
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pesquisando...';
    } else {
        searchBtn.innerHTML = '<i class="fas fa-search"></i> Pesquisar';
    }
}

function showResults() {
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideResults() {
    resultsSection.style.display = 'none';
}

function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    // Auto hide success and warning messages after a few seconds
    if (type === 'success') {
        setTimeout(() => {
            hideStatus();
        }, 5000);
    } else if (type === 'warning') {
        setTimeout(() => {
            hideStatus();
        }, 3000);
    }
}

function hideStatus() {
    statusMessage.style.display = 'none';
}

// Handle form input validation
document.addEventListener('input', function(event) {
    const target = event.target;
    
    // Validate numeric fields
    if (target.type === 'number' && target.value && target.value < 0) {
        target.value = '';
    }
    
    // Date validation - only show warning, don't auto-adjust dates
    if (target.type === 'date') {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        // Remove previous invalid styling
        startDateInput.classList.remove('invalid');
        endDateInput.classList.remove('invalid');
        
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            // Add invalid styling to both inputs
            startDateInput.classList.add('invalid');
            endDateInput.classList.add('invalid');
            
            // Show warning but don't auto-adjust dates
            showStatus('A data de início deve ser anterior à data de fim.', 'warning');
        } else {
            // Hide warning if dates are valid
            const currentStatus = statusMessage.className;
            if (currentStatus.includes('warning')) {
                hideStatus();
            }
        }
    }
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl + Enter to search
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (!searchBtn.disabled) {
            handleSearch(event);
        }
    }
    
    // Ctrl + E to export
    if (event.ctrlKey && event.key === 'e') {
        event.preventDefault();
        if (currentData.length > 0 && !exportBtn.disabled) {
            handleExport();
        }
    }
    
    // Escape to clear
    if (event.key === 'Escape') {
        clearForm();
    }
});