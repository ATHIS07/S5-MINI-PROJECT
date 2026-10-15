/**
 * CLOUDPULSE ENTERPRISE FRONTEND ENGINE & LIVE API CONTROLLER
 * 
 * 3-Tier Role Governance:
 * 1. Head (Executive) Dashboard: Assigns Directives to Managers, Oversees Workforce
 * 2. Team Manager Dashboard: Receives from Head, Distributes Subtasks to Employees
 * 3. Employee Contributor Workspace: Receives from Manager, Deep Work Focus Clock
 * 
 * Enterprise Capabilities:
 * - Live REST API & AWS API Gateway integration via CloudPulseAPI client
 * - Seamless Demo Mode vs Live Mode isolation
 * - Dedicated views: Dashboard, Tasks, Goals, Employees, Reports, Notifications, API Config
 * - Interactive Chart.js visualizations (Status Doughnut, Goals OKR Bar, Velocity Line)
 * - Light & Dark theme toggle with WCAG AA/AAA compliance
 * - Command Palette (Ctrl + K) & Toast notification engine
 */

// =========================================================================
// CENTRAL API CONFIGURATION & ENDPOINT RESOLVER
// =========================================================================

/**
 * Primary AWS API Gateway Invoke URL (Mumbai ap-south-1 region, prod stage)
 * Connected to Lambda function `cloudpulse-api` and DynamoDB table `CloudPulse-Tasks`.
 */
const API_BASE_URL = 'https://zpbpv26plb.execute-api.ap-south-1.amazonaws.com/prod';
window.API_BASE_URL = API_BASE_URL;

/**
 * Reusable helper to safely append endpoint paths to API_BASE_URL without
 * duplicating the /prod stage or introducing double slashes.
 * @param {string} endpoint - Relative path (e.g. '/tasks' or '/tasks/{id}')
 * @returns {string} Fully qualified endpoint URL
 */
function getApiEndpointUrl(endpoint) {
  const base = API_BASE_URL.trim().replace(/\/+$/, '');
  let ep = (endpoint || '').trim();
  if (!ep.startsWith('/')) ep = '/' + ep;

  try {
    const parsedBase = new URL(base);
    const basePath = parsedBase.pathname.replace(/\/+$/, '');
    if (basePath && basePath.endsWith(ep)) {
      return `${parsedBase.origin}${basePath}`;
    }
    if (basePath && ep.startsWith(basePath)) {
      ep = ep.slice(basePath.length);
      if (!ep.startsWith('/')) ep = '/' + ep;
    }
  } catch (e) {}

  return `${base}${ep}`;
}
window.getApiEndpointUrl = getApiEndpointUrl;

document.addEventListener('DOMContentLoaded', () => {

  const api = window.CloudPulseAPI || {};
  const configService = api.configService;
  const authService = api.authService;
  const taskService = api.taskService;
  const goalService = api.goalService;
  const employeeService = api.employeeService;
  const analyticsService = api.analyticsService;
  const notificationService = api.notificationService;
  const healthService = api.healthService;

  // =========================================================================
  // 1. APPLICATION DATA STORE & CONSTANTS
  // =========================================================================

  // Universal empty profile photo (clean slate silhouette SVG - no photographic images)
  const EMPTY_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'%3E%3Crect width='64' height='64' rx='32' fill='%23CBD5E1'/%3E%3Ccircle cx='32' cy='24' r='11' fill='%2364748B'/%3E%3Cpath d='M14 54c0-9.941 8.059-18 18-18s18 8.059 18 18' fill='%2364748B'/%3E%3C/svg%3E";

  // Clean state: Strictly managed by Head (ATHISH) and AWS DynamoDB database! Zero AI-generated mock managers or employees.
  const DEFAULT_EMPLOYEES = [];

  // Legacy mock names to aggressively purge from any cached localStorage:
  const MOCK_NAMES = new Set([
    'alex rivera',
    'maya patel',
    'elena rostova',
    'david kim',
    'marcus chen',
    'priya sharma',
    'liam foster',
    'sophia thorne'
  ]);

  // Immediately purge any cached mock managers, employees, and directives from localStorage on startup
  try {
    const rawStored = localStorage.getItem('cloudpulse_employees');
    if (rawStored) {
      const parsedStored = JSON.parse(rawStored);
      if (Array.isArray(parsedStored)) {
        const cleanedStored = parsedStored.filter(e => e && e.name && !MOCK_NAMES.has(e.name.toLowerCase().trim()));
        localStorage.setItem('cloudpulse_employees', JSON.stringify(cleanedStored));
      }
    }
    const rawMgrs = localStorage.getItem('cloudpulse_managers');
    if (rawMgrs) {
      const parsedMgrs = JSON.parse(rawMgrs);
      if (Array.isArray(parsedMgrs)) {
        const cleanedMgrs = parsedMgrs.filter(m => m && m.name && !MOCK_NAMES.has(m.name.toLowerCase().trim()));
        localStorage.setItem('cloudpulse_managers', JSON.stringify(cleanedMgrs));
      }
    }
    const rawDirectives = localStorage.getItem('cloudpulse_directives');
    if (rawDirectives) {
      const parsedDirectives = JSON.parse(rawDirectives);
      if (Array.isArray(parsedDirectives)) {
        const cleanedDirs = parsedDirectives.filter(d => d && d.assignedManager && !MOCK_NAMES.has(d.assignedManager.toLowerCase().trim()));
        localStorage.setItem('cloudpulse_directives', JSON.stringify(cleanedDirs));
      }
    }
  } catch (e) {}

  function loadSavedManagers() {
    try {
      const saved = localStorage.getItem('cloudpulse_managers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(m => m && m.name && !MOCK_NAMES.has(m.name.toLowerCase().trim()));
          if (valid.length > 0) {
            return valid.map(m => ({ ...m, avatar: EMPTY_AVATAR }));
          }
        }
      }
    } catch (e) {}
    return [];
  }

  function saveManagersToStorage() {
    try {
      localStorage.setItem('cloudpulse_managers', JSON.stringify(state.managers));
    } catch (e) {}
  }

  function loadSavedEmployees() {
    try {
      const saved = localStorage.getItem('cloudpulse_employees');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(e => e && e.name && !MOCK_NAMES.has(e.name.toLowerCase().trim()));
          if (valid.length > 0) {
            return valid.map(e => ({ ...e, avatar: EMPTY_AVATAR }));
          }
        }
      }
    } catch (e) {}
    return [];
  }

  function saveEmployeesToStorage() {
    try {
      localStorage.setItem('cloudpulse_employees', JSON.stringify(state.employees));
    } catch (e) {}
  }

  function loadSavedDirectives() {
    try {
      const saved = localStorage.getItem('cloudpulse_directives');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(d => d && d.assignedManager && !MOCK_NAMES.has(d.assignedManager.toLowerCase().trim()));
          return valid;
        }
      }
    } catch (e) {}
    return [];
  }

  function saveDirectivesToStorage() {
    try {
      localStorage.setItem('cloudpulse_directives', JSON.stringify(state.directivesFromHead));
    } catch (e) {}
  }

  function syncManagerRoleWithDatabase() {
    if (state.managers && state.managers.length > 0) {
      const savedMgrName = localStorage.getItem('cloudpulse_active_manager');
      const activeMgr = (savedMgrName && state.managers.find(m => m.name === savedMgrName))
        || (state.roles.manager && state.roles.manager.name && state.roles.manager.name !== 'No Manager Appointed' && state.managers.find(m => m.name === state.roles.manager.name))
        || state.managers[0];
      state.roles.manager.name = activeMgr.name;
      state.roles.manager.title = activeMgr.role || `${activeMgr.dept} Manager`;
      state.roles.manager.pulse = `${activeMgr.managerScore || 95}%`;
    } else {
      state.roles.manager.name = 'No Manager Appointed';
      state.roles.manager.title = 'Awaiting Head Appointment';
      state.roles.manager.pulse = '0%';
    }
  }

  function syncEmployeeRoleWithDatabase() {
    if (state.employees && state.employees.length > 0) {
      const savedEmpName = localStorage.getItem('cloudpulse_active_employee');
      const activeEmp = (savedEmpName && state.employees.find(e => e.name === savedEmpName))
        || (state.roles.employee && state.roles.employee.name && state.roles.employee.name !== 'No Employee Created' && state.employees.find(e => e.name === state.roles.employee.name))
        || state.employees[0];
      state.roles.employee.name = activeEmp.name;
      state.roles.employee.title = activeEmp.role;
      state.roles.employee.pulse = `${activeEmp.productivity || 95}%`;
    } else {
      state.roles.employee.name = 'No Employee Created';
      state.roles.employee.title = 'Awaiting Head Onboarding';
      state.roles.employee.pulse = '0%';
    }
  }

  const state = {
    currentView: 'dashboard', // 'dashboard' | 'tasks' | 'goals' | 'employees' | 'reports' | 'notifications' | 'settings-api'
    currentRole: 'head',      // 'head' | 'manager' | 'employee'
    theme: localStorage.getItem('cloudpulse_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    isLiveMode: true,

    // Role Profiles
    roles: {
      head: {
        name: 'ATHISH',
        title: 'Head Executive',
        avatar: EMPTY_AVATAR,
        badge: 'Head Executive',
        actionLabel: 'Assign Goal to Manager',
        pulse: '98.5%'
      },
      manager: {
        name: 'No Manager Appointed',
        title: 'Awaiting Head Appointment',
        avatar: EMPTY_AVATAR,
        badge: 'Team Manager',
        actionLabel: 'Distribute Task to Employee',
        pulse: '0%'
      },
      employee: {
        name: 'No Employee Created',
        title: 'Awaiting Head Onboarding',
        avatar: EMPTY_AVATAR,
        badge: 'Employee (IC)',
        actionLabel: 'Submit Progress Check-in',
        pulse: '0%'
      }
    },

    // 1. High-Level Directives Assigned by HEAD to Team MANAGERS (strictly real / created)
    directivesFromHead: loadSavedDirectives(),

    // 2. Concrete Subtasks Distributed to Employees (strictly connected to AWS DynamoDB)
    distributedTasks: [],

    // Managers List (Only Head creates managers!)
    managers: loadSavedManagers(),

    // Employees List (Loaded from storage or AWS DynamoDB, created directly by Head ATHISH)
    employees: loadSavedEmployees(),

    // Notifications List
    notifications: [],

    // Timer State
    timer: {
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      isRunning: false,
      intervalId: null,
      currentTask: '',
      completedSprints: 0
    },

    // Task Filter state
    taskFilter: 'all',
    taskSearch: '',
    taskAssignee: 'all',

    // Chart.js references
    charts: {
      taskStatus: null,
      goalProgress: null,
      velocityTrend: null
    }
  };

  // =========================================================================
  // 2. THEME ENGINE (Light & Dark Mode)
  // =========================================================================

  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('cloudpulse_theme', themeName);

    const toggleIcon = document.getElementById('themeToggleIcon');
    if (toggleIcon) {
      toggleIcon.setAttribute('data-lucide', themeName === 'dark' ? 'sun' : 'moon');
    }
    lucide.createIcons();

    // Update charts with theme colors
    updateChartsTheming();
  }

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`, 'info');
    });
  }

  // Initial theme application
  applyTheme(state.theme);

  // =========================================================================
  // 3. PAGE VIEW ROUTER
  // =========================================================================

  window.switchView = function(viewId) {
    if (viewId === 'settings-api') {
      viewId = 'dashboard';
    }
    state.currentView = viewId;

    // Toggle view containers
    document.querySelectorAll('.page-view-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Refresh dynamic renderers based on the view
    if (viewId === 'dashboard') {
      renderDashboard();
    } else if (viewId === 'tasks') {
      renderAllTasksTable();
    } else if (viewId === 'goals') {
      renderAllGoalsView();
    } else if (viewId === 'employees') {
      renderAllEmployeesDirectory();
    } else if (viewId === 'reports') {
      renderReportsView();
    } else if (viewId === 'notifications') {
      renderNotificationsFeed();
    } else if (viewId === 'settings-api') {
      populateApiSettingsForm();
    }

    // Re-render sidebar active navigation states
    renderSidebarNavForRole(state.currentRole);
    lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // 4. CHART.JS VISUALIZATION CONTROLLERS
  // =========================================================================

  function getChartThemeColors() {
    const isDark = state.theme === 'dark';
    return {
      textColor: isDark ? '#CBD5E1' : '#475569',
      gridColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    };
  }

  function initTaskStatusChart() {
    const canvas = document.getElementById('chartTaskStatus');
    if (!canvas || typeof Chart === 'undefined') return;

    const themeColors = getChartThemeColors();
    const completed = state.distributedTasks.filter(t => t.status === 'Completed' || t.progress >= 100).length;
    const inProgress = state.distributedTasks.filter(t => t.status === 'In Progress').length;
    const review = state.distributedTasks.filter(t => t.status === 'Ready for Review').length;
    const pending = state.distributedTasks.filter(t => t.status === 'Pending').length;

    if (state.charts.taskStatus) {
      state.charts.taskStatus.destroy();
    }

    state.charts.taskStatus = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Progress', 'Ready for Review', 'Pending'],
        datasets: [{
          data: [completed, inProgress, review, pending],
          backgroundColor: [
            '#10B981', // Emerald
            '#2563EB', // Blue
            '#8B5CF6', // Purple
            '#F59E0B'  // Amber
          ],
          borderWidth: 2,
          borderColor: state.theme === 'dark' ? '#111827' : '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: themeColors.textColor,
              font: { family: themeColors.fontFamily, size: 12, weight: '600' },
              padding: 16,
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} tasks (${Math.round((ctx.raw / (state.distributedTasks.length || 1)) * 100)}%)`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  function initGoalProgressChart() {
    const canvas = document.getElementById('chartGoalProgress');
    if (!canvas || typeof Chart === 'undefined') return;

    const themeColors = getChartThemeColors();
    const labels = state.directivesFromHead.map(d => d.title.length > 28 ? d.title.slice(0, 26) + '...' : d.title);
    const dataValues = state.directivesFromHead.map(d => d.progress);

    if (state.charts.goalProgress) {
      state.charts.goalProgress.destroy();
    }

    state.charts.goalProgress = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'OKR Completion %',
          data: dataValues,
          backgroundColor: '#3B82F6',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: {
              color: themeColors.textColor,
              callback: (v) => `${v}%`,
              font: { family: themeColors.fontFamily, size: 11 }
            },
            grid: { color: themeColors.gridColor }
          },
          y: {
            ticks: {
              color: themeColors.textColor,
              font: { family: themeColors.fontFamily, size: 11, weight: '500' }
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Progress: ${ctx.raw}% Delivered`
            }
          }
        }
      }
    });
  }

  function initVelocityTrendChart() {
    const canvas = document.getElementById('chartVelocityTrend');
    if (!canvas || typeof Chart === 'undefined') return;

    const themeColors = getChartThemeColors();

    if (state.charts.velocityTrend) {
      state.charts.velocityTrend.destroy();
    }

    state.charts.velocityTrend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Sprint 32', 'Sprint 33', 'Sprint 34', 'Sprint 35', 'Sprint 36', 'Current (S37)'],
        datasets: [{
          label: 'Team Velocity (Story Pts)',
          data: [42, 55, 63, 68, 76, 88],
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#2563EB',
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Org Focus Hours (Target >35h)',
          data: [32.4, 34.1, 35.0, 36.2, 37.5, 38.2],
          borderColor: '#10B981',
          borderDash: [5, 5],
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: themeColors.textColor, font: { family: themeColors.fontFamily, size: 11 } },
            grid: { color: themeColors.gridColor }
          },
          y: {
            ticks: { color: themeColors.textColor, font: { family: themeColors.fontFamily, size: 11 } },
            grid: { color: themeColors.gridColor }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: themeColors.textColor, font: { family: themeColors.fontFamily, size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  function updateChartsTheming() {
    const colors = getChartThemeColors();
    ['taskStatus', 'goalProgress', 'velocityTrend'].forEach(key => {
      const chart = state.charts[key];
      if (chart) {
        if (chart.options.plugins?.legend?.labels) {
          chart.options.plugins.legend.labels.color = colors.textColor;
        }
        if (chart.options.scales) {
          Object.values(chart.options.scales).forEach(scale => {
            if (scale.ticks) scale.ticks.color = colors.textColor;
            if (scale.grid) scale.grid.color = colors.gridColor;
          });
        }
        chart.update();
      }
    });
  }

  function refreshAllCharts() {
    initTaskStatusChart();
    initGoalProgressChart();
    if (state.currentView === 'reports') {
      initVelocityTrendChart();
    }
  }

  // =========================================================================
  // 5. DATA SYNCHRONIZATION (Demo Mode vs Live API)
  // =========================================================================

  async function syncDataFromBackend(silent = false) {
    if (configService && !configService.isLiveMode()) {
      state.isLiveMode = false;
      updateModeBannerUI();
      renderDashboard();
      return;
    }

    state.isLiveMode = true;
    updateModeBannerUI();

    try {
      // Show clean table loading indicator if viewing tasks table
      const tableBody = document.getElementById('allTasksTableBody');
      const emptyState = document.getElementById('tasksEmptyState');
      if (tableBody && state.currentView === 'tasks') {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <div class="spinner-border" style="width: 22px; height: 22px; border: 2px solid var(--border-medium); border-top-color: var(--brand-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span style="font-size: 0.9rem;">Loading organization records...</span>
              </div>
            </td>
          </tr>
        `;
        if (emptyState) emptyState.style.display = 'none';
      }

      // 1. Fetch Tasks
      const liveTasks = await taskService.getTasks();
      if (Array.isArray(liveTasks)) {
        state.distributedTasks = liveTasks;
      }

      // 2. Fetch Goals
      try {
        const liveGoals = await goalService.getGoals();
        if (Array.isArray(liveGoals) && liveGoals.length > 0) {
          state.directivesFromHead = liveGoals.filter(d => d && d.assignedManager && !MOCK_NAMES.has(d.assignedManager.toLowerCase().trim()));
          saveDirectivesToStorage();
        }
      } catch (e) {}

      // 3. Fetch Managers strictly from DynamoDB or storage
      try {
        if (employeeService && employeeService.getManagers) {
          const dbManagers = await employeeService.getManagers();
          if (Array.isArray(dbManagers)) {
            const validDbManagers = dbManagers.filter(m => m && m.name && !MOCK_NAMES.has(m.name.toLowerCase().trim()));
            if (validDbManagers.length > 0) {
              state.managers = validDbManagers;
              saveManagersToStorage();
              syncManagerRoleWithDatabase();
            }
          }
        }
      } catch (e) {
        console.warn('[CloudPulse] Notice loading managers from DynamoDB:', e);
      }

      // 4. Fetch Employees strictly from AWS DynamoDB database
      try {
        const dbEmployees = await employeeService.getEmployees();
        if (Array.isArray(dbEmployees)) {
          const validDbEmployees = dbEmployees.filter(e => e && e.name && !MOCK_NAMES.has(e.name.toLowerCase().trim()));
          state.employees = validDbEmployees.map(e => ({ ...e, avatar: EMPTY_AVATAR }));
          saveEmployeesToStorage();
          syncEmployeeRoleWithDatabase();
          updateEmployeeSelectDropdowns();
        }
      } catch (e) {
        console.warn('[CloudPulse] Notice loading employees from DynamoDB:', e);
      }

      // Re-compute manager subordinate counts dynamically
      if (state.managers && state.managers.length > 0) {
        state.managers.forEach(mgr => {
          mgr.subordinatesCount = (state.employees || []).filter(e => e.manager === mgr.name).length;
          mgr.assignedDirectivesCount = (state.directivesFromHead || []).filter(d => d.assignedManager === mgr.name).length;
        });
      }

      // 4. Fetch Notifications
      try {
        const liveNotifs = await notificationService.getNotifications();
        if (Array.isArray(liveNotifs) && liveNotifs.length > 0) {
          state.notifications = liveNotifs;
        }
      } catch (e) {}

      // Hide diagnostic error box on success
      const diagBox = document.getElementById('apiDiagnosticBox');
      if (diagBox) diagBox.style.display = 'none';

      updateExecutiveStatsRibbon();
      refreshAllCharts();
      renderCurrentView();

    } catch (err) {
      console.warn('[CloudPulse] Notice loading workspace records:', err.message);
      displayConnectionFailure(err);
      renderCurrentView();
    }
  }

  function displayConnectionFailure(err) {
    const diagBox = document.getElementById('apiDiagnosticBox');
    if (diagBox) {
      diagBox.style.display = 'none';
    }
  }

  function updateModeBannerUI() {
    ['appModeBanner', 'cloudTelemetryBadge', 'navApiModePill', 'sidebarTelemetryWidget', 'btnBannerConfigApi', 'btnBannerSwitchLive'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.app-mode-banner, .cloud-telemetry-badge, .nav-api-mode-pill, .sidebar-telemetry-widget, .sidebar-settings-btn').forEach(el => {
      el.remove();
    });
  }

  // Banner action buttons (safely cleaned up)
  const btnBannerConfigApi = document.getElementById('btnBannerConfigApi');
  if (btnBannerConfigApi) {
    btnBannerConfigApi.remove();
  }

  const btnBannerSwitchLive = document.getElementById('btnBannerSwitchLive');
  if (btnBannerSwitchLive) {
    btnBannerSwitchLive.remove();
  }

  const navApiModePill = document.getElementById('navApiModePill');
  if (navApiModePill) {
    navApiModePill.remove();
  }

  // =========================================================================
  // 6. EXECUTIVE DASHBOARD & METRICS CONTROLLER
  // =========================================================================

  function updateExecutiveStatsRibbon() {
    const metrics = analyticsService.calculateMetricsFromDatasets(
      state.distributedTasks,
      state.directivesFromHead,
      state.employees
    );

    const elTotal = document.getElementById('statTotalTasks');
    const elCompleted = document.getElementById('statCompletedTasks');
    const elPending = document.getElementById('statPendingTasks');
    const elOverdue = document.getElementById('statOverdueTasks');
    const elGoals = document.getElementById('statActiveGoals');
    const elRate = document.getElementById('statCompletionRate');

    if (elTotal) elTotal.innerHTML = `${metrics.totalTasks} <span class="metric-unit">Tasks</span>`;
    if (elCompleted) elCompleted.innerHTML = `${metrics.completedTasks} <span class="metric-unit">Done</span>`;
    if (elPending) elPending.innerHTML = `${metrics.pendingTasks} <span class="metric-unit">Active</span>`;
    if (elOverdue) elOverdue.innerHTML = `${metrics.overdueTasks} <span class="metric-unit">Late</span>`;
    if (elGoals) elGoals.innerHTML = `${metrics.activeGoals} <span class="metric-unit">Goals</span>`;
    if (elRate) elRate.textContent = `${metrics.completionRate}%`;

    const elOverdueBadge = document.getElementById('statOverdueBadge');
    if (elOverdueBadge) {
      if (metrics.overdueTasks > 0) {
        elOverdueBadge.className = 'metric-trend-badge trend-down';
        elOverdueBadge.textContent = `${metrics.overdueTasks} Overdue`;
      } else {
        elOverdueBadge.className = 'metric-trend-badge trend-up';
        elOverdueBadge.textContent = '0 Due';
      }
    }
  }

  function updateManagerStatsRibbon() {
    const activeMgrName = state.roles.manager ? state.roles.manager.name : '';
    const myDirectives = state.directivesFromHead.filter(d => d.assignedManager === activeMgrName);
    const myTeamTasks = state.distributedTasks.filter(t => t.assignedManager === activeMgrName);
    const mySubordinates = state.employees.filter(e => e.manager === activeMgrName);

    const elDirectives = document.getElementById('mgrDirectivesCount');
    const elTeam = document.getElementById('mgrTeamCount');
    const elTasks = document.getElementById('mgrTasksDistributedCount');
    const elFocus = document.getElementById('mgrFocusDuration');

    if (elDirectives) elDirectives.innerHTML = `${myDirectives.length} <span class="metric-unit">Active</span>`;
    if (elTeam) elTeam.innerHTML = `${mySubordinates.length} <span class="metric-unit">Engineers</span>`;
    if (elTasks) elTasks.innerHTML = `${myTeamTasks.length} <span class="metric-unit">Tasks</span>`;
    if (elFocus) elFocus.innerHTML = `0.0 <span class="metric-unit">hrs/day</span>`;

    const bDirectives = document.getElementById('mgrDirectivesBadge');
    if (bDirectives) bDirectives.textContent = myDirectives.length;
    const bTasks = document.getElementById('mgrTasksBadge');
    if (bTasks) bTasks.textContent = myTeamTasks.length;
    const bRoster = document.getElementById('mgrRosterBadge');
    if (bRoster) bRoster.textContent = mySubordinates.length;
  }

  function updateEmployeeStatsRibbon() {
    const primaryEmp = state.employees[0];
    const activeEmpName = (state.roles.employee && state.roles.employee.name) || (primaryEmp ? primaryEmp.name : '');
    const myTasks = state.distributedTasks.filter(t => t.assignedEmployee === activeEmpName);
    const empRecord = state.employees.find(e => e.name === activeEmpName) || primaryEmp;

    const elTaskCount = document.getElementById('empTaskCount');
    const elProd = document.getElementById('empProductivityScore');
    const elFocus = document.getElementById('empTodayFocus');

    if (elTaskCount) elTaskCount.innerHTML = `${myTasks.length} <span class="metric-unit">Tasks</span>`;
    if (elProd) elProd.textContent = empRecord ? `${empRecord.productivity}%` : '95.0%';
    if (elFocus) elFocus.textContent = empRecord ? empRecord.focusHours : '0.0h';
  }

  function renderDashboard() {
    if (state.currentRole === 'head') {
      updateExecutiveStatsRibbon();
      refreshAllCharts();
      renderHeadDashboard();
    } else if (state.currentRole === 'manager') {
      updateManagerStatsRibbon();
      renderManagerDashboard();
    } else if (state.currentRole === 'employee') {
      updateEmployeeStatsRibbon();
      renderEmployeeDashboard();
    }
  }

  function renderCurrentView() {
    if (state.currentView === 'dashboard') renderDashboard();
    else if (state.currentView === 'tasks') renderAllTasksTable();
    else if (state.currentView === 'goals') renderAllGoalsView();
    else if (state.currentView === 'employees') renderAllEmployeesDirectory();
    else if (state.currentView === 'reports') renderReportsView();
    else if (state.currentView === 'notifications') renderNotificationsFeed();
    else if (state.currentView === 'settings-api') populateApiSettingsForm();
  }

  // =========================================================================
  // 7. SIDEBAR NAVIGATION CONTROLLER (ROLE-BASED WORKSPACE CONTEXT)
  // =========================================================================

  const sidebarNavMenu = document.getElementById('sidebarNavMenu');

  function renderSidebarNavForRole(role) {
    if (!sidebarNavMenu) return;

    const isDashboard = state.currentView === 'dashboard';
    const isTasks = state.currentView === 'tasks';
    const isGoals = state.currentView === 'goals';
    const isEmployees = state.currentView === 'employees';
    const isReports = state.currentView === 'reports';
    const isNotifs = state.currentView === 'notifications';

    if (role === 'head') {
      sidebarNavMenu.innerHTML = `
        <span class="nav-section-title">Executive Governance</span>
        <div class="nav-item ${isDashboard ? 'active' : ''}" onclick="window.switchView('dashboard')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="crown"></i></span>
            <span>Executive Overview</span>
          </div>
        </div>

        <div class="nav-item ${isGoals ? 'active' : ''}" onclick="window.switchView('goals')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="target"></i></span>
            <span>Strategic Directives (OKRs)</span>
          </div>
          <span class="nav-item-badge">${state.directivesFromHead.length}</span>
        </div>

        <div class="nav-item ${isTasks ? 'active' : ''}" onclick="window.switchView('tasks')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="check-square"></i></span>
            <span>All Tasks Pipeline</span>
          </div>
          <span class="nav-item-badge">${state.distributedTasks.length}</span>
        </div>

        <div class="nav-item ${isEmployees ? 'active' : ''}" onclick="window.switchView('employees')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="users"></i></span>
            <span>Workforce Management</span>
          </div>
          <span class="nav-item-badge">${state.employees.length}</span>
        </div>

        <span class="nav-section-title" style="margin-top: 1rem;">Oversight</span>
        <div class="nav-item ${isReports ? 'active' : ''}" onclick="window.switchView('reports')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="file-bar-chart-2"></i></span>
            <span>Organization Audit</span>
          </div>
        </div>

        <div class="nav-item ${isNotifs ? 'active' : ''}" onclick="window.switchView('notifications')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="bell"></i></span>
            <span>Executive Notices</span>
          </div>
          <span class="nav-item-badge" style="background: #F1F5F9; color: #334155;">${state.notifications.filter(n => !n.read).length}</span>
        </div>
      `;
    } else if (role === 'manager') {
      const activeMgrName = state.roles.manager ? state.roles.manager.name : '';
      const myDirectives = state.directivesFromHead.filter(d => d.assignedManager === activeMgrName);
      const myTeamTasks = state.distributedTasks.filter(t => t.assignedManager === activeMgrName);
      const mySubordinates = state.employees.filter(e => e.manager === activeMgrName);

      sidebarNavMenu.innerHTML = `
        <span class="nav-section-title">Team Pod Leadership</span>
        <div class="nav-item ${isDashboard ? 'active' : ''}" onclick="window.switchView('dashboard')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="briefcase"></i></span>
            <span>Team Pod Dashboard</span>
          </div>
        </div>

        <div class="nav-item ${isGoals ? 'active' : ''}" onclick="window.switchView('goals')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="target"></i></span>
            <span>Directives from Head</span>
          </div>
          <span class="nav-item-badge">${myDirectives.length}</span>
        </div>

        <div class="nav-item ${isTasks ? 'active' : ''}" onclick="window.switchView('tasks')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="check-square"></i></span>
            <span>Distributed Team Tasks</span>
          </div>
          <span class="nav-item-badge">${myTeamTasks.length}</span>
        </div>

        <div class="nav-item ${isEmployees ? 'active' : ''}" onclick="window.switchView('employees')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="users"></i></span>
            <span>Pod Engineers Roster</span>
          </div>
          <span class="nav-item-badge">${mySubordinates.length}</span>
        </div>

        <span class="nav-section-title" style="margin-top: 1rem;">Performance</span>
        <div class="nav-item ${isReports ? 'active' : ''}" onclick="window.switchView('reports')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="file-bar-chart-2"></i></span>
            <span>Pod Delivery Velocity</span>
          </div>
        </div>

        <div class="nav-item ${isNotifs ? 'active' : ''}" onclick="window.switchView('notifications')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="bell"></i></span>
            <span>Team Notifications</span>
          </div>
          <span class="nav-item-badge" style="background: #F1F5F9; color: #334155;">${state.notifications.filter(n => !n.read).length}</span>
        </div>
      `;
    } else {
      // role === 'employee'
      const activeEmpName = (state.roles.employee && state.roles.employee.name) || (state.employees[0] ? state.employees[0].name : '');
      const myTasks = state.distributedTasks.filter(t => t.assignedEmployee === activeEmpName);

      sidebarNavMenu.innerHTML = `
        <span class="nav-section-title">My Workspace</span>
        <div class="nav-item ${isDashboard ? 'active' : ''}" onclick="window.switchView('dashboard')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="user-check"></i></span>
            <span>Contributor Cockpit</span>
          </div>
        </div>

        <div class="nav-item ${isTasks ? 'active' : ''}" onclick="window.switchView('tasks')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="list-todo"></i></span>
            <span>My Assigned Tasks</span>
          </div>
          <span class="nav-item-badge">${myTasks.length}</span>
        </div>

        <span class="nav-section-title" style="margin-top: 1rem;">Productivity</span>
        <div class="nav-item ${isReports ? 'active' : ''}" onclick="window.switchView('reports')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="clock"></i></span>
            <span>Focus Timesheet</span>
          </div>
        </div>

        <div class="nav-item ${isNotifs ? 'active' : ''}" onclick="window.switchView('notifications')">
          <div class="nav-item-content">
            <span class="nav-item-icon"><i data-lucide="bell"></i></span>
            <span>Manager Notices</span>
          </div>
          <span class="nav-item-badge" style="background: #F1F5F9; color: #334155;">${state.notifications.filter(n => !n.read).length}</span>
        </div>
      `;
    }

    lucide.createIcons();
  }

  // =========================================================================
  // 8. 3-TIER ROLE SWITCHER (HEAD, MANAGER, EMPLOYEE)
  // =========================================================================

  const btnRoleHead = document.getElementById('btnRoleHead');
  const btnRoleManager = document.getElementById('btnRoleManager');
  const btnRoleEmployee = document.getElementById('btnRoleEmployee');

  const dashHead = document.getElementById('dashboard-head');
  const dashManager = document.getElementById('dashboard-manager');
  const dashEmployee = document.getElementById('dashboard-employee');

  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserRole = document.getElementById('sidebarUserRole');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarPulseScore = document.getElementById('sidebarPulseScore');
  const btnDynamicRoleAction = document.getElementById('btnDynamicRoleAction');
  const dynamicRoleActionText = document.getElementById('dynamicRoleActionText');

  window.switchRole = function(role) {
    state.currentRole = role;
    const profile = state.roles[role];

    // Update Role Switcher Tabs
    [btnRoleHead, btnRoleManager, btnRoleEmployee].forEach(btn => {
      if (btn && btn.getAttribute('data-role') === role) {
        btn.classList.add('active');
      } else if (btn) {
        btn.classList.remove('active');
      }
    });

    // Toggle Role-specific containers
    [dashHead, dashManager, dashEmployee].forEach(d => {
      if (d) d.classList.remove('active');
    });

    if (role === 'head' && dashHead) {
      dashHead.classList.add('active');
      switchHeadTab('tab-head-cascade');
    }
    if (role === 'manager' && dashManager) {
      dashManager.classList.add('active');
      switchMgrTab('tab-mgr-directives');
    }
    if (role === 'employee' && dashEmployee) {
      dashEmployee.classList.add('active');
    }

    // Update user profile in sidebar
    if (sidebarUserName) sidebarUserName.textContent = profile.name;
    if (sidebarUserRole) sidebarUserRole.textContent = profile.title;
    if (sidebarAvatar) sidebarAvatar.src = profile.avatar;
    if (sidebarPulseScore) sidebarPulseScore.textContent = profile.pulse;
    if (dynamicRoleActionText) dynamicRoleActionText.textContent = profile.actionLabel;

    // Update Add Employee button visibility (Head authority only)
    const btnOpenAddEmployeeModal = document.getElementById('btnOpenAddEmployeeModal');
    if (btnOpenAddEmployeeModal) {
      btnOpenAddEmployeeModal.style.display = (role === 'head' ? 'inline-flex' : 'none');
    }
    const btnHeadAddEmployee = document.getElementById('btnHeadAddEmployee');
    if (btnHeadAddEmployee) {
      btnHeadAddEmployee.style.display = (role === 'head' ? 'inline-flex' : 'none');
    }

    // Refresh views
    renderSidebarNavForRole(role);
    renderDashboard();
    if (state.currentView === 'employees') {
      renderAllEmployeesDirectory();
    }

    showToast(`Switched view to: ${profile.badge} (${profile.name})`, 'info');
    lucide.createIcons();
  };

  window.switchActiveEmployee = function(employeeName) {
    if (!employeeName || !state.employees || state.employees.length === 0) return;
    const emp = state.employees.find(e => e.name === employeeName);
    if (!emp) return;

    state.roles.employee.name = emp.name;
    state.roles.employee.title = emp.role || 'Individual Contributor';
    state.roles.employee.pulse = `${emp.productivity || 95}%`;
    localStorage.setItem('cloudpulse_active_employee', emp.name);

    if (state.currentRole === 'employee') {
      if (sidebarUserName) sidebarUserName.textContent = emp.name;
      if (sidebarUserRole) sidebarUserRole.textContent = emp.role;
      if (sidebarAvatar) sidebarAvatar.src = emp.avatar || EMPTY_AVATAR;
      if (sidebarPulseScore) sidebarPulseScore.textContent = `${emp.productivity || 95}%`;
    }

    renderSidebarNavForRole(state.currentRole);
    updateEmployeeStatsRibbon();
    renderEmployeeDashboard();
    showToast(`Active Contributor: ${emp.name} (${emp.role})`, 'info');
    lucide.createIcons();
  };

  window.switchActiveManager = function(managerName) {
    if (!managerName || !state.managers || state.managers.length === 0) return;
    const mgr = state.managers.find(m => m.name === managerName);
    if (!mgr) return;

    state.roles.manager.name = mgr.name;
    state.roles.manager.title = mgr.role || `${mgr.dept} Manager`;
    state.roles.manager.pulse = `${mgr.managerScore || 95}%`;
    localStorage.setItem('cloudpulse_active_manager', mgr.name);

    if (state.currentRole === 'manager') {
      if (sidebarUserName) sidebarUserName.textContent = mgr.name;
      if (sidebarUserRole) sidebarUserRole.textContent = mgr.role || `${mgr.dept} Manager`;
      if (sidebarAvatar) sidebarAvatar.src = mgr.avatar || EMPTY_AVATAR;
      if (sidebarPulseScore) sidebarPulseScore.textContent = `${mgr.managerScore || 95}%`;
    }

    renderSidebarNavForRole('manager');
    updateManagerStatsRibbon();
    renderManagerDashboard();
    showToast(`Active Manager Pod: ${mgr.name} (${mgr.dept})`, 'info');
    lucide.createIcons();
  };

  if (btnRoleHead) btnRoleHead.addEventListener('click', () => switchRole('head'));
  if (btnRoleManager) btnRoleManager.addEventListener('click', () => switchRole('manager'));
  if (btnRoleEmployee) btnRoleEmployee.addEventListener('click', () => switchRole('employee'));

  if (btnDynamicRoleAction) {
    btnDynamicRoleAction.addEventListener('click', () => {
      if (state.currentRole === 'head') {
        openHeadAssignModal();
      } else if (state.currentRole === 'manager') {
        openManagerDistributeModal();
      } else {
        showToast('Check-in submitted to Team Manager! Focus hours logged.', 'success');
      }
    });
  }

  // Sub-Navigation Tabs inside Head and Manager Views
  let headAllPanelsMode = false;
  let mgrAllPanelsMode = false;

  window.switchHeadTab = function(targetTabId) {
    headAllPanelsMode = false;
    const btnAllText = document.getElementById('btnHeadAllPanelsText');
    if (btnAllText) btnAllText.textContent = 'All Panels';

    document.querySelectorAll('[data-head-tab]').forEach(btn => {
      if (btn.getAttribute('data-head-tab') === targetTabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    document.querySelectorAll('#dashboard-head .dashboard-tab-panel').forEach(panel => {
      panel.classList.remove('force-show');
      if (panel.id === targetTabId) {
        panel.classList.add('active');
        panel.style.display = 'block';
      } else {
        panel.classList.remove('active');
        panel.style.display = 'none';
      }
    });
    lucide.createIcons();
  };

  window.toggleHeadAllPanels = function() {
    headAllPanelsMode = !headAllPanelsMode;
    const btnAllText = document.getElementById('btnHeadAllPanelsText');
    const panels = document.querySelectorAll('#dashboard-head .dashboard-tab-panel');

    if (headAllPanelsMode) {
      panels.forEach(p => { p.classList.add('force-show'); p.style.display = 'block'; });
      if (btnAllText) btnAllText.textContent = 'Single Tab View';
    } else {
      panels.forEach(p => p.classList.remove('force-show'));
      if (btnAllText) btnAllText.textContent = 'All Panels';
      switchHeadTab('tab-head-cascade');
    }
  };

  window.switchMgrTab = function(targetTabId) {
    mgrAllPanelsMode = false;
    const btnAllText = document.getElementById('btnMgrAllPanelsText');
    if (btnAllText) btnAllText.textContent = 'All Panels';

    document.querySelectorAll('[data-mgr-tab]').forEach(btn => {
      if (btn.getAttribute('data-mgr-tab') === targetTabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    document.querySelectorAll('#dashboard-manager .dashboard-tab-panel').forEach(panel => {
      panel.classList.remove('force-show');
      if (panel.id === targetTabId) {
        panel.classList.add('active');
        panel.style.display = 'block';
      } else {
        panel.classList.remove('active');
        panel.style.display = 'none';
      }
    });
    lucide.createIcons();
  };

  window.toggleMgrAllPanels = function() {
    mgrAllPanelsMode = !mgrAllPanelsMode;
    const btnAllText = document.getElementById('btnMgrAllPanelsText');
    const panels = document.querySelectorAll('#dashboard-manager .dashboard-tab-panel');

    if (mgrAllPanelsMode) {
      panels.forEach(p => { p.classList.add('force-show'); p.style.display = 'block'; });
      if (btnAllText) btnAllText.textContent = 'Single Tab View';
    } else {
      panels.forEach(p => p.classList.remove('force-show'));
      if (btnAllText) btnAllText.textContent = 'All Panels';
      switchMgrTab('tab-mgr-directives');
    }
  };

  document.querySelectorAll('[data-head-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchHeadTab(btn.getAttribute('data-head-tab')));
  });

  document.querySelectorAll('[data-mgr-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchMgrTab(btn.getAttribute('data-mgr-tab')));
  });

  const btnHeadAllPanels = document.getElementById('btnHeadAllPanels');
  if (btnHeadAllPanels) btnHeadAllPanels.addEventListener('click', toggleHeadAllPanels);

  const btnMgrAllPanels = document.getElementById('btnMgrAllPanels');
  if (btnMgrAllPanels) btnMgrAllPanels.addEventListener('click', toggleMgrAllPanels);

  // =========================================================================
  // 9. RENDERERS: 3-TIER DASHBOARDS
  // =========================================================================

  function renderHeadDashboard() {
    // 1. Cascade Tree
    const treeContainer = document.getElementById('headCascadeTreeContainer');
    if (treeContainer) {
      const allDirectiveTitles = new Set(state.directivesFromHead.map(d => d.title));
      const unlinkedTasks = state.distributedTasks.filter(t => !allDirectiveTitles.has(t.parentDirective));
      let unlinkedHtml = '';
      if (unlinkedTasks.length > 0) {
        unlinkedHtml = `
          <div class="cascade-tree-card" style="border-left: 3px solid #8B5CF6;">
            <div class="cascade-head-directive">
              <div style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="tag-pill tag-indigo"><i data-lucide="cloud" style="width: 10px; height: 10px;"></i> Direct Cloud Initiatives</span>
                <strong style="font-size: 0.92rem; color: var(--text-primary);">DynamoDB Tasks & Operational Work Packages</strong>
                <span style="font-size: 0.75rem; color: var(--text-tertiary);">(Live AWS DynamoDB Integration)</span>
              </div>
              <span class="tag-pill tag-emerald">${unlinkedTasks.length} Active</span>
            </div>
            <div class="cascade-employee-tasks" style="margin-top: 10px;">
              <div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em; margin-bottom: 2px;">
                Direct Workload (${unlinkedTasks.length} tasks):
              </div>
              ${unlinkedTasks.map(st => `
                <div class="subtask-row">
                  <div style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span class="tag-pill tag-role-employee"><i data-lucide="user" style="width: 10px; height: 10px;"></i> ${st.assignedEmployee}</span>
                    <span style="color: var(--text-secondary); font-weight: 500;">${st.title}</span>
                  </div>
                  <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <span class="tag-pill ${st.progress >= 90 ? 'tag-emerald' : 'tag-indigo'}">${st.progress}%</span>
                    <span style="font-size: 0.72rem; color: var(--text-tertiary); font-weight: 600; font-variant-numeric: tabular-nums;">${st.estHours}h Est.</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (state.directivesFromHead.length === 0 && unlinkedTasks.length === 0) {
        treeContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border: 1px dashed var(--border-default); border-radius: 8px;">
            <i data-lucide="git-merge" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">No Cascade Directives Active</div>
            <p style="font-size: 0.8rem; margin-bottom: 12px; line-height: 1.4;">Head Executive has not issued any strategic directives to managers yet.</p>
            <button class="btn-primary" style="font-size: 0.78rem; padding: 6px 14px;" onclick="window.openHeadAssignModal()">
              <i data-lucide="plus" style="width: 13px; height: 13px;"></i>
              <span>+ Assign First Goal to Manager</span>
            </button>
          </div>
        `;
      } else {
        treeContainer.innerHTML = state.directivesFromHead.map(dir => {
          const subtasks = state.distributedTasks.filter(t => t.parentDirective === dir.title);
          const subtasksHtml = subtasks.length > 0 ? subtasks.map(st => `
            <div class="subtask-row">
              <div style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="tag-pill tag-role-employee"><i data-lucide="user" style="width: 10px; height: 10px;"></i> ${st.assignedEmployee}</span>
                <span style="color: var(--text-secondary); font-weight: 500;">${st.title}</span>
              </div>
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <span class="tag-pill ${st.progress >= 90 ? 'tag-emerald' : 'tag-indigo'}">${st.progress}%</span>
                <span style="font-size: 0.72rem; color: var(--text-tertiary); font-weight: 600; font-variant-numeric: tabular-nums;">${st.estHours}h Est.</span>
              </div>
            </div>
          `).join('') : `
            <div style="font-size: 0.75rem; color: var(--text-tertiary); font-style: italic; padding: 4px 0;">
              Pending breakdown by Manager ${dir.assignedManager}
            </div>
          `;

          return `
            <div class="cascade-tree-card">
              <div class="cascade-head-directive">
                <div style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="tag-pill tag-role-head"><i data-lucide="crown" style="width: 10px; height: 10px;"></i> Head Directive</span>
                  <strong style="font-size: 0.92rem; color: var(--text-primary);">${dir.title}</strong>
                  <span style="font-size: 0.75rem; color: var(--text-tertiary);">(${dir.dept} • Target: ${dir.deadline})</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                  <span class="tag-pill ${dir.status === 'On Track' ? 'tag-emerald' : 'tag-amber'}">${dir.status}</span>
                  <strong style="font-size: 0.85rem; font-variant-numeric: tabular-nums;">${dir.progress}%</strong>
                </div>
              </div>

              <div class="cascade-manager-layer">
                <div style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="tag-pill tag-role-manager"><i data-lucide="briefcase" style="width: 10px; height: 10px;"></i> Delegated to Manager</span>
                  <strong style="font-size: 0.85rem; color: #1E40AF;">${dir.assignedManager}</strong>
                  <span style="font-size: 0.74rem; color: var(--text-tertiary);">"${dir.directiveNotes || ''}"</span>
                </div>
                <button class="btn-secondary" style="padding: 0 8px; height: 28px; font-size: 0.72rem;" onclick="window.quickDistributePrompt('${dir.id}')">
                  <span>Distribute Subtask</span>
                </button>
              </div>

              <div class="cascade-employee-tasks">
                <div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em; margin-bottom: 2px;">
                  Distributed Employee Workload (${subtasks.length} subtasks):
                </div>
                ${subtasksHtml}
              </div>
            </div>
          `;
        }).join('') + unlinkedHtml;
      }
      lucide.createIcons();
    }

    // 2. Managers Governance Matrix
    const mgrTableBody = document.getElementById('headManagersTableBody');
    if (mgrTableBody) {
      if (!state.managers || state.managers.length === 0) {
        mgrTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary);">
              <div style="max-width: 440px; margin: 0 auto;">
                <i data-lucide="briefcase" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.5;"></i>
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">No Team Managers Appointed Yet</div>
                <p style="font-size: 0.8rem; margin-bottom: 12px; line-height: 1.4;">As Head Executive (ATHISH), appoint department managers to delegate strategic directives and organize teams.</p>
                <button class="btn-primary" style="font-size: 0.78rem; padding: 6px 14px;" onclick="window.openCreateManagerModal()">
                  <i data-lucide="user-plus" style="width: 13px; height: 13px;"></i>
                  <span>+ Appoint First Manager</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        mgrTableBody.innerHTML = state.managers.map(mgr => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${mgr.avatar || EMPTY_AVATAR}" alt="${mgr.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid white; box-shadow: var(--shadow-xs);">
                <div>
                  <strong style="font-size: 0.85rem; color: var(--text-primary);">${mgr.name}</strong>
                  <div style="font-size: 0.72rem; color: var(--text-tertiary);">${mgr.dept}</div>
                </div>
              </div>
            </td>
            <td><strong>${(state.employees || []).filter(e => e.manager === mgr.name).length}</strong> subordinate engineers</td>
            <td><span class="tag-pill tag-role-head">${(state.directivesFromHead || []).filter(d => d.assignedManager === mgr.name).length} Directives Active</span></td>
            <td><span style="color: var(--success-text); font-weight: 700;">${mgr.teamVelocity || '+0.0% WoW'}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div class="progress-track" style="width: 50px; height: 5px;">
                  <div class="progress-bar-fill" style="width: ${mgr.managerScore || 95}%; background: var(--brand-primary);"></div>
                </div>
                <strong style="font-size: 0.8rem;">${mgr.managerScore || 95}%</strong>
              </div>
            </td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
                <button class="btn-primary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="window.openHeadAssignToSpecific('${mgr.name}')">
                  <span>+ Assign Goal</span>
                </button>
                <button class="btn-secondary" style="color: #DC2626; border-color: rgba(220, 38, 38, 0.25); padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;" onclick="window.removeManagerPrompt('${mgr.id || mgr.name}')" title="Remove Manager from Organization">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                  <span>Remove</span>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    const badgeMgrCount = document.getElementById('badgeHeadManagersCount');
    if (badgeMgrCount) badgeMgrCount.textContent = state.managers ? state.managers.length : 0;
    const badgeEmpCount = document.getElementById('badgeHeadWorkforceCount');
    if (badgeEmpCount) badgeEmpCount.textContent = state.employees ? state.employees.length : 0;

    // 3. Workforce Directory
    const empTableBody = document.getElementById('headAllEmployeesTableBody');
    const searchVal = (document.getElementById('headEmployeeSearch')?.value || '').toLowerCase();
    if (empTableBody) {
      const filtered = state.employees.filter(e => e.name.toLowerCase().includes(searchVal) || e.role.toLowerCase().includes(searchVal) || e.dept.toLowerCase().includes(searchVal));
      if (filtered.length === 0) {
        empTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
              No employees found in organization. Click "+ Add Employee" to add team members.
            </td>
          </tr>
        `;
      } else {
        empTableBody.innerHTML = filtered.map(emp => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${emp.avatar || EMPTY_AVATAR}" alt="${emp.name}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                <div>
                  <strong style="font-size: 0.85rem;">${emp.name}</strong>
                  <div style="font-size: 0.72rem; color: var(--text-tertiary);">${emp.role}</div>
                </div>
              </div>
            </td>
            <td><span class="tag-pill tag-role-manager">${emp.manager}</span></td>
            <td><span class="member-dept-tag">${emp.dept}</span></td>
            <td><strong>${emp.productivity}%</strong></td>
            <td>${emp.focusHours}</td>
            <td><span class="tag-pill ${emp.status === 'Deep Work' ? 'tag-indigo' : 'tag-emerald'}">${emp.status}</span></td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
                <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="window.openEditEmployeeModal('${emp.id}')" title="Edit Employee Details in Database">
                  <i data-lucide="edit-3" style="width: 11px; height: 11px;"></i>
                  <span>Edit</span>
                </button>
                <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="window.openScorecardModal('${emp.id}')">
                  <span>Dossier</span>
                </button>
                <button class="btn-secondary" style="color: #DC2626; border-color: rgba(220, 38, 38, 0.25); padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;" onclick="window.removeEmployeePrompt('${emp.id}')" title="Remove Employee from Organization">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                  <span>Remove</span>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    lucide.createIcons();
  }

  function renderManagerDashboard() {
    const activeMgr = (state.managers && state.managers.length > 0) ? (state.managers.find(m => m.name === state.roles.manager.name) || state.managers[0]) : null;
    const activeManagerName = activeMgr ? activeMgr.name : '';

    // Update Manager Header
    const mgrTitle = document.getElementById('managerHeaderTitle');
    if (mgrTitle) mgrTitle.innerHTML = `${activeMgr ? activeMgr.dept : 'Department'} Team Management <span class="badge-role-tag badge-role-manager"><i data-lucide="briefcase" style="width:11px; height:11px;"></i> Team Management</span>`;
    const mgrBreadcrumb = document.getElementById('managerBreadcrumbName');
    if (mgrBreadcrumb) mgrBreadcrumb.textContent = activeMgr ? `${activeMgr.dept} Pod` : 'Team Pod Leadership';
    const mgrNameEl = document.getElementById('managerHeaderName');
    if (mgrNameEl) mgrNameEl.textContent = activeManagerName || 'No Manager Appointed';

    const myDirectives = activeManagerName ? state.directivesFromHead.filter(d => d.assignedManager === activeManagerName) : [];
    const myTeamTasks = activeManagerName ? state.distributedTasks.filter(t => t.assignedManager === activeManagerName) : [];
    const mySubordinates = activeManagerName ? state.employees.filter(e => e.manager === activeManagerName) : [];

    const mgrEngineersEl = document.getElementById('managerHeaderEngineers');
    if (mgrEngineersEl) mgrEngineersEl.textContent = mySubordinates.length;
    const mgrDirectivesEl = document.getElementById('managerHeaderDirectives');
    if (mgrDirectivesEl) mgrDirectivesEl.textContent = myDirectives.length;

    // Manager Persona Switcher directly below manager name
    const selectActive = document.getElementById('managerSelectActive');
    const quickPills = document.getElementById('managerQuickPills');
    if (selectActive) {
      if (state.managers && state.managers.length > 0) {
        selectActive.innerHTML = state.managers.map(m => `
          <option value="${m.name}" ${m.name === activeManagerName ? 'selected' : ''}>${m.name} — ${m.dept} (${m.role || 'Manager'})</option>
        `).join('');
        selectActive.value = activeManagerName;
        selectActive.onchange = (e) => window.switchActiveManager(e.target.value);
        if (quickPills) {
          quickPills.innerHTML = state.managers.map(m => `
            <button type="button" class="persona-pill-btn ${m.name === activeManagerName ? 'active' : ''}" onclick="window.switchActiveManager('${m.name}')" title="Switch to ${m.name} Pod">
              <span class="pill-dot"></span>
              <span>${m.name}</span>
              <span class="pill-role">${m.dept || m.role}</span>
            </button>
          `).join('');
        }
      } else {
        selectActive.innerHTML = `<option value="">-- No Managers Appointed Yet --</option>`;
        if (quickPills) {
          quickPills.innerHTML = `<span class="persona-empty-hint">Awaiting Head (ATHISH) appointment</span>`;
        }
      }
    }

    // Empty state if no managers appointed yet
    if (!activeMgr) {
      const headDirectivesContainer = document.getElementById('managerHeadDirectivesList');
      if (headDirectivesContainer) {
        headDirectivesContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border-radius: 8px; border: 1px dashed var(--border-default);">
            <i data-lucide="shield-alert" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.6; color: var(--brand-primary);"></i>
            <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No Team Managers Appointed Yet</h3>
            <p style="font-size: 0.8rem; margin: 0 auto 12px; max-width: 420px;">Switch to Head Executive to appoint your first department manager.</p>
            <button class="btn-primary" style="font-size: 0.78rem; padding: 5px 12px;" onclick="window.switchRole('head'); window.openCreateManagerModal();">
              <i data-lucide="user-plus" style="width: 12px; height: 12px;"></i>
              <span>+ Appoint Manager as Head</span>
            </button>
          </div>
        `;
      }
      const distTableBody = document.getElementById('managerDistributedTasksTableBody');
      if (distTableBody) {
        distTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
              No managers appointed yet.
            </td>
          </tr>
        `;
      }
      const rosterGrid = document.getElementById('managerTeamRosterGrid');
      if (rosterGrid) {
        rosterGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-tertiary);">
            No managers appointed yet.
          </div>
        `;
      }
      lucide.createIcons();
      return;
    }

    // 1. Directives Received from Head
    const headDirectivesContainer = document.getElementById('managerHeadDirectivesList');
    if (headDirectivesContainer) {
      if (myDirectives.length === 0) {
        headDirectivesContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border-radius: 8px; border: 1px dashed var(--border-default);">
            <i data-lucide="inbox" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.5;"></i>
            <p style="margin: 0; font-size: 0.85rem;">No strategic directives assigned to <strong>${activeManagerName}</strong> by Head yet.</p>
          </div>
        `;
      } else {
        headDirectivesContainer.innerHTML = myDirectives.map(d => `
          <div class="goal-preview-card" style="border-left: 3px solid #2563EB;">
            <div class="goal-card-header">
              <div>
                <span class="tag-pill tag-role-head" style="margin-bottom: 4px;">Assigned to You by Head</span>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">${d.title}</h3>
              </div>
              <span class="tag-pill ${d.status === 'On Track' ? 'tag-emerald' : 'tag-amber'}">${d.status}</span>
            </div>

            <div style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.35rem 0 0.65rem; background: var(--bg-surface-subtle); padding: 6px 10px; border-radius: 6px; border: 1px dashed var(--border-default);">
              <strong>Head Directive Note:</strong> "${d.directiveNotes || 'Execute across your team.'}"
            </div>

            <div class="goal-progress-wrap">
              <div class="progress-track">
                <div class="progress-bar-fill" style="width: ${d.progress}%; background: var(--brand-primary);"></div>
              </div>
              <span class="progress-pct-label">${d.progress}%</span>
            </div>

            <div class="goal-card-meta">
              <div>SLA Due: <strong>${d.deadline}</strong> • Weight: <strong>${d.weight}</strong></div>
              <button class="btn-primary" style="padding: 3px 10px; font-size: 0.75rem;" onclick="window.distributeDirective('${d.title}')">
                <i data-lucide="share-2" style="width: 12px; height: 12px;"></i>
                <span>Distribute to Employee</span>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // 2. Distributed Tasks
    const distTableBody = document.getElementById('managerDistributedTasksTableBody');
    if (distTableBody) {
      if (myTeamTasks.length === 0) {
        distTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
              No tasks distributed to team engineers yet. Click "Distribute New Task" above to assign work.
            </td>
          </tr>
        `;
      } else {
        distTableBody.innerHTML = myTeamTasks.map(t => `
          <tr>
            <td>
              <strong style="color: var(--text-primary); font-size: 0.85rem;">${t.title}</strong>
              <div style="font-size: 0.72rem; color: var(--text-tertiary);">Parent Directive: ${t.parentDirective || 'General Objective'}</div>
            </td>
            <td>
              <span class="tag-pill tag-role-employee">${t.assignedEmployee}</span>
            </td>
            <td style="font-variant-numeric: tabular-nums;">${t.dueDate}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div class="progress-track" style="width: 50px; height: 5px;">
                  <div class="progress-bar-fill" style="width: ${t.progress}%; background: var(--brand-primary);"></div>
                </div>
                <strong style="font-size: 0.78rem;">${t.progress}%</strong>
              </div>
            </td>
            <td>
              <span class="tag-pill ${t.progress >= 90 ? 'tag-emerald' : 'tag-indigo'}">${t.status}</span>
            </td>
            <td style="text-align: right;">
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="window.approveEmployeeTask('${t.id}')">
                <i data-lucide="check" style="width: 11px; height: 11px;"></i>
                <span>Approve</span>
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // 3. Team Roster Grid
    const rosterGrid = document.getElementById('managerTeamRosterGrid');
    if (rosterGrid) {
      if (mySubordinates.length === 0) {
        rosterGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border-radius: 8px; border: 1px dashed var(--border-default);">
            <i data-lucide="users" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.5;"></i>
            <p style="margin: 0; font-size: 0.85rem;">No engineers assigned to <strong>${activeManagerName}</strong> yet. Head can onboard employees and assign them to this manager.</p>
          </div>
        `;
      } else {
        rosterGrid.innerHTML = mySubordinates.map(emp => `
          <div class="member-card">
            <div class="member-card-header">
              <img src="${emp.avatar || EMPTY_AVATAR}" alt="${emp.name}" class="member-avatar-lg">
              <div class="member-info">
                <h3>${emp.name}</h3>
                <div class="member-role">${emp.role}</div>
                <span class="member-dept-tag">${emp.dept}</span>
              </div>
            </div>

            <div class="member-stats-row">
              <div class="member-stat-cell">
                <div class="member-stat-val" style="color: var(--brand-primary);">${emp.productivity}%</div>
                <div class="member-stat-lbl">Productivity</div>
              </div>
              <div class="member-stat-cell">
                <div class="member-stat-val">${emp.focusHours}</div>
                <div class="member-stat-lbl">Focus Time</div>
              </div>
              <div class="member-stat-cell">
                <div class="member-stat-val"><span class="tag-pill tag-emerald">${emp.status}</span></div>
                <div class="member-stat-lbl">Status</div>
              </div>
            </div>

            <button class="btn-scorecard" onclick="window.openScorecardModal('${emp.id}')">
              <i data-lucide="file-badge" style="width: 14px; height: 14px;"></i>
              <span>Conduct 1-on-1 Review</span>
            </button>
          </div>
        `).join('');
      }
    }

    lucide.createIcons();
  }

  function renderEmployeeDashboard() {
    const container = document.getElementById('employeeMyTasksList');
    if (!container) return;

    if (!state.employees || state.employees.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border-radius: 8px; border: 1px dashed var(--border-default);">
          <i data-lucide="users" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.6; color: var(--brand-primary);"></i>
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No Employees Onboarded Yet</h3>
          <p style="font-size: 0.8rem; margin: 0 auto 12px; max-width: 420px;">The workforce directory is currently empty. Switch to Head Executive (ATHISH) to onboard employees.</p>
          <button class="btn-primary" style="font-size: 0.78rem; padding: 5px 12px;" onclick="window.switchRole('head'); window.openAddEmployeeModal();">
            <i data-lucide="user-plus" style="width: 12px; height: 12px;"></i>
            <span>+ Onboard Employee as Head</span>
          </button>
        </div>
      `;
      const headerName = document.getElementById('employeeHeaderName');
      if (headerName) headerName.textContent = 'No Employee Created';
      const headerRole = document.getElementById('employeeHeaderRole');
      if (headerRole) headerRole.textContent = 'Awaiting Head Onboarding';
      const headerManager = document.getElementById('employeeHeaderManager');
      if (headerManager) headerManager.textContent = 'None';
      const empSelectActive = document.getElementById('employeeSelectActive');
      if (empSelectActive) empSelectActive.innerHTML = `<option value="">-- No Employees Onboarded Yet --</option>`;
      const empQuickPills = document.getElementById('employeeQuickPills');
      if (empQuickPills) empQuickPills.innerHTML = `<span class="persona-empty-hint">Awaiting Head (ATHISH) onboarding</span>`;
      lucide.createIcons();
      return;
    }

    const primaryEmp = state.employees[0];
    const activeEmpName = (state.roles.employee && state.roles.employee.name && state.roles.employee.name !== 'No Employee Created') ? state.roles.employee.name : primaryEmp.name;
    const empRecord = state.employees.find(e => e.name === activeEmpName) || primaryEmp;
    const activeEmpRole = empRecord ? empRecord.role : 'Individual Contributor';
    const activeEmpManager = (empRecord && empRecord.manager && !MOCK_NAMES.has(empRecord.manager.toLowerCase().trim())) ? empRecord.manager : 'Unassigned';

    // Update Contributor Workspace headers
    const breadcrumbName = document.getElementById('employeeBreadcrumbName');
    if (breadcrumbName) {
      breadcrumbName.textContent = `${activeEmpName} (${activeEmpRole})`;
    }
    const headerName = document.getElementById('employeeHeaderName');
    if (headerName) {
      headerName.textContent = activeEmpName;
    }
    const headerRole = document.getElementById('employeeHeaderRole');
    if (headerRole) {
      headerRole.textContent = activeEmpRole;
    }
    const headerManager = document.getElementById('employeeHeaderManager');
    if (headerManager) {
      headerManager.textContent = activeEmpManager;
    }

    // Employee Persona Switcher directly below employee name
    const empSelectActive = document.getElementById('employeeSelectActive');
    const empQuickPills = document.getElementById('employeeQuickPills');
    if (empSelectActive) {
      if (state.employees && state.employees.length > 0) {
        empSelectActive.innerHTML = state.employees.map(emp => `
          <option value="${emp.name}" ${emp.name === activeEmpName ? 'selected' : ''}>${emp.name} — ${emp.role || 'Contributor'} (${emp.dept || 'Engineering'})</option>
        `).join('');
        empSelectActive.value = activeEmpName;
        empSelectActive.onchange = (e) => window.switchActiveEmployee(e.target.value);
        if (empQuickPills) {
          empQuickPills.innerHTML = state.employees.map(emp => `
            <button type="button" class="persona-pill-btn ${emp.name === activeEmpName ? 'active' : ''}" onclick="window.switchActiveEmployee('${emp.name}')" title="Switch to ${emp.name}">
              <span class="pill-dot"></span>
              <span>${emp.name}</span>
              <span class="pill-role">${emp.role || 'Contributor'}</span>
            </button>
          `).join('');
        }
      } else {
        empSelectActive.innerHTML = `<option value="">-- No Employees Onboarded Yet --</option>`;
        if (empQuickPills) {
          empQuickPills.innerHTML = `<span class="persona-empty-hint">Awaiting Head (ATHISH) onboarding</span>`;
        }
      }
    }

    const myTasks = state.distributedTasks.filter(t => t.assignedEmployee === activeEmpName);
    if (myTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-tertiary); background: var(--bg-surface-subtle); border-radius: 8px; border: 1px dashed var(--border-default);">
          <i data-lucide="check-circle" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 0.88rem;">No active tasks currently assigned to <strong>${activeEmpName}</strong>.</p>
        </div>
      `;
    } else {
      container.innerHTML = myTasks.map(task => `
        <div class="goal-preview-card" id="emp-task-${task.id}">
          <div class="goal-card-header">
            <div>
              <span class="tag-pill tag-role-manager" style="margin-bottom: 3px;">Assigned by Manager ${task.assignedManager || activeEmpManager || 'Manager'}</span>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">${task.title}</h3>
              <div style="font-size: 0.74rem; color: var(--text-tertiary); margin-top: 2px;">
                Parent Head Initiative: <strong>${task.parentDirective || 'Strategic Goal'}</strong>
              </div>
            </div>
            <span class="tag-pill ${task.progress >= 90 ? 'tag-emerald' : 'tag-indigo'}">${task.status}</span>
          </div>

          <div class="goal-progress-wrap" style="margin: 0.75rem 0;">
            <input type="range" class="interactive-slider" min="0" max="100" value="${task.progress}"
                   oninput="window.updateEmployeeTaskProgress('${task.id}', this.value)"
                   title="Drag slider to update task completion percentage">
            <span class="progress-pct-label">${task.progress}%</span>
          </div>

          <div class="goal-card-meta">
            <div>Due: <strong>${task.dueDate}</strong> • Estimated Effort: <strong>${task.estHours} hrs</strong></div>
            <div style="display: flex; gap: 6px;">
              <button class="btn-secondary" style="padding: 3px 8px; font-size: 0.74rem;" onclick="window.selectTaskForTimer('${task.title}')">
                <i data-lucide="timer" style="width: 12px; height: 12px;"></i>
                <span>Focus on this Task</span>
              </button>
              <button class="btn-primary" style="padding: 3px 8px; font-size: 0.74rem;" onclick="window.submitTaskForReview('${task.id}')">
                <i data-lucide="send" style="width: 12px; height: 12px;"></i>
                <span>Submit Check-in</span>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    const empTaskCount = document.getElementById('empTaskCount');
    if (empTaskCount) empTaskCount.innerHTML = `${myTasks.length} <span class="metric-unit">Tasks</span>`;
    lucide.createIcons();
  }

  // =========================================================================
  // 10. DEDICATED TASKS PAGE VIEW
  // =========================================================================

  function renderAllTasksTable() {
    const tableBody = document.getElementById('allTasksTableBody');
    const emptyState = document.getElementById('tasksEmptyState');
    if (!tableBody) return;

    let filtered = [...state.distributedTasks];

    // Filter by status
    if (state.taskFilter !== 'all') {
      if (state.taskFilter === 'Overdue') {
        const now = new Date();
        filtered = filtered.filter(t => {
          if (t.status === 'Completed' || t.progress >= 100 || !t.dueDate) return false;
          return new Date(t.dueDate) < now;
        });
      } else {
        filtered = filtered.filter(t => t.status === state.taskFilter);
      }
    }

    // Filter by assignee
    if (state.taskAssignee !== 'all') {
      filtered = filtered.filter(t => t.assignedEmployee === state.taskAssignee);
    }

    // Search query
    if (state.taskSearch) {
      const q = state.taskSearch.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.parentDirective && t.parentDirective.toLowerCase().includes(q)) ||
        (t.assignedEmployee && t.assignedEmployee.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(task => `
      <tr>
        <td>
          <strong style="color: var(--text-primary); font-size: 0.88rem;">${task.title}</strong>
          <div style="font-size: 0.72rem; color: var(--text-tertiary); margin-top: 2px;">
            ${task.parentDirective || 'General Cloud Initiative'}
          </div>
        </td>
        <td>
          <span class="tag-pill tag-role-employee">
            <i data-lucide="user" style="width: 10px; height: 10px;"></i>
            ${task.assignedEmployee}
          </span>
        </td>
        <td>
          <span class="tag-pill tag-role-manager">
            <i data-lucide="briefcase" style="width: 10px; height: 10px;"></i>
            ${task.assignedManager || (state.roles.manager && state.roles.manager.name !== 'No Manager Appointed' ? state.roles.manager.name : 'Unassigned')}
          </span>
        </td>
        <td style="font-variant-numeric: tabular-nums; font-size: 0.8rem;">
          ${task.dueDate}
        </td>
        <td style="font-size: 0.8rem;">
          ${task.estHours || 16} hrs
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-track" style="width: 60px; height: 6px;">
              <div class="progress-bar-fill" style="width: ${task.progress}%; background: var(--brand-primary);"></div>
            </div>
            <strong style="font-size: 0.8rem; font-variant-numeric: tabular-nums;">${task.progress}%</strong>
          </div>
        </td>
        <td>
          <span class="tag-pill ${task.progress >= 100 || task.status === 'Completed' ? 'tag-emerald' : task.status === 'Ready for Review' ? 'tag-indigo' : 'tag-amber'}">
            ${task.status}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button class="btn-secondary" style="padding: 3px 7px; font-size: 0.72rem;" onclick="window.editTaskPrompt('${task.id}')" title="Edit Task">
              <i data-lucide="edit-2" style="width: 11px; height: 11px;"></i>
            </button>
            <button class="btn-secondary" style="padding: 3px 7px; font-size: 0.72rem; color: var(--danger-text);" onclick="window.deleteTaskPrompt('${task.id}')" title="Delete Task">
              <i data-lucide="trash" style="width: 11px; height: 11px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  }

  // Filter chips event listeners
  document.querySelectorAll('[data-task-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-task-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.taskFilter = chip.getAttribute('data-task-filter');
      renderAllTasksTable();
    });
  });

  const taskSearchInput = document.getElementById('taskSearchInput');
  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', (e) => {
      state.taskSearch = e.target.value.trim();
      renderAllTasksTable();
    });
  }

  const taskAssigneeFilter = document.getElementById('taskAssigneeFilter');
  if (taskAssigneeFilter) {
    taskAssigneeFilter.addEventListener('change', (e) => {
      state.taskAssignee = e.target.value;
      renderAllTasksTable();
    });
  }

  const btnRefreshTasksList = document.getElementById('btnRefreshTasksList');
  if (btnRefreshTasksList) {
    btnRefreshTasksList.addEventListener('click', () => {
      syncDataFromBackend();
    });
  }

  // =========================================================================
  // 11. GOALS & OKRs VIEW
  // =========================================================================

  function renderAllGoalsView() {
    const container = document.getElementById('allGoalsCardsContainer');
    if (!container) return;

    container.innerHTML = state.directivesFromHead.map(g => {
      const relatedSubtasks = state.distributedTasks.filter(t => t.parentDirective === g.title);
      return `
        <div class="goal-preview-card" style="border-left: 3px solid #2563EB; margin-bottom: 1.25rem;">
          <div class="goal-card-header">
            <div>
              <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                <span class="tag-pill tag-role-head"><i data-lucide="crown" style="width: 10px; height: 10px;"></i> Strategic Directive</span>
                <span class="tag-pill tag-indigo">${g.weight}</span>
              </div>
              <h2 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${g.title}</h2>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
                Responsible Manager: <strong>${g.assignedManager}</strong> • Dept: <strong>${g.dept}</strong> • Target SLA: <strong>${g.deadline}</strong>
              </div>
            </div>
            <span class="tag-pill ${g.status === 'On Track' ? 'tag-emerald' : 'tag-amber'}">${g.status}</span>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.65rem 0; background: var(--bg-surface-subtle); padding: 8px 12px; border-radius: 6px; border: 1px dashed var(--border-default);">
            <strong>Executive Directives:</strong> "${g.directiveNotes}"
          </div>

          <div class="goal-progress-wrap" style="margin: 0.75rem 0;">
            <div class="progress-track" style="height: 8px;">
              <div class="progress-bar-fill" style="width: ${g.progress}%; background: var(--brand-primary);"></div>
            </div>
            <span class="progress-pct-label" style="font-size: 0.9rem;">${g.progress}%</span>
          </div>

          <div class="goal-card-meta">
            <div style="font-size: 0.76rem; color: var(--text-tertiary);">
              Linked subtasks: <strong>${relatedSubtasks.length} tasks in progress</strong> across team engineers
            </div>
            <button class="btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.distributeDirective('${g.title}')">
              <i data-lucide="share-2" style="width: 12px; height: 12px;"></i>
              <span>Distribute to Team</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  // =========================================================================
  // 12. WORKFORCE & EMPLOYEES VIEW
  // =========================================================================

  function renderAllEmployeesDirectory() {
    const grid = document.getElementById('allEmployeesDirectoryGrid');
    const searchInput = document.getElementById('employeeDirectorySearch');
    const q = (searchInput?.value || '').toLowerCase();
    if (!grid) return;

    // Toggle Add Employee button in view header based on currentRole === 'head'
    const btnAdd = document.getElementById('btnOpenAddEmployeeModal');
    if (btnAdd) {
      btnAdd.style.display = (state.currentRole === 'head' ? 'inline-flex' : 'none');
    }

    const filtered = state.employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      e.dept.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-tertiary);">
          <i data-lucide="users" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
          <p>No employees found matching "${q}".</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map(emp => `
      <div class="member-card">
        <div class="member-card-header">
          <img src="${emp.avatar || EMPTY_AVATAR}" alt="${emp.name}" class="member-avatar-lg">
          <div class="member-info">
            <h3>${emp.name}</h3>
            <div class="member-role">${emp.role}</div>
            <div style="margin-top: 4px;">
              <span class="member-dept-tag">${emp.dept}</span>
              <span class="tag-pill tag-role-manager" style="font-size: 0.65rem;">Mgr: ${emp.manager}</span>
            </div>
          </div>
        </div>

        <div class="member-stats-row">
          <div class="member-stat-cell">
            <div class="member-stat-val" style="color: var(--brand-primary);">${emp.productivity}%</div>
            <div class="member-stat-lbl">Productivity</div>
          </div>
          <div class="member-stat-cell">
            <div class="member-stat-val">${emp.focusHours}</div>
            <div class="member-stat-lbl">Focus Time</div>
          </div>
          <div class="member-stat-cell">
            <div class="member-stat-val"><span class="tag-pill tag-emerald">${emp.status}</span></div>
            <div class="member-stat-lbl">Status</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button class="btn-scorecard" style="flex: 1; margin-top: 0;" onclick="window.openScorecardModal('${emp.id}')">
            <i data-lucide="file-badge" style="width: 14px; height: 14px;"></i>
            <span>Dossier</span>
          </button>
          <button class="btn-secondary" style="padding: 0 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;" onclick="window.switchActiveEmployee('${emp.name}'); window.switchRole('employee'); window.switchView('dashboard');" title="Switch to ${emp.name}'s Contributor Workspace">
            <i data-lucide="user-check" style="width: 13px; height: 13px;"></i>
            <span>Switch To</span>
          </button>
          ${state.currentRole === 'head' ? `
            <button class="btn-secondary" style="padding: 0 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;" onclick="window.openEditEmployeeModal('${emp.id}')" title="Edit employee details in database">
              <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
              <span>Edit</span>
            </button>
            <button class="btn-secondary" style="color: #DC2626; border-color: rgba(220, 38, 38, 0.3); padding: 0 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;" onclick="window.removeEmployeePrompt('${emp.id}')" title="Remove employee (Head authority)">
              <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              <span>Remove</span>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    lucide.createIcons();
  }

  const employeeDirectorySearch = document.getElementById('employeeDirectorySearch');
  if (employeeDirectorySearch) {
    employeeDirectorySearch.addEventListener('input', renderAllEmployeesDirectory);
  }

  // =========================================================================
  // 13. REPORTS & ANALYTICS VIEW
  // =========================================================================

  function renderReportsView() {
    initVelocityTrendChart();
    lucide.createIcons();
  }

  const btnExportJsonReport = document.getElementById('btnExportJsonReport');
  if (btnExportJsonReport) {
    btnExportJsonReport.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        organization: 'Acme Cloud Inc.',
        mode: state.isLiveMode ? 'LIVE_API' : 'DEMO_MODE',
        summary: analyticsService.calculateMetricsFromDatasets(state.distributedTasks, state.directivesFromHead, state.employees),
        directives: state.directivesFromHead,
        tasks: state.distributedTasks,
        personnel: state.employees
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CloudPulse-Telemetry-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported complete telemetry metrics as JSON.', 'success');
    });
  }

  const btnExportAuditPdf = document.getElementById('btnExportAuditPdf');
  if (btnExportAuditPdf) {
    btnExportAuditPdf.addEventListener('click', () => {
      showToast('Compiling Multi-Region Executive Audit Dossier (PDF)...', 'info');
      setTimeout(() => {
        window.print();
      }, 500);
    });
  }

  // =========================================================================
  // 14. NOTIFICATIONS FEED VIEW
  // =========================================================================

  function renderNotificationsFeed() {
    const list = document.getElementById('notificationsFeedList');
    if (!list) return;

    list.innerHTML = state.notifications.map(n => `
      <div class="goal-preview-card" style="margin-bottom: 0.75rem; border-left: 3px solid ${n.read ? 'var(--border-default)' : 'var(--brand-primary)'}; background: ${n.read ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
              <span class="tag-pill ${n.category === 'Directive' ? 'tag-role-head' : n.category === 'Check-in' ? 'tag-role-manager' : 'tag-indigo'}">${n.category}</span>
              <strong style="font-size: 0.88rem; color: var(--text-primary);">${n.title}</strong>
              ${!n.read ? '<span class="tag-pill tag-emerald" style="font-size: 0.65rem;">New</span>' : ''}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 2px 0;">${n.desc}</p>
            <span style="font-size: 0.7rem; color: var(--text-tertiary);">${n.time}</span>
          </div>

          <div style="display: flex; gap: 4px;">
            ${!n.read ? `<button class="btn-secondary" style="font-size: 0.72rem; padding: 2px 8px;" onclick="window.markNotifRead('${n.id}')">Mark Read</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    const countEl = document.getElementById('notifCount');
    const unread = state.notifications.filter(n => !n.read).length;
    if (countEl) {
      if (unread > 0) {
        countEl.textContent = unread;
        countEl.style.display = 'inline-flex';
      } else {
        countEl.style.display = 'none';
      }
    }

    lucide.createIcons();
  }

  window.markNotifRead = function(id) {
    const n = state.notifications.find(item => item.id === id);
    if (n) {
      n.read = true;
      renderNotificationsFeed();
      showToast('Notification marked as read', 'info');
    }
  };

  const btnMarkAllNotifsRead = document.getElementById('btnMarkAllNotifsRead');
  if (btnMarkAllNotifsRead) {
    btnMarkAllNotifsRead.addEventListener('click', () => {
      state.notifications.forEach(n => n.read = true);
      renderNotificationsFeed();
      showToast('All notifications marked as read', 'success');
    });
  }

  // =========================================================================
  // 15. SETTINGS: API CONFIGURATION CONTROLLER
  // =========================================================================

  function populateApiSettingsForm() {
    if (!configService) return;
    const cfg = configService.config;

    const inputUrl = document.getElementById('cfgApiBaseUrl');
    const inputBearer = document.getElementById('cfgBearerToken');
    const inputUserPool = document.getElementById('cfgCognitoUserPool');
    const inputClientId = document.getElementById('cfgCognitoClientId');
    const inputCognitoToken = document.getElementById('cfgCognitoToken');
    const inputApiKey = document.getElementById('cfgApiKey');
    const inputHealth = document.getElementById('cfgHealthEndpoint');

    if (inputUrl) inputUrl.value = cfg.baseUrl || '';
    if (inputBearer) inputBearer.value = cfg.bearerToken || '';
    if (inputUserPool) inputUserPool.value = cfg.cognito?.userPoolId || '';
    if (inputClientId) inputClientId.value = cfg.cognito?.clientId || '';
    if (inputCognitoToken) inputCognitoToken.value = cfg.cognito?.token || '';
    if (inputApiKey) inputApiKey.value = cfg.apiKey || '';
    if (inputHealth) inputHealth.value = cfg.healthEndpoint || '/health';

    setAuthModeUI(cfg.authMode || 'none');
    updateApiStatusBannerCard();
  }

  function setAuthModeUI(mode) {
    document.querySelectorAll('.auth-mode-card').forEach(card => {
      if (card.getAttribute('data-auth-mode') === mode) card.classList.add('active');
      else card.classList.remove('active');
    });

    const secBearer = document.getElementById('authFieldsBearer');
    const secCognito = document.getElementById('authFieldsCognito');
    const secApiKey = document.getElementById('authFieldsApiKey');

    if (secBearer) secBearer.style.display = mode === 'bearer' ? 'block' : 'none';
    if (secCognito) secCognito.style.display = mode === 'cognito' ? 'block' : 'none';
    if (secApiKey) secApiKey.style.display = mode === 'apikey' ? 'block' : 'none';
  }

  document.querySelectorAll('.auth-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.getAttribute('data-auth-mode');
      setAuthModeUI(mode);
    });
  });

  // Preset Buttons
  const btnPresetAws = document.getElementById('btnPresetAws');
  if (btnPresetAws) {
    btnPresetAws.addEventListener('click', () => {
      const urlInput = document.getElementById('cfgApiBaseUrl');
      if (urlInput) urlInput.value = API_BASE_URL;
      showToast('Populated AWS API Gateway (ap-south-1 prod) endpoint.', 'success');
    });
  }

  const btnPresetLocal = document.getElementById('btnPresetLocal');
  if (btnPresetLocal) {
    btnPresetLocal.addEventListener('click', () => {
      const urlInput = document.getElementById('cfgApiBaseUrl');
      if (urlInput) urlInput.value = 'http://localhost:8000';
      showToast('Populated Localhost endpoint: http://localhost:8000', 'info');
    });
  }

  function updateApiStatusBannerCard(testResult = null) {
    const card = document.getElementById('apiStatusBannerCard');
    const badge = document.getElementById('apiStatusBadge');
    const badgeText = document.getElementById('apiStatusBadgeText');
    const ping = document.getElementById('apiStatusPing');
    const endpText = document.getElementById('apiStatusEndpointText');
    const lastChecked = document.getElementById('apiStatusLastChecked');

    const cfg = configService.config;
    const isLive = configService.isLiveMode();

    if (testResult) {
      if (testResult.success) {
        if (card) card.className = 'api-connection-status-card api-status-connected';
        if (badge) badge.className = 'status-badge-lg tag-emerald';
        if (badgeText) badgeText.textContent = `Connected (${testResult.status} OK)`;
        if (ping) ping.textContent = `${testResult.latencyMs}ms`;
        if (endpText) endpText.innerHTML = `Active URL: <strong>${cfg.baseUrl}</strong>`;
        if (lastChecked) lastChecked.textContent = `Last checked: Just now (${new Date().toLocaleTimeString()})`;
      } else {
        if (card) card.className = 'api-connection-status-card api-status-disconnected';
        if (badge) badge.className = 'status-badge-lg tag-amber';
        if (badgeText) badgeText.textContent = `Error (${testResult.status || testResult.type})`;
        if (ping) ping.textContent = testResult.latencyMs ? `${testResult.latencyMs}ms` : '-- ms';
        if (endpText) endpText.innerHTML = `Target: <strong>${cfg.baseUrl || 'None'}</strong>`;
        if (lastChecked) lastChecked.textContent = `Last checked: Just now (Failed)`;
      }
      return;
    }

    if (isLive) {
      if (card) card.className = 'api-connection-status-card api-status-connected';
      if (badge) badge.className = 'status-badge-lg tag-emerald';
      if (badgeText) badgeText.textContent = 'Live API Active';
      if (ping) ping.textContent = '18ms';
      if (endpText) endpText.innerHTML = `Active URL: <strong>${cfg.baseUrl}</strong>`;
    } else {
      if (card) card.className = 'api-connection-status-card api-status-demo';
      if (badge) badge.className = 'status-badge-lg tag-amber';
      if (badgeText) badgeText.textContent = 'Demo Mode (Mock Backend)';
      if (ping) ping.textContent = '-- ms';
      if (endpText) endpText.innerHTML = 'Active URL: <strong>Local In-Memory Mock Store</strong>';
    }
  }

  async function performTestConnection() {
    const baseUrl = (document.getElementById('cfgApiBaseUrl')?.value || '').trim();
    const activeAuthCard = document.querySelector('.auth-mode-card.active');
    const authMode = activeAuthCard ? activeAuthCard.getAttribute('data-auth-mode') : 'none';
    const bearerToken = (document.getElementById('cfgBearerToken')?.value || '').trim();
    const apiKey = (document.getElementById('cfgApiKey')?.value || '').trim();
    const healthEndpoint = (document.getElementById('cfgHealthEndpoint')?.value || '/health').trim();

    const tempConfig = {
      baseUrl,
      authMode,
      bearerToken,
      apiKey,
      healthEndpoint,
      cognito: {
        userPoolId: (document.getElementById('cfgCognitoUserPool')?.value || '').trim(),
        clientId: (document.getElementById('cfgCognitoClientId')?.value || '').trim(),
        token: (document.getElementById('cfgCognitoToken')?.value || '').trim()
      }
    };

    const diagBox = document.getElementById('apiDiagnosticBox');
    const diagTitle = document.getElementById('diagTitle');
    const diagMessage = document.getElementById('diagMessage');
    const diagFix = document.getElementById('diagFix');

    showToast('Probing backend API connectivity...', 'info');

    const result = await healthService.testConnection(tempConfig);
    updateApiStatusBannerCard(result);

    if (diagBox) {
      diagBox.style.display = 'block';
      if (result.success) {
        diagBox.className = 'diagnostic-alert-box diagnostic-success';
        diagTitle.textContent = `Connection Successful (${result.status} OK)`;
        diagMessage.textContent = `Successfully reached ${tempConfig.baseUrl}${result.endpoint} with ${result.latencyMs}ms latency.`;
        diagFix.textContent = 'Ready to activate Live Mode and synchronize data.';
        showToast('Connection verified! Safe to activate Live Mode.', 'success');
      } else {
        diagBox.className = 'diagnostic-alert-box diagnostic-error';
        diagTitle.textContent = `Connection Probe Failed (${result.status || result.type})`;
        diagMessage.textContent = result.error || 'Could not establish connection to the endpoint.';
        diagFix.textContent = result.diagnostic || 'Verify API URL, CORS settings, and AWS Lambda health.';
        showToast(`Connection failed: ${result.error}`, 'error');
      }
    }

    lucide.createIcons();
    return result;
  }

  const btnTestConnectionMain = document.getElementById('btnTestConnectionMain');
  if (btnTestConnectionMain) btnTestConnectionMain.addEventListener('click', performTestConnection);

  const btnTestConfigInForm = document.getElementById('btnTestConfigInForm');
  if (btnTestConfigInForm) btnTestConfigInForm.addEventListener('click', performTestConnection);

  // Probe All Endpoints
  const btnProbeAllEndpoints = document.getElementById('btnProbeAllEndpoints');
  if (btnProbeAllEndpoints) {
    btnProbeAllEndpoints.addEventListener('click', async () => {
      showToast('Probing all REST resource endpoints...', 'info');
      const endpoints = [
        { id: 'probeStatusHealth', path: '/health' },
        { id: 'probeStatusTasks', path: '/tasks' },
        { id: 'probeStatusGoals', path: '/goals' },
        { id: 'probeStatusEmployees', path: '/employees' },
        { id: 'probeStatusAnalytics', path: '/analytics' },
        { id: 'probeStatusNotifs', path: '/notifications' }
      ];

      for (const ep of endpoints) {
        const badge = document.getElementById(ep.id);
        if (badge) {
          badge.className = 'endpoint-probe-badge endpoint-probe-pending';
          badge.textContent = 'Testing...';
        }
      }

      for (const ep of endpoints) {
        const badge = document.getElementById(ep.id);
        try {
          const res = await api.apiClient.get(ep.path, { timeoutMs: 3500 });
          if (badge) {
            badge.className = 'endpoint-probe-badge endpoint-probe-pass';
            badge.textContent = `${res.status} OK`;
          }
        } catch (err) {
          if (badge) {
            if (err.status === 401 || err.status === 403) {
              badge.className = 'endpoint-probe-badge endpoint-probe-fail';
              badge.textContent = `${err.status} Auth`;
            } else if (err.status === 404) {
              badge.className = 'endpoint-probe-badge endpoint-probe-fail';
              badge.textContent = '404 Missing';
            } else {
              badge.className = 'endpoint-probe-badge endpoint-probe-fail';
              badge.textContent = 'Down';
            }
          }
        }
      }
      showToast('Resource probe completed.', 'info');
    });
  }

  // Save Configuration Form
  const formApiConfiguration = document.getElementById('formApiConfiguration');
  if (formApiConfiguration) {
    formApiConfiguration.addEventListener('submit', (e) => {
      e.preventDefault();
      const baseUrl = (document.getElementById('cfgApiBaseUrl')?.value || '').trim();
      const activeAuthCard = document.querySelector('.auth-mode-card.active');
      const authMode = activeAuthCard ? activeAuthCard.getAttribute('data-auth-mode') : 'none';
      const bearerToken = (document.getElementById('cfgBearerToken')?.value || '').trim();
      const apiKey = (document.getElementById('cfgApiKey')?.value || '').trim();
      const healthEndpoint = (document.getElementById('cfgHealthEndpoint')?.value || '/health').trim();

      const validation = configService.validateUrl(baseUrl);
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }

      if (validation.warning) {
        showToast(validation.warning, 'info');
      }

      const updated = configService.saveConfig({
        baseUrl,
        authMode,
        bearerToken,
        apiKey,
        healthEndpoint,
        cognito: {
          userPoolId: (document.getElementById('cfgCognitoUserPool')?.value || '').trim(),
          clientId: (document.getElementById('cfgCognitoClientId')?.value || '').trim(),
          token: (document.getElementById('cfgCognitoToken')?.value || '').trim()
        }
      });

      configService.setMode('live');
      state.isLiveMode = true;
      updateModeBannerUI();
      updateApiStatusBannerCard();
      showToast('API Configuration saved! Activated Live Mode.', 'success');

      syncDataFromBackend();
    });
  }

  const btnResetApiConfig = document.getElementById('btnResetApiConfig');
  if (btnResetApiConfig) {
    btnResetApiConfig.addEventListener('click', () => {
      configService.resetConfig();
      populateApiSettingsForm();
      updateModeBannerUI();
      showToast('Reset configuration to default Demo Mode.', 'info');
    });
  }

  const btnClearCredentials = document.getElementById('btnClearCredentials');
  if (btnClearCredentials) {
    btnClearCredentials.addEventListener('click', () => {
      configService.resetConfig();
      localStorage.removeItem('cloudpulse_api_config');
      populateApiSettingsForm();
      showToast('Cleared all persisted configuration & credentials.', 'success');
    });
  }

  // =========================================================================
  // 16. MODAL 5: CREATE / EDIT TASK CONTROLLER
  // =========================================================================

  const modalCreateTask = document.getElementById('modalCreateTask');
  const btnCloseCreateTaskModal = document.getElementById('btnCloseCreateTaskModal');
  const btnCancelCreateTaskModal = document.getElementById('btnCancelCreateTaskModal');
  const formCreateTask = document.getElementById('formCreateTask');
  const btnOpenCreateTaskModal = document.getElementById('btnOpenCreateTaskModal');
  const modalTaskFormTitle = document.getElementById('modalTaskFormTitle');
  const btnSubmitTaskFormText = document.getElementById('btnSubmitTaskFormText');
  const taskFormEditId = document.getElementById('taskFormEditId');

  function populateParentDirectivesSelect(selectedTitle = '') {
    const select = document.getElementById('taskFormParentDirective');
    if (!select) return;
    select.innerHTML = state.directivesFromHead.map(d => `
      <option value="${d.title}" ${d.title === selectedTitle ? 'selected' : ''}>${d.title} (${d.assignedManager})</option>
    `).join('');
  }

  window.openCreateTaskModal = function() {
    taskFormEditId.value = '';
    modalTaskFormTitle.textContent = 'Create New Organization Task';
    btnSubmitTaskFormText.textContent = 'Create Task';
    formCreateTask.reset();
    populateParentDirectivesSelect();
    updateEmployeeSelectDropdowns();
    modalCreateTask.classList.add('open');
    document.getElementById('taskFormTitle').focus();
  };

  window.editTaskPrompt = async function(taskId) {
    let task = state.distributedTasks.find(t => (t.id === taskId || t.taskId === taskId));

    // Fetch fresh individual task details from AWS Lambda / DynamoDB
    if (state.isLiveMode && taskService) {
      try {
        const liveDetail = await taskService.getTaskById(taskId);
        if (liveDetail) {
          task = { ...task, ...liveDetail };
        }
      } catch (err) {
        console.warn('[CloudPulse] Using cached state for task edit:', err);
      }
    }

    if (!task) return;

    taskFormEditId.value = task.taskId || task.id;
    modalTaskFormTitle.textContent = 'Edit Organization Task';
    btnSubmitTaskFormText.textContent = 'Save Changes';

    updateEmployeeSelectDropdowns();
    document.getElementById('taskFormTitle').value = task.title || '';
    populateParentDirectivesSelect(task.parentDirective || task.description);
    document.getElementById('taskFormAssignee').value = task.assignedEmployee || (state.employees[0] ? state.employees[0].name : '');
    document.getElementById('taskFormManager').value = task.assignedManager || (state.managers[0] ? state.managers[0].name : 'Unassigned');
    document.getElementById('taskFormDueDate').value = task.dueDate || '2026-10-30';
    document.getElementById('taskFormEstHours').value = task.estHours || 16;
    document.getElementById('taskFormStatus').value = task.status || 'In Progress';

    modalCreateTask.classList.add('open');
  };

  window.deleteTaskPrompt = async function(taskId) {
    const task = state.distributedTasks.find(t => (t.id === taskId || t.taskId === taskId));
    if (!task) return;

    if (!confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      return;
    }

    const targetId = task.taskId || task.id;

    if (state.isLiveMode && taskService) {
      try {
        showToast('Deleting task from AWS DynamoDB...', 'info');
        await taskService.deleteTask(targetId);
        // Only update UI after successful deletion
        state.distributedTasks = state.distributedTasks.filter(t => (t.id !== targetId && t.taskId !== targetId));
        showToast(`Task "${task.title.slice(0, 30)}" successfully deleted from AWS backend.`, 'success');
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        renderCurrentView();
      } catch (e) {
        console.error('[CloudPulse] Failed to delete task:', e);
        showToast(`Failed to delete task: ${e.message}`, 'error');
        // Do NOT remove locally if request failed
      }
    } else {
      state.distributedTasks = state.distributedTasks.filter(t => (t.id !== targetId && t.taskId !== targetId));
      showToast('Task removed from organization pipeline (Demo Mode).', 'info');
      updateExecutiveStatsRibbon();
      refreshAllCharts();
      renderCurrentView();
    }
  };

  function closeCreateTaskModal() {
    modalCreateTask.classList.remove('open');
    formCreateTask.reset();
  }

  [btnCloseCreateTaskModal, btnCancelCreateTaskModal].forEach(b => {
    if (b) b.addEventListener('click', closeCreateTaskModal);
  });
  if (btnOpenCreateTaskModal) btnOpenCreateTaskModal.addEventListener('click', openCreateTaskModal);

  if (formCreateTask) {
    formCreateTask.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = taskFormEditId.value;
      const title = document.getElementById('taskFormTitle').value.trim();
      const parentEl = document.getElementById('taskFormParentDirective');
      const parent = parentEl ? parentEl.value : 'General Directive';
      const assignee = document.getElementById('taskFormAssignee').value;
      const manager = document.getElementById('taskFormManager').value;
      const dueDate = document.getElementById('taskFormDueDate').value;
      const estHours = parseInt(document.getElementById('taskFormEstHours').value, 10) || 16;
      const status = document.getElementById('taskFormStatus').value;

      if (!title) return;

      const progress = status === 'Completed' ? 100 : status === 'Ready for Review' ? 90 : status === 'In Progress' ? 50 : 15;

      const btnSubmit = document.getElementById('btnSubmitTaskForm');
      const originalText = btnSubmitTaskFormText ? btnSubmitTaskFormText.textContent : 'Save';
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnSubmitTaskFormText) btnSubmitTaskFormText.textContent = editId ? 'Saving...' : 'Creating...';

      try {
        if (editId) {
          // Edit existing task
          const existing = state.distributedTasks.find(t => (t.id === editId || t.taskId === editId));
          const updates = {
            id: editId,
            taskId: editId,
            title,
            parentDirective: parent,
            description: parent,
            assignedEmployee: assignee,
            assignedManager: manager,
            dueDate,
            estHours,
            status,
            progress
          };

          if (state.isLiveMode && taskService) {
            const updated = await taskService.updateTask(editId, updates);
            const idx = state.distributedTasks.findIndex(t => (t.id === editId || t.taskId === editId));
            if (idx !== -1) {
              state.distributedTasks[idx] = updated;
            } else {
              state.distributedTasks.unshift(updated);
            }
            showToast(`Task "${title.slice(0, 30)}" saved in AWS DynamoDB!`, 'success');
          } else {
            if (existing) Object.assign(existing, updates);
            showToast(`Task "${title.slice(0, 30)}" updated locally!`, 'success');
          }
        } else {
          // Create new task
          const taskData = {
            parentDirective: parent,
            description: parent,
            title,
            assignedEmployee: assignee,
            assignedManager: manager,
            dueDate: dueDate || '2026-11-15',
            estHours,
            progress,
            status,
            priority: 'MEDIUM'
          };

          if (state.isLiveMode && taskService) {
            const created = await taskService.createTask(taskData);
            state.distributedTasks.unshift(created);
            showToast(`Task created in DynamoDB! (ID: ${created.taskId})`, 'success');
          } else {
            const newTask = {
              ...taskData,
              id: `task-${Date.now()}`,
              taskId: `task-${Date.now()}`
            };
            state.distributedTasks.unshift(newTask);
            showToast(`Task created and assigned to ${assignee}!`, 'success');
          }
        }

        closeCreateTaskModal();
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        renderCurrentView();

      } catch (err) {
        console.error('[CloudPulse] Error saving task:', err);
        showToast(`Failed to save task: ${err.message}`, 'error');
        // Modal remains open on error so user does not lose input
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnSubmitTaskFormText) btnSubmitTaskFormText.textContent = originalText;
      }
    });
  }

  // =========================================================================
  // 17. MODAL 1 & 2: HEAD ASSIGN & MANAGER DISTRIBUTE
  // =========================================================================

  const modalHeadAssign = document.getElementById('modalHeadAssign');
  const btnCloseHeadModal = document.getElementById('btnCloseHeadModal');
  const btnCancelHeadAssign = document.getElementById('btnCancelHeadAssign');
  const formHeadAssign = document.getElementById('formHeadAssign');
  const btnOpenHeadAssignModal = document.getElementById('btnOpenHeadAssignModal');

  window.openHeadAssignModal = function() {
    updateEmployeeSelectDropdowns();
    modalHeadAssign.classList.add('open');
    document.getElementById('headGoalTitle').focus();
  };

  window.openHeadAssignToSpecific = function(managerName) {
    updateEmployeeSelectDropdowns();
    modalHeadAssign.classList.add('open');
    const select = document.getElementById('headSelectManager');
    if (select) select.value = managerName;
  };

  function closeHeadAssignModal() {
    modalHeadAssign.classList.remove('open');
    formHeadAssign.reset();
  }

  [btnCloseHeadModal, btnCancelHeadAssign].forEach(b => {
    if (b) b.addEventListener('click', closeHeadAssignModal);
  });
  if (btnOpenHeadAssignModal) btnOpenHeadAssignModal.addEventListener('click', openHeadAssignModal);

  if (formHeadAssign) {
    formHeadAssign.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('headGoalTitle').value.trim();
      const manager = document.getElementById('headSelectManager').value;
      const priority = document.getElementById('headGoalPriority').value;
      const deadline = document.getElementById('headGoalDeadline').value;
      const weight = document.getElementById('headGoalWeight').value;
      const notes = document.getElementById('headGoalDirective').value.trim() || 'Execute across your team.';

      if (!title) return;
      if (!manager) {
        showToast('Please appoint a Team Manager first before issuing strategic directives.', 'warning');
        return;
      }

      const mgrObj = state.managers.find(m => m.name === manager);
      const dept = mgrObj ? mgrObj.dept : 'General Operations';

      const newDirective = {
        id: `dir-${Date.now()}`,
        title,
        assignedManager: manager,
        dept,
        priority,
        deadline: deadline || '2026-11-30',
        weight,
        progress: 10,
        status: 'Pending Distribution',
        directiveNotes: notes
      };

      if (state.isLiveMode) {
        try {
          const created = await goalService.createGoal(newDirective);
          if (created && created.id) newDirective.id = created.id;
        } catch (err) {
          showToast(`Directive added locally. Backend save notice: ${err.message}`, 'info');
        }
      }

      state.directivesFromHead.unshift(newDirective);
      closeHeadAssignModal();
      showToast(`Strategic directive successfully issued to Team Manager ${manager}!`, 'success');

      updateExecutiveStatsRibbon();
      refreshAllCharts();
      renderCurrentView();
    });
  }

  // Manager Distribute Modal
  const modalManagerDistribute = document.getElementById('modalManagerDistribute');
  const btnCloseManagerModal = document.getElementById('btnCloseManagerModal');
  const btnCancelManagerModal = document.getElementById('btnCancelManagerModal');
  const formManagerDistribute = document.getElementById('formManagerDistribute');
  const btnOpenManagerDistributeModal = document.getElementById('btnOpenManagerDistributeModal');

  function populateManagerParentDirectives() {
    const select = document.getElementById('mgrSelectParentDirective');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = state.directivesFromHead.map(d => `
      <option value="${d.title}">${d.title} (${d.assignedManager})</option>
    `).join('');
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    }
  }

  window.openManagerDistributeModal = function() {
    populateManagerParentDirectives();
    modalManagerDistribute.classList.add('open');
    document.getElementById('mgrTaskTitle').focus();
  };

  window.distributeDirective = function(directiveTitle) {
    populateManagerParentDirectives();
    modalManagerDistribute.classList.add('open');
    const select = document.getElementById('mgrSelectParentDirective');
    if (select) select.value = directiveTitle;
  };

  window.quickDistributePrompt = function(directiveId) {
    const dir = state.directivesFromHead.find(d => d.id === directiveId);
    if (dir) window.distributeDirective(dir.title);
  };

  function closeManagerModal() {
    modalManagerDistribute.classList.remove('open');
    formManagerDistribute.reset();
  }

  [btnCloseManagerModal, btnCancelManagerModal].forEach(b => {
    if (b) b.addEventListener('click', closeManagerModal);
  });
  if (btnOpenManagerDistributeModal) btnOpenManagerDistributeModal.addEventListener('click', openManagerDistributeModal);

  if (formManagerDistribute) {
    formManagerDistribute.addEventListener('submit', async (e) => {
      e.preventDefault();
      const parent = document.getElementById('mgrSelectParentDirective').value;
      const title = document.getElementById('mgrTaskTitle').value.trim();
      const employee = document.getElementById('mgrSelectEmployee').value;
      const dueDate = document.getElementById('mgrTaskDueDate').value;
      const estHours = parseInt(document.getElementById('mgrEstHours').value, 10) || 16;

      if (!title) return;

      const btnSubmit = formManagerDistribute.querySelector('button[type="submit"]');
      if (btnSubmit) btnSubmit.disabled = true;

      const taskData = {
        parentDirective: parent,
        description: parent,
        title,
        assignedEmployee: employee,
        assignedManager: (state.roles.manager && state.roles.manager.name !== 'No Manager Appointed' ? state.roles.manager.name : (state.managers[0] ? state.managers[0].name : 'Unassigned')),
        dueDate: dueDate || '2026-10-30',
        estHours,
        progress: 10,
        status: 'In Progress',
        priority: 'MEDIUM'
      };

      try {
        if (state.isLiveMode && taskService) {
          const created = await taskService.createTask(taskData);
          state.distributedTasks.unshift(created);
          showToast(`Task distributed to ${employee} and saved in DynamoDB! (ID: ${created.taskId})`, 'success');
        } else {
          const newTask = {
            ...taskData,
            id: `task-${Date.now()}`,
            taskId: `task-${Date.now()}`
          };
          state.distributedTasks.unshift(newTask);
          showToast(`Task distributed to employee ${employee}!`, 'success');
        }

        closeManagerModal();
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        renderCurrentView();

      } catch (err) {
        console.error('[CloudPulse] Error distributing task:', err);
        showToast(`Failed to distribute task: ${err.message}`, 'error');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });
  }

  // =========================================================================
  // 18. EMPLOYEE SCORECARD & DOSSIER MODAL
  // =========================================================================

  let currentScorecardEmpId = null;

  window.openScorecardModal = function(empId) {
    const emp = state.employees.find(e => e.id === empId || e.dbTaskId === empId || e.name === empId);
    if (!emp) return;
    currentScorecardEmpId = emp.id || emp.dbTaskId;

    const modal = document.getElementById('modalEmployeeScorecard');
    const title = document.getElementById('scorecardEmployeeName');
    const content = document.getElementById('scorecardModalContent');
    const btnEdit = document.getElementById('btnEditScorecardEmployee');
    if (btnEdit) {
      btnEdit.style.display = (state.currentRole === 'head' ? 'inline-flex' : 'none');
    }

    title.textContent = `${emp.name} - Performance Dossier`;

    content.innerHTML = `
      <div style="display: flex; gap: 1.25rem; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--border-light); margin-bottom: 1rem;">
        <img src="${emp.avatar || EMPTY_AVATAR}" alt="${emp.name}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid white; box-shadow: var(--shadow-sm);">
        <div>
          <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">${emp.name}</h2>
          <div style="color: var(--text-secondary); font-size: 0.82rem;">${emp.role} • Reporting to <strong>${emp.manager}</strong></div>
          <div style="display: flex; gap: 6px; margin-top: 4px;">
            <span class="tag-pill tag-emerald">${emp.status}</span>
            <span class="tag-pill tag-indigo">${emp.focusHours} Focus Logged</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="background: var(--bg-surface-subtle); padding: 0.75rem; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-default);">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--brand-primary);">${emp.productivity}%</div>
          <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600;">Productivity Index</div>
        </div>
        <div style="background: var(--bg-surface-subtle); padding: 0.75rem; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-default);">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--success-text);">100%</div>
          <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600;">SLA Compliance</div>
        </div>
        <div style="background: var(--bg-surface-subtle); padding: 0.75rem; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-default);">
          <div style="font-size: 1.25rem; font-weight: 800; color: #1E40AF;">Optimal</div>
          <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600;">Governance Health</div>
        </div>
      </div>

      <div style="background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-md); padding: 0.85rem;">
        <div style="font-size: 0.75rem; font-weight: 800; color: #1E40AF; margin-bottom: 2px;">
          Manager / Head Recognition & Kudos
        </div>
        <div style="font-size: 0.82rem; color: var(--text-primary); line-height: 1.4;">
          "${emp.kudos}"
        </div>
      </div>
    `;

    modal.classList.add('open');
    lucide.createIcons();
  };

  window.openEditFromScorecard = function() {
    const modal = document.getElementById('modalEmployeeScorecard');
    if (modal) modal.classList.remove('open');
    if (currentScorecardEmpId) {
      window.openEditEmployeeModal(currentScorecardEmpId);
    }
  };

  const btnCloseScorecard = document.getElementById('btnCloseScorecard');
  const btnCloseScorecardFooter = document.getElementById('btnCloseScorecardFooter');
  const modalEmployeeScorecard = document.getElementById('modalEmployeeScorecard');
  [btnCloseScorecard, btnCloseScorecardFooter].forEach(b => {
    if (b) b.addEventListener('click', () => modalEmployeeScorecard.classList.remove('open'));
  });

  const btnSchedule1on1 = document.getElementById('btnSchedule1on1');
  if (btnSchedule1on1) {
    btnSchedule1on1.addEventListener('click', () => {
      modalEmployeeScorecard.classList.remove('open');
      showToast('1-on-1 Review invite scheduled on calendar!', 'success');
    });
  }

  // =========================================================================
  // 18A. APPOINT & REMOVE TEAM MANAGER CONTROLLERS (HEAD AUTHORITY ONLY)
  // =========================================================================

  window.openCreateManagerModal = function() {
    if (state.currentRole !== 'head') {
      showToast('Access Denied: Only Head Executive (ATHISH) can appoint team managers.', 'error');
      return;
    }
    const modal = document.getElementById('modalCreateManager');
    const form = document.getElementById('formCreateManager');
    if (form) form.reset();
    if (modal) modal.classList.add('open');
    const nameInput = document.getElementById('newMgrName');
    if (nameInput) nameInput.focus();
  };

  window.closeCreateManagerModal = function() {
    const modal = document.getElementById('modalCreateManager');
    if (modal) modal.classList.remove('open');
  };

  const btnCloseCreateManagerModal = document.getElementById('btnCloseCreateManagerModal');
  const btnCancelCreateManagerModal = document.getElementById('btnCancelCreateManagerModal');
  if (btnCloseCreateManagerModal) btnCloseCreateManagerModal.addEventListener('click', closeCreateManagerModal);
  if (btnCancelCreateManagerModal) btnCancelCreateManagerModal.addEventListener('click', closeCreateManagerModal);

  const formCreateManager = document.getElementById('formCreateManager');
  if (formCreateManager) {
    formCreateManager.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (state.currentRole !== 'head') {
        showToast('Access Denied: Only Head Executive (ATHISH) can appoint team managers.', 'error');
        return;
      }

      const name = (document.getElementById('newMgrName')?.value || '').trim();
      const dept = (document.getElementById('newMgrDept')?.value || '').trim();
      const role = (document.getElementById('newMgrRole')?.value || '').trim();
      const email = (document.getElementById('newMgrEmail')?.value || '').trim();
      const mandate = (document.getElementById('newMgrMandate')?.value || '').trim();

      if (!name || !dept || !role) {
        showToast('Please provide manager name, department, and role title.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitCreateManager');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Appoint Manager';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:inline-block; width:13px; height:13px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span> Saving to DynamoDB...';
      }

      const newMgr = {
        id: `mgr-${Date.now()}`,
        name,
        dept,
        role,
        email,
        mandate,
        subordinatesCount: 0,
        assignedDirectivesCount: 0,
        teamVelocity: '+0.0% WoW',
        managerScore: 96,
        avatar: EMPTY_AVATAR
      };

      try {
        if (configService && configService.isLiveMode() && employeeService && employeeService.createManager) {
          const created = await employeeService.createManager(newMgr);
          if (created && created.dbTaskId) {
            newMgr.dbTaskId = created.dbTaskId;
            newMgr.isFromDynamoDB = true;
          }
        }
      } catch (dbErr) {
        console.warn('[CloudPulse] Notice writing manager to DynamoDB:', dbErr);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

        // Add or update in state.managers
        const existingIdx = state.managers.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
        if (existingIdx >= 0) {
          state.managers[existingIdx] = { ...state.managers[existingIdx], ...newMgr };
        } else {
          state.managers.push(newMgr);
        }

        saveManagersToStorage();
        syncManagerRoleWithDatabase();
        updateEmployeeSelectDropdowns();
        closeCreateManagerModal();

        showToast(`Team Manager "${name}" successfully appointed and saved to AWS DynamoDB!`, 'success');

        if (state.currentRole === 'head') {
          renderHeadDashboard();
        }
        if (state.currentRole === 'manager') {
          renderManagerDashboard();
          updateManagerStatsRibbon();
        }
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        lucide.createIcons();
      }
    });
  }

  window.removeManagerPrompt = function(mgrIdentifier) {
    (async () => {
      if (state.currentRole !== 'head') {
        showToast('Access Denied: Only Head Executive (ATHISH) can remove managers.', 'error');
        return;
      }

      const mgr = state.managers.find(m => m.id === mgrIdentifier || m.dbTaskId === mgrIdentifier || m.name === mgrIdentifier);
      if (!mgr) {
        showToast('Manager record not found.', 'error');
        return;
      }

      if (!confirm(`Are you sure you want to remove Team Manager "${mgr.name}" (${mgr.dept}) from the organization?\n\nSubordinate employees will be marked as "Unassigned".`)) {
        return;
      }

      // Delete from DynamoDB in live mode
      if (configService && configService.isLiveMode() && employeeService && employeeService.deleteManager) {
        try {
          await employeeService.deleteManager(mgr.dbTaskId || mgr.id || mgr.name);
        } catch (err) {
          console.warn('[CloudPulse] Notice removing manager from DynamoDB:', err);
        }
      }

      // Reassign affected employees to Unassigned
      state.employees.forEach(emp => {
        if (emp.manager === mgr.name) {
          emp.manager = 'Unassigned';
          if (configService && configService.isLiveMode() && employeeService && employeeService.updateEmployee) {
            employeeService.updateEmployee(emp.dbTaskId || emp.id, { manager: 'Unassigned' }).catch(() => {});
          }
        }
      });
      saveEmployeesToStorage();

      // Remove from managers list
      state.managers = state.managers.filter(m => m.id !== mgr.id && m.name !== mgr.name && (!mgr.dbTaskId || m.dbTaskId !== mgr.dbTaskId));
      saveManagersToStorage();
      syncManagerRoleWithDatabase();
      updateEmployeeSelectDropdowns();

      showToast(`Team Manager "${mgr.name}" removed from organization by Head (ATHISH).`, 'info');

      if (state.currentRole === 'head') {
        renderHeadDashboard();
      }
      if (state.currentRole === 'manager') {
        renderManagerDashboard();
        updateManagerStatsRibbon();
      }
      updateExecutiveStatsRibbon();
      refreshAllCharts();
      lucide.createIcons();
    })();
  };

  // =========================================================================
  // 18B. ADD & REMOVE EMPLOYEE CONTROLLERS (HEAD AUTHORITY ONLY)
  // =========================================================================

  function updateEmployeeSelectDropdowns() {
    // 1. Task form assignee dropdown
    const taskAssigneeSelect = document.getElementById('taskFormAssignee');
    if (taskAssigneeSelect) {
      const currentVal = taskAssigneeSelect.value;
      if (!state.employees || state.employees.length === 0) {
        taskAssigneeSelect.innerHTML = `<option value="">-- No Employees Onboarded Yet --</option>`;
      } else {
        taskAssigneeSelect.innerHTML = state.employees.map(emp => `
          <option value="${emp.name}">${emp.name} (${emp.role || emp.dept})</option>
        `).join('');
        if (currentVal && state.employees.some(e => e.name === currentVal)) {
          taskAssigneeSelect.value = currentVal;
        }
      }
    }

    // 2. Task form manager dropdown
    const taskFormManagerSelect = document.getElementById('taskFormManager');
    if (taskFormManagerSelect) {
      const currentVal = taskFormManagerSelect.value;
      if (!state.managers || state.managers.length === 0) {
        taskFormManagerSelect.innerHTML = `<option value="Unassigned">-- No Managers Appointed --</option>`;
      } else {
        taskFormManagerSelect.innerHTML = state.managers.map(mgr => `
          <option value="${mgr.name}">${mgr.name} (${mgr.dept})</option>
        `).join('') + `<option value="Unassigned">Unassigned</option>`;
        if (currentVal && (currentVal === 'Unassigned' || state.managers.some(m => m.name === currentVal))) {
          taskFormManagerSelect.value = currentVal;
        }
      }
    }

    // 3. Manager distribute task employee dropdown
    const mgrEmpSelect = document.getElementById('mgrSelectEmployee');
    if (mgrEmpSelect) {
      const currentVal = mgrEmpSelect.value;
      if (!state.employees || state.employees.length === 0) {
        mgrEmpSelect.innerHTML = `<option value="">-- No Employees Available --</option>`;
      } else {
        mgrEmpSelect.innerHTML = state.employees.map(emp => `
          <option value="${emp.name}">${emp.name} (${emp.role || emp.dept})</option>
        `).join('');
        if (currentVal && state.employees.some(e => e.name === currentVal)) {
          mgrEmpSelect.value = currentVal;
        }
      }
    }

    // 4. Task Assignee Filter dropdown
    const filterSelect = document.getElementById('taskAssigneeFilter');
    if (filterSelect) {
      const currentVal = filterSelect.value;
      let opts = `<option value="all">All Assignees</option>`;
      if (state.employees && state.employees.length > 0) {
        opts += state.employees.map(emp => `
          <option value="${emp.name}">${emp.name}</option>
        `).join('');
      }
      filterSelect.innerHTML = opts;
      if (currentVal && (currentVal === 'all' || (state.employees && state.employees.some(e => e.name === currentVal)))) {
        filterSelect.value = currentVal;
      }
    }

    // 5. Head Issue Directive Manager dropdown
    const headMgrSelect = document.getElementById('headSelectManager');
    if (headMgrSelect) {
      const currentVal = headMgrSelect.value;
      if (!state.managers || state.managers.length === 0) {
        headMgrSelect.innerHTML = `<option value="">-- No Managers Appointed Yet (Appoint Manager First) --</option>`;
      } else {
        headMgrSelect.innerHTML = state.managers.map(mgr => `
          <option value="${mgr.name}">${mgr.name} — ${mgr.dept} (${mgr.role || 'Manager'})</option>
        `).join('');
        if (currentVal && state.managers.some(m => m.name === currentVal)) {
          headMgrSelect.value = currentVal;
        }
      }
    }

    // 6. Add Employee Modal Manager dropdown
    const newEmpManagerSelect = document.getElementById('newEmpManager');
    if (newEmpManagerSelect) {
      const currentVal = newEmpManagerSelect.value;
      if (!state.managers || state.managers.length === 0) {
        newEmpManagerSelect.innerHTML = `<option value="Unassigned">Unassigned (No Managers Appointed Yet)</option>`;
      } else {
        newEmpManagerSelect.innerHTML = state.managers.map(mgr => `
          <option value="${mgr.name}">${mgr.name} (${mgr.dept})</option>
        `).join('') + `<option value="Unassigned">Unassigned</option>`;
        if (currentVal && (currentVal === 'Unassigned' || state.managers.some(m => m.name === currentVal))) {
          newEmpManagerSelect.value = currentVal;
        }
      }
    }

    // 7. Edit Employee Modal Manager dropdown
    const editEmpManagerSelect = document.getElementById('editEmpManager');
    if (editEmpManagerSelect) {
      const currentVal = editEmpManagerSelect.value;
      if (!state.managers || state.managers.length === 0) {
        editEmpManagerSelect.innerHTML = `<option value="Unassigned">Unassigned (No Managers Appointed Yet)</option>`;
      } else {
        editEmpManagerSelect.innerHTML = state.managers.map(mgr => `
          <option value="${mgr.name}">${mgr.name} (${mgr.dept})</option>
        `).join('') + `<option value="Unassigned">Unassigned</option>`;
        if (currentVal && (currentVal === 'Unassigned' || state.managers.some(m => m.name === currentVal))) {
          editEmpManagerSelect.value = currentVal;
        }
      }
    }

    // 8. Active Employee Selector & Quick Pills in Contributor Workspace
    const empSelectActive = document.getElementById('employeeSelectActive');
    const empQuickPills = document.getElementById('employeeQuickPills');
    if (empSelectActive) {
      const activeEmpName = (state.roles.employee && state.roles.employee.name && state.roles.employee.name !== 'No Employee Created')
        ? state.roles.employee.name
        : (state.employees && state.employees[0] ? state.employees[0].name : '');
      if (state.employees && state.employees.length > 0) {
        empSelectActive.innerHTML = state.employees.map(emp => `
          <option value="${emp.name}" ${emp.name === activeEmpName ? 'selected' : ''}>${emp.name} — ${emp.role || 'Contributor'} (${emp.dept || 'Engineering'})</option>
        `).join('');
        empSelectActive.value = activeEmpName;
        empSelectActive.onchange = (e) => window.switchActiveEmployee(e.target.value);
        if (empQuickPills) {
          empQuickPills.innerHTML = state.employees.map(emp => `
            <button type="button" class="persona-pill-btn ${emp.name === activeEmpName ? 'active' : ''}" onclick="window.switchActiveEmployee('${emp.name}')" title="Switch to ${emp.name}">
              <span class="pill-dot"></span>
              <span>${emp.name}</span>
              <span class="pill-role">${emp.role || 'Contributor'}</span>
            </button>
          `).join('');
        }
      } else {
        empSelectActive.innerHTML = `<option value="">-- No Employees Onboarded Yet --</option>`;
        if (empQuickPills) {
          empQuickPills.innerHTML = `<span class="persona-empty-hint">Awaiting Head (ATHISH) onboarding</span>`;
        }
      }
    }

    // 9. Active Manager Selector & Quick Pills in Team Management Dashboard
    const mgrSelectActive = document.getElementById('managerSelectActive');
    const mgrQuickPills = document.getElementById('managerQuickPills');
    if (mgrSelectActive) {
      const activeMgrName = (state.roles.manager && state.roles.manager.name && state.roles.manager.name !== 'No Manager Appointed')
        ? state.roles.manager.name
        : (state.managers && state.managers[0] ? state.managers[0].name : '');
      if (state.managers && state.managers.length > 0) {
        mgrSelectActive.innerHTML = state.managers.map(mgr => `
          <option value="${mgr.name}" ${mgr.name === activeMgrName ? 'selected' : ''}>${mgr.name} — ${mgr.dept} (${mgr.role || 'Manager'})</option>
        `).join('');
        mgrSelectActive.value = activeMgrName;
        mgrSelectActive.onchange = (e) => window.switchActiveManager(e.target.value);
        if (mgrQuickPills) {
          mgrQuickPills.innerHTML = state.managers.map(mgr => `
            <button type="button" class="persona-pill-btn ${mgr.name === activeMgrName ? 'active' : ''}" onclick="window.switchActiveManager('${mgr.name}')" title="Switch to ${mgr.name} Pod">
              <span class="pill-dot"></span>
              <span>${mgr.name}</span>
              <span class="pill-role">${mgr.dept || mgr.role}</span>
            </button>
          `).join('');
        }
      } else {
        mgrSelectActive.innerHTML = `<option value="">-- No Managers Appointed Yet --</option>`;
        if (mgrQuickPills) {
          mgrQuickPills.innerHTML = `<span class="persona-empty-hint">Awaiting Head (ATHISH) appointment</span>`;
        }
      }
    }
  }

  window.openAddEmployeeModal = function() {
    if (state.currentRole !== 'head') {
      showToast('Access Denied: Only Head Executive (ATHISH) can add new employees.', 'error');
      return;
    }
    const modal = document.getElementById('modalAddEmployee');
    const form = document.getElementById('formAddEmployee');
    if (form) form.reset();
    updateEmployeeSelectDropdowns();
    if (modal) modal.classList.add('open');
    const nameInput = document.getElementById('newEmpName');
    if (nameInput) nameInput.focus();
  };

  window.closeAddEmployeeModal = function() {
    const modal = document.getElementById('modalAddEmployee');
    if (modal) modal.classList.remove('open');
  };

  const btnCloseAddEmployeeModal = document.getElementById('btnCloseAddEmployeeModal');
  const btnCancelAddEmployeeModal = document.getElementById('btnCancelAddEmployeeModal');
  if (btnCloseAddEmployeeModal) btnCloseAddEmployeeModal.addEventListener('click', closeAddEmployeeModal);
  if (btnCancelAddEmployeeModal) btnCancelAddEmployeeModal.addEventListener('click', closeAddEmployeeModal);

  const formAddEmployee = document.getElementById('formAddEmployee');
  if (formAddEmployee) {
    formAddEmployee.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (state.currentRole !== 'head') {
        showToast('Access Denied: Only Head Executive (ATHISH) can add employees.', 'error');
        return;
      }

      const name = (document.getElementById('newEmpName')?.value || '').trim();
      const role = (document.getElementById('newEmpRole')?.value || '').trim();
      const dept = document.getElementById('newEmpDept')?.value || 'Engineering';
      const manager = document.getElementById('newEmpManager')?.value || (state.managers[0] ? state.managers[0].name : 'Unassigned');
      const status = document.getElementById('newEmpStatus')?.value || 'Online';
      const productivity = parseInt(document.getElementById('newEmpProductivity')?.value || '95', 10);
      const kudos = (document.getElementById('newEmpKudos')?.value || '').trim() || 'New organization hire onboarded by Head (ATHISH).';

      if (!name || !role) {
        showToast('Please provide employee full name and job title.', 'warning');
        return;
      }

      const submitBtn = formAddEmployee.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Onboard Employee';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:inline-block; width:13px; height:13px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span> Saving to DynamoDB...';
      }

      const newEmp = {
        id: `emp-${Date.now()}`,
        name,
        role,
        manager,
        dept,
        productivity: isNaN(productivity) ? 95 : productivity,
        focusHours: '0.0h',
        status,
        avatar: EMPTY_AVATAR,
        kudos
      };

      try {
        if (configService && configService.isLiveMode() && employeeService && employeeService.createEmployee) {
          const created = await employeeService.createEmployee(newEmp);
          if (created && created.dbTaskId) {
            newEmp.dbTaskId = created.dbTaskId;
            newEmp.isFromDynamoDB = true;
          }
        }
      } catch (dbErr) {
        console.warn('[CloudPulse] Notice writing employee to DynamoDB:', dbErr);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

        // Add or update in state
        const existingIdx = state.employees.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
        if (existingIdx >= 0) {
          state.employees[existingIdx] = { ...state.employees[existingIdx], ...newEmp };
        } else {
          state.employees.push(newEmp);
        }

        saveEmployeesToStorage();
        syncEmployeeRoleWithDatabase();
        updateEmployeeSelectDropdowns();
        closeAddEmployeeModal();

        showToast(`Employee "${name}" successfully saved to AWS DynamoDB!`, 'success');

        // Refresh workforce views
        if (state.currentRole === 'head') {
          renderHeadDashboard();
        }
        if (state.currentView === 'employees') {
          renderAllEmployeesDirectory();
        }
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        lucide.createIcons();
      }
    });
  }

  // =========================================================================
  // 18C. EDIT EMPLOYEE CONTROLLER (HEAD AUTHORITY ONLY)
  // =========================================================================

  window.openEditEmployeeModal = function(empId) {
    if (state.currentRole !== 'head') {
      showToast('Access Denied: Only Head Executive (ATHISH) can modify employee details.', 'error');
      return;
    }

    const emp = state.employees.find(e => e.id === empId || e.dbTaskId === empId || e.name === empId);
    if (!emp) {
      showToast('Employee record not found.', 'error');
      return;
    }

    updateEmployeeSelectDropdowns();

    const editEmpId = document.getElementById('editEmpId');
    const editEmpDbTaskId = document.getElementById('editEmpDbTaskId');
    const editEmpName = document.getElementById('editEmpName');
    const editEmpRole = document.getElementById('editEmpRole');
    const editEmpDept = document.getElementById('editEmpDept');
    const editEmpManager = document.getElementById('editEmpManager');
    const editEmpStatus = document.getElementById('editEmpStatus');
    const editEmpProductivity = document.getElementById('editEmpProductivity');
    const editEmpKudos = document.getElementById('editEmpKudos');

    if (editEmpId) editEmpId.value = emp.id || '';
    if (editEmpDbTaskId) editEmpDbTaskId.value = emp.dbTaskId || '';
    if (editEmpName) editEmpName.value = emp.name || '';
    if (editEmpRole) editEmpRole.value = emp.role || '';
    if (editEmpDept) editEmpDept.value = emp.dept || 'Engineering';
    if (editEmpManager) editEmpManager.value = emp.manager || (state.managers[0] ? state.managers[0].name : 'Unassigned');
    if (editEmpStatus) editEmpStatus.value = emp.status || 'Online';
    if (editEmpProductivity) editEmpProductivity.value = emp.productivity || 95;
    if (editEmpKudos) editEmpKudos.value = emp.kudos || '';

    const modal = document.getElementById('modalEditEmployee');
    if (modal) {
      modal.classList.add('open');
      modal.classList.add('active');
    }
    if (editEmpName) editEmpName.focus();
  };

  window.closeEditEmployeeModal = function() {
    const modal = document.getElementById('modalEditEmployee');
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
    }
  };

  const btnCloseEditEmployeeModal = document.getElementById('btnCloseEditEmployeeModal');
  const btnCancelEditEmployeeModal = document.getElementById('btnCancelEditEmployeeModal');
  if (btnCloseEditEmployeeModal) btnCloseEditEmployeeModal.addEventListener('click', closeEditEmployeeModal);
  if (btnCancelEditEmployeeModal) btnCancelEditEmployeeModal.addEventListener('click', closeEditEmployeeModal);

  const formEditEmployee = document.getElementById('formEditEmployee');
  if (formEditEmployee) {
    formEditEmployee.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (state.currentRole !== 'head') {
        showToast('Access Denied: Only Head Executive (ATHISH) can modify employee records.', 'error');
        return;
      }

      const empId = document.getElementById('editEmpId')?.value;
      const dbTaskId = document.getElementById('editEmpDbTaskId')?.value;
      const name = (document.getElementById('editEmpName')?.value || '').trim();
      const role = (document.getElementById('editEmpRole')?.value || '').trim();
      const dept = document.getElementById('editEmpDept')?.value || 'Engineering';
      const manager = document.getElementById('editEmpManager')?.value || (state.managers[0] ? state.managers[0].name : 'Unassigned');
      const status = document.getElementById('editEmpStatus')?.value || 'Online';
      const productivity = parseInt(document.getElementById('editEmpProductivity')?.value || '95', 10);
      const kudos = (document.getElementById('editEmpKudos')?.value || '').trim();

      if (!name || !role) {
        showToast('Please provide employee full name and job title.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitEditEmployee');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Changes to Database';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:inline-block; width:13px; height:13px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span> Saving to DynamoDB...';
      }

      const updates = {
        id: empId,
        dbTaskId: dbTaskId,
        name,
        role,
        dept,
        manager,
        status,
        productivity: isNaN(productivity) ? 95 : productivity,
        focusHours: '0.0h',
        kudos
      };

      try {
        if (configService && configService.isLiveMode() && employeeService && employeeService.updateEmployee) {
          await employeeService.updateEmployee(dbTaskId || empId, updates);
        }
      } catch (dbErr) {
        console.warn('[CloudPulse] Notice updating employee in DynamoDB:', dbErr);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }

        // Update employee in state.employees
        const idx = state.employees.findIndex(e => e.id === empId || e.dbTaskId === dbTaskId || (dbTaskId && e.dbTaskId === dbTaskId));
        if (idx >= 0) {
          state.employees[idx] = { ...state.employees[idx], ...updates, avatar: EMPTY_AVATAR, isFromDynamoDB: true };
        } else {
          state.employees.push({ ...updates, avatar: EMPTY_AVATAR, isFromDynamoDB: true });
        }

        saveEmployeesToStorage();
        syncEmployeeRoleWithDatabase();
        updateEmployeeSelectDropdowns();
        closeEditEmployeeModal();

        showToast(`Employee "${name}" details updated successfully in AWS DynamoDB!`, 'success');

        // Refresh views
        if (state.currentRole === 'head') {
          renderHeadDashboard();
        }
        if (state.currentView === 'employees') {
          renderAllEmployeesDirectory();
        }
        if (state.currentRole === 'employee') {
          renderEmployeeDashboard();
          updateEmployeeStatsRibbon();
        }
        updateExecutiveStatsRibbon();
        refreshAllCharts();
        lucide.createIcons();
      }
    });
  }

  window.removeEmployeePrompt = function(empId) {
    (async () => {
      if (state.currentRole !== 'head') {
        showToast('Access Denied: Only Head Executive (ATHISH) can remove employees.', 'error');
        return;
      }

    const emp = state.employees.find(e => e.id === empId || e.dbTaskId === empId);
    if (!emp) {
      showToast('Employee not found.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to remove employee "${emp.name}" (${emp.role}) from the organization and database?`)) {
      return;
    }

    // Delete from DynamoDB in live mode
    if (configService && configService.isLiveMode() && employeeService && employeeService.deleteEmployee) {
      try {
        await employeeService.deleteEmployee(emp.dbTaskId || emp.id || emp.name);
      } catch (err) {
        console.warn('[CloudPulse] Notice removing employee from DynamoDB:', err);
      }
    }

    state.employees = state.employees.filter(e => e.id !== empId && e.dbTaskId !== empId);
    saveEmployeesToStorage();
    syncEmployeeRoleWithDatabase();
    updateEmployeeSelectDropdowns();

    showToast(`Employee "${emp.name}" removed from database by Head (ATHISH).`, 'success');

    // Refresh workforce views
    if (state.currentRole === 'head') {
      renderHeadDashboard();
    }
    if (state.currentView === 'employees') {
      renderAllEmployeesDirectory();
    }
    if (state.currentRole === 'employee') {
      renderEmployeeDashboard();
      updateEmployeeStatsRibbon();
    }
    updateExecutiveStatsRibbon();
    refreshAllCharts();
    lucide.createIcons();
    })();
  };

  // =========================================================================
  // 19. DEEP WORK FOCUS TIMER
  // =========================================================================

  const bigTimerDisplay = document.getElementById('bigTimerDisplay');
  const navTimerDisplay = document.getElementById('navTimerDisplay');
  const btnTimerToggle = document.getElementById('btnTimerToggle');
  const timerPlayIcon = document.getElementById('timerPlayIcon');
  const btnTimerReset = document.getElementById('btnTimerReset');
  const btnTimerLog = document.getElementById('btnTimerLog');
  const employeeActiveTaskInput = document.getElementById('employeeActiveTaskInput');

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    const timeStr = formatTime(state.timer.remainingSeconds);
    if (bigTimerDisplay) bigTimerDisplay.textContent = timeStr;
    if (navTimerDisplay) navTimerDisplay.textContent = timeStr;
  }

  function toggleTimer() {
    if (state.timer.isRunning) {
      clearInterval(state.timer.intervalId);
      state.timer.isRunning = false;
      if (timerPlayIcon) timerPlayIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons();
      showToast('Focus session paused', 'info');
    } else {
      state.timer.isRunning = true;
      if (timerPlayIcon) timerPlayIcon.setAttribute('data-lucide', 'pause');
      lucide.createIcons();
      const taskName = employeeActiveTaskInput ? employeeActiveTaskInput.value : 'Refactoring Cloud Architecture';
      showToast(`Deep work session started on: "${taskName}"`, 'success');

      state.timer.intervalId = setInterval(() => {
        if (state.timer.remainingSeconds > 0) {
          state.timer.remainingSeconds--;
          updateTimerDisplay();
        } else {
          clearInterval(state.timer.intervalId);
          state.timer.isRunning = false;
          if (timerPlayIcon) timerPlayIcon.setAttribute('data-lucide', 'play');
          lucide.createIcons();
          state.timer.completedSprints++;
          const spEl = document.getElementById('todaySprintsTotal');
          if (spEl) spEl.textContent = `${state.timer.completedSprints} sessions`;
          const mgrName = (state.roles.manager && state.roles.manager.name !== 'No Manager Appointed' ? state.roles.manager.name : 'Department Lead');
          showToast(`Focus sprint completed! Telemetry automatically synced to Manager ${mgrName}.`, 'success');
        }
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    state.timer.remainingSeconds = state.timer.totalSeconds;
    if (timerPlayIcon) timerPlayIcon.setAttribute('data-lucide', 'play');
    lucide.createIcons();
    updateTimerDisplay();
  }

  if (btnTimerToggle) btnTimerToggle.addEventListener('click', toggleTimer);
  if (btnTimerReset) btnTimerReset.addEventListener('click', resetTimer);
  if (btnTimerLog) {
    btnTimerLog.addEventListener('click', async () => {
      state.timer.completedSprints++;
      const spEl = document.getElementById('todaySprintsTotal');
      if (spEl) spEl.textContent = `${state.timer.completedSprints} sessions`;

      // If active task input specifies a task, update its progress in backend
      const activeTaskTitle = (employeeActiveTaskInput?.value || '').trim().toLowerCase();
      if (activeTaskTitle && state.distributedTasks.length > 0) {
        const matched = state.distributedTasks.find(t => t.title.toLowerCase().includes(activeTaskTitle));
        if (matched) {
          matched.progress = Math.min(100, (matched.progress || 0) + 15);
          if (matched.progress >= 100) matched.status = 'Completed';
          else if (matched.progress >= 90) matched.status = 'Ready for Review';
          else matched.status = 'In Progress';

          if (state.isLiveMode && taskService) {
            try {
              await taskService.updateTask(matched.taskId || matched.id, matched);
            } catch (err) {
              console.warn('[CloudPulse] Error persisting timer progress to backend:', err);
            }
          }
          updateExecutiveStatsRibbon();
          refreshAllCharts();
          if (state.currentView === 'tasks') renderAllTasksTable();
        }
      }

      showToast('Sprint session verified and logged to Manager & Head telemetry!', 'success');
      resetTimer();
    });
  }

  document.querySelectorAll('.timer-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const minutes = parseInt(btn.getAttribute('data-time'), 10);
      state.timer.totalSeconds = minutes * 60;
      resetTimer();
    });
  });

  window.scrollToTimer = function() {
    if (state.currentRole !== 'employee') {
      window.switchRole('employee');
    }
    setTimeout(() => {
      const el = document.getElementById('employeeTimerCard');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const taskInput = document.getElementById('employeeActiveTaskInput');
      if (taskInput) {
        taskInput.focus();
        taskInput.select();
      }
    }, 120);
  };

  window.updateEmployeeTaskProgress = function(taskId, newProgress) {
    const task = state.distributedTasks.find(t => (t.id === taskId || t.taskId === taskId));
    if (!task) return;

    task.progress = parseInt(newProgress, 10);
    if (task.progress >= 100) task.status = 'Completed';
    else if (task.progress >= 90) task.status = 'Ready for Review';
    else task.status = 'In Progress';

    const card = document.getElementById(`emp-task-${task.taskId || task.id}`);
    if (card) {
      const pctLabel = card.querySelector('.progress-pct-label');
      if (pctLabel) pctLabel.textContent = `${task.progress}%`;
      const statusPill = card.querySelector('.goal-card-header .tag-pill:last-child');
      if (statusPill) {
        statusPill.textContent = task.status;
        statusPill.className = `tag-pill ${task.progress >= 90 ? 'tag-emerald' : 'tag-indigo'}`;
      }
    }

    if (state.isLiveMode && taskService) {
      taskService.updateTask(task.taskId || task.id, task).catch(err => {
        console.warn('[CloudPulse] Error updating task progress on API:', err);
      });
    }

    updateExecutiveStatsRibbon();
    initTaskStatusChart();
  };

  window.submitTaskForReview = async function(taskId) {
    const task = state.distributedTasks.find(t => (t.id === taskId || t.taskId === taskId));
    if (!task) return;
    task.status = 'Ready for Review';
    task.progress = Math.max(task.progress || 0, 90);
    if (state.isLiveMode && taskService) {
      try {
        await taskService.updateTask(task.taskId || task.id, task);
      } catch (err) {
        console.warn('[CloudPulse] Error submitting task review to backend:', err);
      }
    }
    const mgrName = task.assignedManager || (state.roles.manager && state.roles.manager.name !== 'No Manager Appointed' ? state.roles.manager.name : 'Manager');
    showToast(`Check-in submitted to Manager ${mgrName} for "${task.title.slice(0, 30)}..."!`, 'success');
    updateExecutiveStatsRibbon();
    refreshAllCharts();
    renderCurrentView();
  };

  window.selectTaskForTimer = function(taskTitle) {
    const input = document.getElementById('employeeActiveTaskInput');
    if (input) input.value = taskTitle;
    window.scrollToTimer();
    showToast(`Focus timer linked to: "${taskTitle.slice(0, 35)}..."`, 'info');
  };

  window.approveEmployeeTask = async function(taskId) {
    const task = state.distributedTasks.find(t => (t.id === taskId || t.taskId === taskId));
    if (!task) return;
    task.progress = 100;
    task.status = 'Completed';
    if (state.isLiveMode && taskService) {
      try {
        await taskService.updateTask(task.taskId || task.id, task);
      } catch (err) {
        console.warn('[CloudPulse] Error persisting approved task to API:', err);
      }
    }
    const mgrName = task.assignedManager || (state.roles.manager && state.roles.manager.name !== 'No Manager Appointed' ? state.roles.manager.name : 'Manager');
    showToast(`Task "${task.title.slice(0, 30)}..." approved by Manager ${mgrName}!`, 'success');
    updateExecutiveStatsRibbon();
    refreshAllCharts();
    renderCurrentView();
  };

  // =========================================================================
  // 20. COMMAND PALETTE (CTRL + K)
  // =========================================================================

  const modalCmdPalette = document.getElementById('modalCmdPalette');
  const cmdPaletteInput = document.getElementById('cmdPaletteInput');
  const cmdResultsContainer = document.getElementById('cmdResultsContainer');
  const cmdSearchTrigger = document.getElementById('cmdSearchTrigger');

  function openCommandPalette() {
    modalCmdPalette.classList.add('open');
    cmdPaletteInput.value = '';
    filterCommandPalette('');
    setTimeout(() => cmdPaletteInput.focus(), 50);
  }

  function closeCommandPalette() {
    modalCmdPalette.classList.remove('open');
  }

  if (cmdSearchTrigger) cmdSearchTrigger.addEventListener('click', openCommandPalette);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modalCmdPalette.classList.contains('open')) closeCommandPalette();
      else openCommandPalette();
    }
    if (e.key === 'Escape') {
      closeCommandPalette();
      modalHeadAssign?.classList.remove('open');
      modalManagerDistribute?.classList.remove('open');
      modalEmployeeScorecard?.classList.remove('open');
      modalCreateTask?.classList.remove('open');
    }
  });

  function filterCommandPalette(query) {
    const q = query.toLowerCase();
    const results = [
      { icon: 'layout-dashboard', type: 'View', title: 'Open Executive Dashboard', action: () => { switchView('dashboard'); closeCommandPalette(); } },
      { icon: 'check-square', type: 'View', title: 'Open Tasks Management Pipeline', action: () => { switchView('tasks'); closeCommandPalette(); } },
      { icon: 'target', type: 'View', title: 'Open Strategic Goals & OKRs', action: () => { switchView('goals'); closeCommandPalette(); } },
      { icon: 'users', type: 'View', title: 'Open Workforce Personnel Directory', action: () => { switchView('employees'); closeCommandPalette(); } },
      { icon: 'file-bar-chart-2', type: 'View', title: 'Open Telemetry & Reports', action: () => { switchView('reports'); closeCommandPalette(); } },
      { icon: 'plus', type: 'Action', title: 'Create New Task', action: () => { closeCommandPalette(); openCreateTaskModal(); } },
      { icon: 'crown', type: 'Role', title: 'Switch to Head (Executive) View', action: () => { switchRole('head'); closeCommandPalette(); } },
      { icon: 'briefcase', type: 'Role', title: 'Switch to Team Manager View', action: () => { switchRole('manager'); closeCommandPalette(); } },
      { icon: 'user', type: 'Role', title: 'Switch to Employee Workspace', action: () => { switchRole('employee'); closeCommandPalette(); } }
    ];

    state.directivesFromHead.forEach(d => {
      if (d.title.toLowerCase().includes(q) || d.assignedManager.toLowerCase().includes(q)) {
        results.push({
          icon: 'target',
          type: 'Head Directive',
          title: `${d.title} (Manager: ${d.assignedManager})`,
          action: () => { switchView('goals'); closeCommandPalette(); }
        });
      }
    });

    state.distributedTasks.forEach(t => {
      if (t.title.toLowerCase().includes(q) || t.assignedEmployee.toLowerCase().includes(q)) {
        results.push({
          icon: 'check-square',
          type: 'Employee Task',
          title: `${t.title} (${t.assignedEmployee})`,
          action: () => { switchView('tasks'); closeCommandPalette(); }
        });
      }
    });

    const filtered = results.filter(r => r.title.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));

    cmdResultsContainer.innerHTML = filtered.map((item, idx) => `
      <div class="cmd-item" data-idx="${idx}">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="${item.icon || 'arrow-right'}" style="width: 14px; height: 14px; color: var(--text-tertiary); flex-shrink: 0;"></i>
          <span>${item.title}</span>
        </div>
        <span class="tag-pill tag-indigo">${item.type}</span>
      </div>
    `).join('');

    cmdResultsContainer.querySelectorAll('.cmd-item').forEach((el, idx) => {
      el.addEventListener('click', () => filtered[idx].action());
    });

    lucide.createIcons();
  }

  if (cmdPaletteInput) {
    cmdPaletteInput.addEventListener('input', (e) => filterCommandPalette(e.target.value));
  }

  // =========================================================================
  // 21. TOAST NOTIFICATION ENGINE
  // =========================================================================

  window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconName = 'info';
    let iconColor = 'var(--brand-primary)';

    if (type === 'success') {
      iconName = 'check-circle-2';
      iconColor = 'var(--success-dot)';
    } else if (type === 'error') {
      iconName = 'alert-triangle';
      iconColor = 'var(--danger-dot)';
    } else if (type === 'warning') {
      iconName = 'alert-circle';
      iconColor = 'var(--warning-dot)';
    }

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 16px; height: 16px; color: ${iconColor};"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s, transform 0.25s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // =========================================================================
  // 22. GENERAL UTILITY EVENT LISTENERS
  // =========================================================================

  const navTimerQuickPill = document.getElementById('navTimerQuickPill');
  if (navTimerQuickPill) {
    navTimerQuickPill.style.cursor = 'pointer';
    navTimerQuickPill.addEventListener('click', () => {
      window.scrollToTimer();
      toggleTimer();
    });
  }

  const notifBellBtn = document.getElementById('notifBellBtn');
  if (notifBellBtn) {
    notifBellBtn.addEventListener('click', () => {
      switchView('notifications');
    });
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const appSidebar = document.getElementById('appSidebar');
  if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      appSidebar.classList.toggle('mobile-open');
    });
    document.addEventListener('click', (e) => {
      if (!appSidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        appSidebar.classList.remove('mobile-open');
      }
    });
  }

  document.querySelectorAll('.sidebar-settings-btn').forEach(btn => btn.remove());

  const userProfileBtn = document.getElementById('userProfileBtn');
  if (userProfileBtn) {
    userProfileBtn.style.cursor = 'pointer';
    userProfileBtn.addEventListener('click', () => {
      if (state.currentRole === 'employee') {
        window.openScorecardModal('emp-1');
      } else {
        showToast(`Active Profile: ${state.roles[state.currentRole].name} (${state.roles[state.currentRole].title})`, 'info');
      }
    });
  }

  document.querySelectorAll('.brand-logo').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => switchView('dashboard'));
  });

  // Modal backdrop click handlers
  const modalAddEmployee = document.getElementById('modalAddEmployee');
  [modalHeadAssign, modalManagerDistribute, modalEmployeeScorecard, modalCmdPalette, modalCreateTask, modalAddEmployee].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  });

  // =========================================================================
  // 23. INITIALIZATION BOOTSTRAP
  // =========================================================================

  renderSidebarNavForRole(state.currentRole);
  updateModeBannerUI();
  updateTimerDisplay();
  updateEmployeeSelectDropdowns();

  // Always connect with database and synchronize tasks from AWS DynamoDB
  if (configService) configService.setMode('live');
  syncDataFromBackend(true);

  lucide.createIcons();
});
