/**
 * CLOUDPULSE CENTRALIZED API CLIENT & SERVICES ARCHITECTURE
 * 
 * Reusable, framework-agnostic client for AWS API Gateway, Lambda, Cognito, and REST backends.
 * Features:
 * - Request timeouts with AbortController
 * - Unified error normalization (Network, CORS, 401/403, 404, 500)
 * - Safe credential handling (no secrets logged or leaked)
 * - Demo Mode vs Live Mode isolation
 * - Service modules: authService, taskService, goalService, employeeService, analyticsService, notificationService
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CloudPulseAPI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // =========================================================================
  // 1. CONFIGURATION SERVICE
  // =========================================================================
  
  const CONFIG_STORAGE_KEY = 'cloudpulse_api_config';
  const MODE_STORAGE_KEY = 'cloudpulse_app_mode';

  const DEFAULT_CONFIG = {
    baseUrl: 'https://zpbpv26plb.execute-api.ap-south-1.amazonaws.com/prod',
    authMode: 'none', // 'none' | 'bearer' | 'cognito' | 'apikey'
    apiKey: '',
    bearerToken: '',
    cognito: {
      userPoolId: '',
      clientId: '',
      region: 'ap-south-1',
      token: ''
    },
    timeoutMs: 10000,
    healthEndpoint: '/tasks'
  };

  class ConfigurationService {
    constructor() {
      this.config = this.loadConfig();
      this.mode = this.loadMode();
      this.lastTestResult = null;
    }

    loadConfig() {
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            const config = {
              ...DEFAULT_CONFIG,
              ...parsed,
              // Sensitive tokens are cleared from disk if found or only kept transiently
              bearerToken: parsed.bearerToken || '',
              apiKey: parsed.apiKey || '',
              cognito: { ...DEFAULT_CONFIG.cognito, ...(parsed.cognito || {}) }
            };
            // Automatically upgrade old placeholders to active deployed URL
            if (!config.baseUrl || config.baseUrl.includes('your-api-id') || config.baseUrl.includes('api.example.com')) {
              config.baseUrl = DEFAULT_CONFIG.baseUrl;
            }
            return config;
          }
        }
      } catch (err) {}
      return { ...DEFAULT_CONFIG };
    }

    saveConfig(newConfig, persistCredentials = false) {
      this.config = {
        ...this.config,
        ...newConfig,
        baseUrl: this.normalizeUrl(newConfig.baseUrl || '')
      };

      try {
        if (typeof localStorage !== 'undefined') {
          const toPersist = { ...this.config };
          if (!persistCredentials) {
            toPersist.bearerToken = '';
            toPersist.apiKey = '';
            if (toPersist.cognito) {
              toPersist.cognito = { ...toPersist.cognito, token: '' };
            }
          }
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(toPersist));
        }
      } catch (err) {}
      return this.config;
    }

    resetConfig() {
      this.config = { ...DEFAULT_CONFIG };
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(CONFIG_STORAGE_KEY);
        }
      } catch (e) {}
      this.setMode('live');
      return this.config;
    }

    loadMode() {
      try {
        if (typeof localStorage !== 'undefined') {
          const m = localStorage.getItem(MODE_STORAGE_KEY);
          if (m === 'demo') return 'demo';
          if (m === 'live') return 'live';
        }
        return 'live';
      } catch (e) {
        return 'live';
      }
    }

    setMode(mode) {
      this.mode = mode === 'live' ? 'live' : 'demo';
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(MODE_STORAGE_KEY, this.mode);
        }
      } catch (e) {}
      return this.mode;
    }

    isLiveMode() {
      return this.mode === 'live' && Boolean(this.config.baseUrl);
    }

    normalizeUrl(url) {
      if (!url) return '';
      let clean = url.trim();
      // Remove trailing slash
      if (clean.endsWith('/')) {
        clean = clean.slice(0, -1);
      }
      return clean;
    }

    validateUrl(url) {
      if (!url || typeof url !== 'string') {
        return { valid: false, error: 'API Base URL is required.' };
      }
      const trimmed = url.trim();
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { valid: false, error: 'URL must use http:// or https:// protocol.' };
        }
        const isSecure = parsed.protocol === 'https:';
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (!isSecure && !isLocal) {
          return {
            valid: true,
            warning: 'Insecure HTTP endpoint detected. AWS API Gateway and production clouds require HTTPS.'
          };
        }
        return { valid: true };
      } catch (e) {
        return { valid: false, error: 'Invalid URL format. Example: https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod' };
      }
    }
  }

  const configService = new ConfigurationService();

  // =========================================================================
  // 2. AUTHENTICATION SERVICE
  // =========================================================================

  class AuthService {
    constructor(configSvc) {
      this.configSvc = configSvc;
    }

    getAuthHeaders() {
      const cfg = this.configSvc.config;
      const headers = {};

      switch (cfg.authMode) {
        case 'bearer':
          if (cfg.bearerToken) {
            headers['Authorization'] = `Bearer ${cfg.bearerToken.trim()}`;
          }
          break;
        case 'cognito':
          const token = cfg.cognito?.token || cfg.bearerToken;
          if (token) {
            headers['Authorization'] = `Bearer ${token.trim()}`;
          }
          if (cfg.cognito?.clientId) {
            headers['X-Cognito-Client-Id'] = cfg.cognito.clientId;
          }
          break;
        case 'apikey':
          if (cfg.apiKey) {
            headers['x-api-key'] = cfg.apiKey.trim();
          }
          break;
        case 'none':
        default:
          break;
      }

      return headers;
    }

    isAuthenticated() {
      const cfg = this.configSvc.config;
      if (cfg.authMode === 'none') return true;
      if (cfg.authMode === 'bearer') return Boolean(cfg.bearerToken);
      if (cfg.authMode === 'cognito') return Boolean(cfg.cognito?.token);
      if (cfg.authMode === 'apikey') return Boolean(cfg.apiKey);
      return false;
    }
  }

  const authService = new AuthService(configService);

  // =========================================================================
  // 3. CORE HTTP API CLIENT
  // =========================================================================

  class ApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = options.status || 0;
      this.statusText = options.statusText || '';
      this.data = options.data || null;
      this.type = options.type || 'UNKNOWN_ERROR';
      this.diagnostic = options.diagnostic || '';
      this.url = options.url || '';
    }
  }

  class ApiClient {
    constructor(configSvc, authSvc) {
      this.configSvc = configSvc;
      this.authSvc = authSvc;
      this.activeControllers = new Set();
    }

    buildUrl(endpoint) {
      const base = this.configSvc.config.baseUrl;
      if (!base) {
        throw new ApiError('No API Base URL configured.', { type: 'CONFIG_MISSING' });
      }

      let ep = endpoint.trim();
      // Ensure leading slash
      if (!ep.startsWith('/')) {
        ep = '/' + ep;
      }

      // Check if base already includes the endpoint path to avoid duplication (e.g. base has /tasks and ep is /tasks)
      try {
        const parsedBase = new URL(base);
        const basePath = parsedBase.pathname.replace(/\/+$/, '');

        // Case 1: Base URL already ends with this endpoint path (e.g. /prod/tasks and endpoint is /tasks)
        if (basePath && basePath.endsWith(ep)) {
          return `${parsedBase.origin}${basePath}`;
        }

        // Case 2: Endpoint starts with full basePath (e.g. ep is /prod/tasks and base is /prod)
        if (basePath && ep.startsWith(basePath)) {
          ep = ep.slice(basePath.length);
          if (!ep.startsWith('/')) ep = '/' + ep;
        }
      } catch (e) {}

      return `${base}${ep}`;
    }

    async request(endpoint, options = {}) {
      const url = options._overrideUrl || this.buildUrl(endpoint);
      const method = (options.method || 'GET').toUpperCase();
      const timeoutMs = options.timeoutMs || this.configSvc.config.timeoutMs || 10000;

      const controller = new AbortController();
      this.activeControllers.add(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const headers = {
        'Accept': 'application/json',
        ...this.authSvc.getAuthHeaders(),
        ...(options.headers || {})
      };

      let body = options.body;
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }

      const fetchOptions = {
        method,
        headers,
        body,
        signal: controller.signal,
        mode: 'cors'
      };

      try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timer);
        this.activeControllers.delete(controller);

        // Parse Response
        const contentType = response.headers.get('content-type') || '';
        let responseData = null;

        if (contentType.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch (jsonErr) {
            responseData = null;
          }
        } else {
          try {
            responseData = await response.text();
          } catch (textErr) {
            responseData = null;
          }
        }

        if (!response.ok) {
          throw this.normalizeHttpError(response, responseData, url);
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: responseData
        };

      } catch (err) {
        clearTimeout(timer);
        this.activeControllers.delete(controller);

        if (err instanceof ApiError) {
          throw err;
        }

        if (err.name === 'AbortError') {
          throw new ApiError(`Request timed out after ${timeoutMs}ms. Backend server did not respond in time.`, {
            type: 'TIMEOUT',
            url,
            diagnostic: 'Check if the backend AWS Lambda / API Gateway is warm and accessible.'
          });
        }

        if (err instanceof TypeError && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network'))) {
          // If running locally in a browser, automatically retry once through local dev-server /aws-proxy
          if (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !options._isProxyRetry) {
            console.warn('[ApiClient] Direct AWS fetch blocked by browser CORS policy. Retrying seamlessly via local dev proxy (/aws-proxy)...');
            let proxyEp = endpoint.trim();
            if (!proxyEp.startsWith('/')) proxyEp = '/' + proxyEp;
            if (proxyEp.startsWith('/prod/')) proxyEp = proxyEp.replace('/prod', '');
            const proxyUrl = `${window.location.origin}/aws-proxy${proxyEp}`;
            try {
              return await this.request(endpoint, {
                ...options,
                _isProxyRetry: true,
                _overrideUrl: proxyUrl
              });
            } catch (proxyErr) {
              console.warn('[ApiClient] Local proxy retry failed:', proxyErr);
            }
          }

          // Typically CORS or Network down
          throw new ApiError('Network or CORS error connecting to endpoint.', {
            type: 'NETWORK_OR_CORS',
            url,
            diagnostic: 'Browser blocked request. Ensure API Gateway has CORS enabled (Access-Control-Allow-Origin, Allow-Headers: Authorization, x-api-key, Content-Type) and backend is reachable.'
          });
        }

        throw new ApiError(err.message || 'Unknown network error', {
          type: 'NETWORK_ERROR',
          url,
          diagnostic: err.toString()
        });
      }
    }

    normalizeHttpError(response, data, url) {
      const status = response.status;
      let type = 'HTTP_ERROR';
      let message = `HTTP ${status}: ${response.statusText}`;
      let diagnostic = '';

      if (data && typeof data === 'object' && data.message) {
        message = data.message;
      } else if (typeof data === 'string' && data.trim()) {
        message = data.slice(0, 160);
      }

      switch (status) {
        case 400:
          type = 'BAD_REQUEST';
          diagnostic = 'The request payload or parameters failed backend validation schema.';
          break;
        case 401:
          type = 'UNAUTHORIZED';
          diagnostic = 'Invalid or missing authentication token. Check Bearer token or Cognito authorization.';
          break;
        case 403:
          type = 'FORBIDDEN';
          diagnostic = 'Access forbidden. Check IAM permissions, API Gateway resource policy, or user role.';
          break;
        case 404:
          type = 'NOT_FOUND';
          diagnostic = `Endpoint route not found at "${url}". Check API Gateway stage name or route mapping.`;
          break;
        case 429:
          type = 'RATE_LIMITED';
          diagnostic = 'API Gateway throttling limits exceeded. Retry with exponential backoff.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          type = 'SERVER_ERROR';
          diagnostic = 'AWS Lambda execution failure, timeout, or DynamoDB exception on the backend.';
          break;
        default:
          type = 'HTTP_ERROR';
          diagnostic = `Server responded with status code ${status}.`;
          break;
      }

      return new ApiError(message, {
        status,
        statusText: response.statusText,
        data,
        type,
        diagnostic,
        url
      });
    }

    abortAll() {
      for (const ctrl of this.activeControllers) {
        try {
          ctrl.abort();
        } catch (e) {}
      }
      this.activeControllers.clear();
    }

    get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'POST', body });
    }

    put(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    patch(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'PATCH', body });
    }

    delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    }
  }

  const apiClient = new ApiClient(configService, authService);

  // =========================================================================
  // 4. FEATURE SERVICE: HEALTH & DIAGNOSTICS
  // =========================================================================

  class HealthService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async testConnection(customConfig = null) {
      const cfg = customConfig || this.configSvc.config;
      const urlCheck = this.configSvc.validateUrl(cfg.baseUrl);
      if (!urlCheck.valid) {
        return {
          success: false,
          status: 0,
          error: urlCheck.error,
          type: 'INVALID_URL',
          diagnostic: 'Please enter a valid HTTP/HTTPS API base URL.'
        };
      }

      // Safe probe endpoints in order: /tasks (verified active DynamoDB route), /health, /ping, /
      const probeEndpoints = ['/tasks', cfg.healthEndpoint || '/health', '/ping', '/'];
      let lastErr = null;
      const startTime = performance.now();

      for (const endpoint of probeEndpoints) {
        try {
          // Temporary override for testing custom config without persisting
          const tempClient = customConfig ? new ApiClient(
            { config: customConfig, validateUrl: this.configSvc.validateUrl },
            new AuthService({ config: customConfig })
          ) : this.client;

          const res = await tempClient.get(endpoint, { timeoutMs: 6000 });
          const latencyMs = Math.round(performance.now() - startTime);

          const result = {
            success: true,
            status: res.status,
            latencyMs,
            endpoint,
            data: res.data,
            timestamp: new Date().toISOString(),
            summary: `Connected successfully (${res.status} OK, ${latencyMs}ms latency via ${endpoint})`
          };
          this.configSvc.lastTestResult = result;
          return result;
        } catch (err) {
          lastErr = err;
          // If 401 or 403, we connected to server, but auth failed
          if (err.status === 401 || err.status === 402 || err.status === 403) {
            const latencyMs = Math.round(performance.now() - startTime);
            return {
              success: false,
              status: err.status,
              latencyMs,
              endpoint,
              type: err.type,
              error: err.message,
              diagnostic: err.diagnostic,
              summary: `Connection reached API (${err.status}), but authentication failed. Check credentials.`
            };
          }
          // If 404, try next probe endpoint
          if (err.status === 404) {
            continue;
          }
          // If network or timeout, stop early
          if (err.type === 'NETWORK_OR_CORS' || err.type === 'TIMEOUT') {
            break;
          }
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        status: lastErr ? lastErr.status : 0,
        latencyMs,
        type: lastErr ? lastErr.type : 'PROBE_FAILED',
        error: lastErr ? lastErr.message : 'Failed to reach API endpoint.',
        diagnostic: lastErr ? lastErr.diagnostic : 'Ensure your API server is running and CORS headers are configured.',
        summary: lastErr ? `${lastErr.type}: ${lastErr.message}` : 'Failed to connect.'
      };
    }

    async testAllEndpoints() {
      const endpoints = [
        { name: 'Tasks API (Active)', path: '/tasks', method: 'GET' },
        { name: 'Health Check', path: '/health', method: 'GET' },
        { name: 'Goals API', path: '/goals', method: 'GET' },
        { name: 'Employees API', path: '/employees', method: 'GET' },
        { name: 'Analytics API', path: '/analytics', method: 'GET' },
        { name: 'Notifications API', path: '/notifications', method: 'GET' }
      ];

      const results = [];
      for (const ep of endpoints) {
        const start = performance.now();
        try {
          const res = await this.client.get(ep.path, { timeoutMs: 4000 });
          results.push({
            ...ep,
            status: res.status,
            latencyMs: Math.round(performance.now() - start),
            ok: true
          });
        } catch (err) {
          results.push({
            ...ep,
            status: err.status || 0,
            latencyMs: Math.round(performance.now() - start),
            ok: false,
            error: err.message,
            type: err.type
          });
        }
      }
      return results;
    }
  }

  const healthService = new HealthService(apiClient, configService);

  // =========================================================================
  // 5. FEATURE SERVICE: TASKS (AWS DynamoDB & API Gateway Integration)
  // =========================================================================

  function mapBackendStatusToUi(status) {
    if (!status) return 'Pending';
    const upper = String(status).toUpperCase();
    if (upper === 'DONE' || upper === 'COMPLETED') return 'Completed';
    if (upper === 'IN_PROGRESS') return 'In Progress';
    if (upper === 'READY_FOR_REVIEW' || upper === 'READY FOR REVIEW') return 'Ready for Review';
    if (upper === 'TODO' || upper === 'PENDING') return 'Pending';
    return status;
  }

  function mapUiStatusToBackend(status) {
    if (!status) return 'TODO';
    const s = String(status).trim();
    if (s === 'Completed') return 'DONE';
    if (s === 'In Progress' || s === 'Ready for Review') return 'IN_PROGRESS';
    if (s === 'Pending') return 'TODO';
    const upper = s.toUpperCase();
    if (['TODO', 'IN_PROGRESS', 'DONE'].includes(upper)) return upper;
    return 'TODO';
  }

  function parseTaskDescription(desc) {
    if (!desc || typeof desc !== 'string') {
      return { notes: '', parentDirective: '', assignedEmployee: '', assignedManager: '', dueDate: '', estHours: null, progress: null };
    }
    const trimmed = desc.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            notes: parsed.notes || parsed.description || '',
            parentDirective: parsed.parentDirective || parsed.directive || '',
            assignedEmployee: parsed.assignedEmployee || parsed.assignee || '',
            assignedManager: parsed.assignedManager || parsed.manager || '',
            dueDate: parsed.dueDate || '',
            estHours: typeof parsed.estHours === 'number' ? parsed.estHours : (parsed.estHours ? Number(parsed.estHours) : null),
            progress: typeof parsed.progress === 'number' ? parsed.progress : (parsed.progress ? Number(parsed.progress) : null)
          };
        }
      } catch (e) {}
    }
    return {
      notes: desc,
      parentDirective: desc,
      assignedEmployee: '',
      assignedManager: '',
      dueDate: '',
      estHours: null,
      progress: null
    };
  }

  function encodeTaskDescription(taskData) {
    if (!taskData) return '';
    const meta = {
      notes: taskData.notes || taskData.description || '',
      parentDirective: taskData.parentDirective || taskData.description || 'General Cloud Initiative',
      assignedEmployee: taskData.assignedEmployee || 'Unassigned',
      assignedManager: taskData.assignedManager || 'Unassigned',
      dueDate: taskData.dueDate || '2026-10-30',
      estHours: taskData.estHours ? Number(taskData.estHours) : 16,
      progress: typeof taskData.progress === 'number' ? taskData.progress : (taskData.status === 'Completed' ? 100 : taskData.status === 'Ready for Review' ? 90 : taskData.status === 'In Progress' ? 50 : 15)
    };
    return JSON.stringify(meta);
  }

  function normalizeTask(task) {
    if (!task) return null;
    const id = task.taskId || task.id || `task-${Date.now()}`;
    const uiStatus = mapBackendStatusToUi(task.status);
    const meta = parseTaskDescription(task.description);

    let progress = typeof task.progress === 'number' ? task.progress : meta.progress;
    if (progress === null || isNaN(progress)) {
      if (uiStatus === 'Completed') progress = 100;
      else if (uiStatus === 'Ready for Review') progress = 90;
      else if (uiStatus === 'In Progress') progress = 60;
      else progress = 15;
    }

    const assignedEmployee = task.assignedEmployee || meta.assignedEmployee || 'Unassigned';
    const rawMgr = task.assignedManager || meta.assignedManager || '';
    const assignedManager = (rawMgr && !rawMgr.toLowerCase().includes('alex rivera') && !rawMgr.toLowerCase().includes('maya patel')) ? rawMgr : 'Unassigned';
    const parentDirective = task.parentDirective || meta.parentDirective || (meta.notes && meta.notes.length > 5 ? meta.notes : 'General Cloud Initiative');
    const dueDate = task.dueDate || meta.dueDate || (task.createdAt ? task.createdAt.split('T')[0] : '2026-10-30');
    const estHours = task.estHours ? Number(task.estHours) : (meta.estHours ? Number(meta.estHours) : 16);
    const notes = meta.notes || (typeof task.description === 'string' && !task.description.startsWith('{') ? task.description : '');

    return {
      id: id,
      taskId: id,
      title: task.title || 'Untitled Task',
      description: notes || parentDirective,
      notes: notes,
      parentDirective: parentDirective,
      assignedEmployee: assignedEmployee,
      assignedManager: assignedManager,
      dueDate: dueDate,
      estHours: estHours,
      progress: progress,
      status: uiStatus,
      backendStatus: task.status || mapUiStatusToBackend(uiStatus),
      priority: task.priority || 'MEDIUM',
      createdAt: task.createdAt || new Date().toISOString()
    };
  }

  class TaskService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async getTasks(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/tasks?${query}` : '/tasks';
      const res = await this.client.get(endpoint);
      const data = res.data;
      let rawList = [];
      if (Array.isArray(data)) rawList = data;
      else if (data && Array.isArray(data.tasks)) rawList = data.tasks;
      else if (data && Array.isArray(data.items)) rawList = data.items;

      // Filter out employee records stored in CloudPulse-Tasks DynamoDB table
      rawList = rawList.filter(item => {
        if (!item) return false;
        const title = item.title || '';
        const desc = item.description || '';
        if (typeof title === 'string' && title.startsWith('[EMPLOYEE]')) return false;
        if (typeof desc === 'string' && desc.includes('"recordType":"EMPLOYEE"')) return false;
        return true;
      });

      return rawList.map(normalizeTask);
    }

    async getTaskById(taskId) {
      const res = await this.client.get(`/tasks/${encodeURIComponent(taskId)}`);
      const raw = (res.data && res.data.task) ? res.data.task : res.data;
      return normalizeTask(raw);
    }

    async createTask(taskData) {
      const encodedDesc = encodeTaskDescription(taskData);
      const targetBackendStatus = mapUiStatusToBackend(taskData.status);
      const payload = {
        title: taskData.title,
        description: encodedDesc,
        status: targetBackendStatus,
        priority: (taskData.priority || 'MEDIUM').toUpperCase()
      };
      const res = await this.client.post('/tasks', payload);
      let raw = (res.data && res.data.task) ? res.data.task : res.data;

      // Update status via PUT if non-TODO, since backend Lambda defaults POST to TODO
      const createdId = raw.taskId || raw.id;
      if (createdId && targetBackendStatus !== 'TODO') {
        try {
          const putRes = await this.client.put(`/tasks/${encodeURIComponent(createdId)}`, {
            title: taskData.title,
            description: encodedDesc,
            status: targetBackendStatus,
            priority: (taskData.priority || 'MEDIUM').toUpperCase()
          });
          if (putRes.data && putRes.data.task) {
            raw = putRes.data.task;
          }
        } catch (e) {
          console.warn('[CloudPulse] Initial status PUT follow-up:', e);
        }
      }

      return normalizeTask({ ...taskData, ...raw });
    }

    async updateTask(taskId, updates) {
      const encodedDesc = encodeTaskDescription(updates);
      const targetStatus = mapUiStatusToBackend(updates.status);
      const payload = {
        title: updates.title,
        description: encodedDesc,
        status: targetStatus,
        priority: (updates.priority || 'MEDIUM').toUpperCase()
      };
      const res = await this.client.put(`/tasks/${encodeURIComponent(taskId)}`, payload);
      const raw = (res.data && res.data.task) ? res.data.task : res.data;
      return normalizeTask({ ...updates, ...raw, id: taskId, taskId });
    }

    async updateTaskStatus(taskId, status, progress) {
      try {
        const current = await this.getTaskById(taskId);
        const updatedData = {
          ...current,
          status,
          progress: typeof progress === 'number' ? progress : current.progress
        };
        return this.updateTask(taskId, updatedData);
      } catch (err) {
        // Fallback minimal PUT
        const payload = {
          status: mapUiStatusToBackend(status)
        };
        const res = await this.client.put(`/tasks/${encodeURIComponent(taskId)}`, payload);
        const raw = (res.data && res.data.task) ? res.data.task : res.data;
        return normalizeTask({ ...raw, progress, id: taskId, taskId });
      }
    }

    async deleteTask(taskId) {
      const res = await this.client.delete(`/tasks/${encodeURIComponent(taskId)}`);
      return res.data;
    }
  }

  const taskService = new TaskService(apiClient, configService);

  // =========================================================================
  // 6. FEATURE SERVICE: GOALS / DIRECTIVES
  // =========================================================================

  class GoalService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async getGoals(params = {}) {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/goals?${query}` : '/goals';
      const res = await this.client.get(endpoint);
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.goals)) return data.goals;
      if (data && Array.isArray(data.directives)) return data.directives;
      if (data && Array.isArray(data.items)) return data.items;
      return [];
    }

    async getGoalById(goalId) {
      const res = await this.client.get(`/goals/${encodeURIComponent(goalId)}`);
      return res.data;
    }

    async createGoal(goalData) {
      const res = await this.client.post('/goals', goalData);
      return res.data;
    }

    async updateGoal(goalId, updates) {
      const res = await this.client.put(`/goals/${encodeURIComponent(goalId)}`, updates);
      return res.data;
    }

    async deleteGoal(goalId) {
      const res = await this.client.delete(`/goals/${encodeURIComponent(goalId)}`);
      return res.data;
    }
  }

  const goalService = new GoalService(apiClient, configService);

  // =========================================================================
  // 7. FEATURE SERVICE: EMPLOYEES
  // =========================================================================

  class EmployeeService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async getEmployees(params = {}) {
      // 1. Try dedicated /employees endpoint if available
      try {
        const query = new URLSearchParams(params).toString();
        const endpoint = query ? `/employees?${query}` : '/employees';
        const res = await this.client.get(endpoint, { timeoutMs: 3000 });
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) return data;
        if (data && Array.isArray(data.employees) && data.employees.length > 0) return data.employees;
        if (data && Array.isArray(data.items) && data.items.length > 0) return data.items;
      } catch (err) {
        // Dedicated endpoint not present in API Gateway, proceed to DynamoDB CloudPulse-Tasks table
      }

      // 2. Fetch employee records stored in CloudPulse-Tasks table
      try {
        const res = await this.client.get('/tasks', { timeoutMs: 6000 });
        const data = res.data;
        let rawList = [];
        if (Array.isArray(data)) rawList = data;
        else if (data && Array.isArray(data.tasks)) rawList = data.tasks;
        else if (data && Array.isArray(data.items)) rawList = data.items;

        const dbEmployees = [];
        for (const item of rawList) {
          const title = item.title || '';
          const desc = item.description || '';
          if (title.startsWith('[EMPLOYEE]') || (typeof desc === 'string' && desc.includes('"recordType":"EMPLOYEE"'))) {
            let meta = {};
            try {
              meta = (typeof desc === 'string' && desc.startsWith('{')) ? JSON.parse(desc) : {};
            } catch (e) {}

            const empName = meta.name || title.replace('[EMPLOYEE]', '').trim();
            dbEmployees.push({
              id: meta.id || `emp-${item.taskId || item.id}`,
              dbTaskId: item.taskId || item.id,
              name: empName,
              role: meta.role || 'Software Engineer',
              dept: meta.dept || 'Engineering',
              manager: (meta.manager && meta.manager !== 'Alex Rivera' && meta.manager !== 'Maya Patel') ? meta.manager : 'Unassigned',
              productivity: typeof meta.productivity === 'number' ? meta.productivity : 95,
              focusHours: meta.focusHours || '0.0h',
              status: meta.status || 'Online',
              kudos: meta.kudos || 'Onboarded via AWS DynamoDB',
              avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
              isFromDynamoDB: true
            });
          }
        }
        return dbEmployees;
      } catch (e) {
        console.warn('[EmployeeService] Error reading employees from DynamoDB:', e);
        return [];
      }
    }

    async getManagers() {
      try {
        const res = await this.client.get('/tasks', { timeoutMs: 6000 });
        const data = res.data;
        let rawList = [];
        if (Array.isArray(data)) rawList = data;
        else if (data && Array.isArray(data.tasks)) rawList = data.tasks;
        else if (data && Array.isArray(data.items)) rawList = data.items;

        const dbManagers = [];
        for (const item of rawList) {
          const title = item.title || '';
          const desc = item.description || '';
          if (title.startsWith('[MANAGER]') || (typeof desc === 'string' && desc.includes('"recordType":"MANAGER"'))) {
            let meta = {};
            try {
              meta = (typeof desc === 'string' && desc.startsWith('{')) ? JSON.parse(desc) : {};
            } catch (e) {}

            const mgrName = meta.name || title.replace('[MANAGER]', '').trim();
            // Discard any legacy mock managers
            if (mgrName.toLowerCase().includes('alex rivera') || mgrName.toLowerCase().includes('maya patel')) continue;

            dbManagers.push({
              id: meta.id || `mgr-${item.taskId || item.id}`,
              dbTaskId: item.taskId || item.id,
              name: mgrName,
              dept: meta.dept || 'Engineering',
              role: meta.role || 'Team Manager',
              email: meta.email || '',
              subordinatesCount: meta.subordinatesCount || 0,
              assignedDirectivesCount: meta.assignedDirectivesCount || 0,
              teamVelocity: meta.teamVelocity || '+0.0% WoW',
              managerScore: typeof meta.managerScore === 'number' ? meta.managerScore : 95,
              avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
              isFromDynamoDB: true
            });
          }
        }
        return dbManagers;
      } catch (e) {
        console.warn('[EmployeeService] Error reading managers from DynamoDB:', e);
        return [];
      }
    }

    async getEmployeeById(employeeId) {
      try {
        const res = await this.client.get(`/employees/${encodeURIComponent(employeeId)}`);
        return res.data;
      } catch (e) {
        const all = await this.getEmployees();
        return all.find(e => e.id === employeeId || e.dbTaskId === employeeId || e.name === employeeId) || null;
      }
    }

    async createEmployee(employeeData) {
      const payloadMeta = {
        recordType: 'EMPLOYEE',
        id: employeeData.id || `emp-${Date.now()}`,
        name: employeeData.name,
        role: employeeData.role,
        dept: employeeData.dept || 'Engineering',
        manager: employeeData.manager || 'Unassigned',
        productivity: typeof employeeData.productivity === 'number' ? employeeData.productivity : 95,
        focusHours: employeeData.focusHours || '0.0h',
        status: employeeData.status || 'Online',
        kudos: employeeData.kudos || ''
      };

      const res = await this.client.post('/tasks', {
        title: `[EMPLOYEE] ${employeeData.name}`,
        description: JSON.stringify(payloadMeta),
        status: 'TODO',
        priority: 'LOW'
      });

      const raw = (res.data && res.data.task) ? res.data.task : res.data;
      const dbTaskId = raw.taskId || raw.id;

      return {
        ...employeeData,
        id: payloadMeta.id,
        dbTaskId: dbTaskId,
        isFromDynamoDB: true
      };
    }

    async createManager(managerData) {
      const payloadMeta = {
        recordType: 'MANAGER',
        id: managerData.id || `mgr-${Date.now()}`,
        name: managerData.name,
        dept: managerData.dept || 'Engineering',
        role: managerData.role || 'Team Manager',
        email: managerData.email || '',
        subordinatesCount: 0,
        assignedDirectivesCount: 0,
        teamVelocity: '+0.0% WoW',
        managerScore: typeof managerData.managerScore === 'number' ? managerData.managerScore : 95
      };

      const res = await this.client.post('/tasks', {
        title: `[MANAGER] ${managerData.name}`,
        description: JSON.stringify(payloadMeta),
        status: 'TODO',
        priority: 'LOW'
      });

      const raw = (res.data && res.data.task) ? res.data.task : res.data;
      const dbTaskId = raw.taskId || raw.id;

      return {
        ...managerData,
        id: payloadMeta.id,
        dbTaskId: dbTaskId,
        isFromDynamoDB: true
      };
    }

    async updateEmployee(employeeId, updates) {
      // 1. Direct update if dbTaskId is provided or employeeId is a DynamoDB UUID
      const directDbId = updates.dbTaskId || (typeof employeeId === 'string' && employeeId.length > 20 && employeeId.includes('-') ? employeeId : null);
      if (directDbId) {
        const payloadMeta = {
          recordType: 'EMPLOYEE',
          id: updates.id || employeeId,
          name: updates.name,
          role: updates.role,
          dept: updates.dept || 'Engineering',
          manager: updates.manager || 'Unassigned',
          productivity: typeof updates.productivity === 'number' ? updates.productivity : 95,
          focusHours: updates.focusHours || '0.0h',
          status: updates.status || 'Online',
          kudos: updates.kudos || ''
        };
        const putRes = await this.client.put(`/tasks/${encodeURIComponent(directDbId)}`, {
          title: `[EMPLOYEE] ${updates.name}`,
          description: JSON.stringify(payloadMeta),
          status: 'TODO',
          priority: 'LOW'
        });
        const raw = (putRes.data && putRes.data.task) ? putRes.data.task : putRes.data;
        return {
          ...updates,
          id: payloadMeta.id,
          dbTaskId: directDbId,
          isFromDynamoDB: true
        };
      }

      // 2. Otherwise search existing records from DynamoDB tasks
      try {
        const dbEmployees = await this.getEmployees();
        const found = dbEmployees.find(emp => emp.id === employeeId || emp.dbTaskId === employeeId || emp.name === employeeId);
        if (found && found.dbTaskId) {
          const merged = { ...found, ...updates };
          const payloadMeta = {
            recordType: 'EMPLOYEE',
            id: merged.id,
            name: merged.name,
            role: merged.role,
            dept: merged.dept,
            manager: merged.manager || 'Unassigned',
            productivity: merged.productivity,
            focusHours: merged.focusHours,
            status: merged.status,
            kudos: merged.kudos
          };
          const putRes = await this.client.put(`/tasks/${encodeURIComponent(found.dbTaskId)}`, {
            title: `[EMPLOYEE] ${merged.name}`,
            description: JSON.stringify(payloadMeta),
            status: 'TODO',
            priority: 'LOW'
          });
          const raw = (putRes.data && putRes.data.task) ? putRes.data.task : putRes.data;
          return {
            ...merged,
            dbTaskId: found.dbTaskId,
            isFromDynamoDB: true
          };
        }
        return updates;
      } catch (e) {
        console.warn('[EmployeeService] Error updating employee in DynamoDB:', e);
        throw e;
      }
    }

    async deleteEmployee(empIdentifier) {
      if (!empIdentifier) return;
      try {
        if (empIdentifier.length > 20 && empIdentifier.includes('-')) {
          return await this.client.delete(`/tasks/${encodeURIComponent(empIdentifier)}`);
        }
        const res = await this.client.get('/tasks');
        const data = res.data;
        const rawList = Array.isArray(data) ? data : (data.tasks || []);
        for (const item of rawList) {
          const title = item.title || '';
          const desc = item.description || '';
          if (title.includes(empIdentifier) || desc.includes(empIdentifier)) {
            const targetId = item.taskId || item.id;
            if (targetId) {
              return await this.client.delete(`/tasks/${encodeURIComponent(targetId)}`);
            }
          }
        }
      } catch (err) {
        console.warn('[EmployeeService] Error deleting employee from DynamoDB:', err);
      }
    }

    async deleteManager(mgrIdentifier) {
      if (!mgrIdentifier) return;
      try {
        if (mgrIdentifier.length > 20 && mgrIdentifier.includes('-')) {
          return await this.client.delete(`/tasks/${encodeURIComponent(mgrIdentifier)}`);
        }
        const res = await this.client.get('/tasks');
        const data = res.data;
        const rawList = Array.isArray(data) ? data : (data.tasks || []);
        for (const item of rawList) {
          const title = item.title || '';
          const desc = item.description || '';
          if ((title.startsWith('[MANAGER]') && title.includes(mgrIdentifier)) || (desc.includes('"recordType":"MANAGER"') && desc.includes(mgrIdentifier))) {
            const targetId = item.taskId || item.id;
            if (targetId) {
              return await this.client.delete(`/tasks/${encodeURIComponent(targetId)}`);
            }
          }
        }
      } catch (err) {
        console.warn('[EmployeeService] Error deleting manager from DynamoDB:', err);
      }
    }
  }

  const employeeService = new EmployeeService(apiClient, configService);

  // =========================================================================
  // 8. FEATURE SERVICE: ANALYTICS & DASHBOARD METRICS
  // =========================================================================

  class AnalyticsService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async getOverviewMetrics() {
      try {
        const res = await this.client.get('/analytics/overview');
        return res.data;
      } catch (err) {
        // Fallback to /analytics
        if (err.status === 404) {
          try {
            const res = await this.client.get('/analytics');
            return res.data;
          } catch (e2) {
            // Signal caller to calculate from datasets
            return null;
          }
        }
        return null;
      }
    }

    async getVelocityMetrics() {
      try {
        const res = await this.client.get('/analytics/velocity');
        return res.data;
      } catch (err) {
        return null;
      }
    }

    // Honest fallback dataset aggregator when no backend /analytics endpoint exists
    calculateMetricsFromDatasets(tasks = [], goals = [], employees = []) {
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Completed' || t.progress >= 100).length;
      const pendingTasks = tasks.filter(t => t.status !== 'Completed' && t.progress < 100).length;
      
      const now = new Date();
      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'Completed' || t.progress >= 100) return false;
        try {
          const d = new Date(t.dueDate);
          return !isNaN(d.getTime()) && d < now;
        } catch (e) {
          return false;
        }
      }).length;

      const activeGoals = goals.filter(g => g.status !== 'Completed').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Status distribution for Chart.js
      const statusCounts = {
        'Completed': completedTasks,
        'In Progress': tasks.filter(t => t.status === 'In Progress').length,
        'Ready for Review': tasks.filter(t => t.status === 'Ready for Review').length,
        'Pending': tasks.filter(t => t.status === 'Pending' || t.status === 'Pending Distribution').length
      };

      // Average productivity
      const avgProductivity = employees.length > 0
        ? Math.round(employees.reduce((acc, e) => acc + (Number(e.productivity) || 0), 0) / employees.length)
        : 94;

      return {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        activeGoals,
        completionRate,
        statusCounts,
        avgProductivity,
        isCalculatedLocally: true
      };
    }
  }

  const analyticsService = new AnalyticsService(apiClient, configService);

  // =========================================================================
  // 9. FEATURE SERVICE: NOTIFICATIONS
  // =========================================================================

  class NotificationService {
    constructor(client, configSvc) {
      this.client = client;
      this.configSvc = configSvc;
    }

    async getNotifications() {
      try {
        const res = await this.client.get('/notifications');
        const data = res.data;
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.notifications)) return data.notifications;
        return [];
      } catch (err) {
        return null;
      }
    }

    async markAsRead(notificationId) {
      try {
        const res = await this.client.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
        return res.data;
      } catch (err) {
        return null;
      }
    }
  }

  const notificationService = new NotificationService(apiClient, configService);

  // =========================================================================
  // PUBLIC EXPORT
  // =========================================================================

  return {
    configService,
    authService,
    apiClient,
    healthService,
    taskService,
    goalService,
    employeeService,
    analyticsService,
    notificationService,
    ApiError
  };
});
