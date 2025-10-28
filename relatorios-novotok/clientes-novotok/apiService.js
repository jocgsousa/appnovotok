// API Service for Oracle queries
class ApiService {
    constructor() {
        this.baseUrl = this.getApiBaseUrl();
    }

    getApiBaseUrl() {
    return localStorage.getItem('apiBaseUrl') || 'http://192.168.10.200:3334/api';
  }

    async request(endpoint, options = {}) {
        const url = `${this.getApiBaseUrl()}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            console.log(`API Request: ${finalOptions.method || 'GET'} ${url}`);
            
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            throw error;
        }
    }

    // Test Oracle connection
    async testConnection() {
        return this.request('/oracle/test-connection');
    }

    // Execute main client query
    async executeQuery(filters) {
        return this.request('/oracle/query', {
            method: 'POST',
            body: JSON.stringify(filters)
        });
    }

    // Lookup methods
    async lookupProducts(searchTerm) {
        const params = searchTerm ? `?searchTerm=${encodeURIComponent(searchTerm)}` : '';
        return this.request(`/oracle/products${params}`);
    }

    async lookupBranches(codigo) {
        const params = codigo ? `?codigo=${encodeURIComponent(codigo)}` : '';
        return this.request(`/oracle/branches${params}`);
    }

    async lookupDepartments() {
        return this.request('/oracle/departments');
    }

    async lookupActivities() {
        return this.request('/oracle/activities');
    }

    async lookupBrands(searchTerm, codmarca) {
        const params = new URLSearchParams();
        if (searchTerm) params.append('searchTerm', searchTerm);
        if (codmarca) params.append('codmarca', codmarca);
        const queryString = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/oracle/brands${queryString}`);
    }
}

// Create global instance
window.apiService = new ApiService();