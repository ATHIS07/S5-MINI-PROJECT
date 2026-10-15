/**
 * CLOUDPULSE FRONTEND INTEGRATION & API CLIENT TEST SUITE
 * Validates:
 * - Configuration Service (validation, persistence, mode switching)
 * - Auth Service (Bearer, Cognito, API Key headers)
 * - ApiClient (Error normalization, status codes 400, 401, 403, 404, 500, timeouts)
 * - Feature Services (Tasks, Goals, Employees, Analytics, Notifications)
 */

// Mock browser global environment if running in Node
if (typeof localStorage === 'undefined') {
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };
}

const CloudPulseAPI = require('../api-client.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n=== RUNNING CLOUDPULSE FRONTEND API INTEGRATION TEST SUITE ===\n');

  // Test 1: Configuration Service
  console.log('[1] Testing Configuration Service...');
  const cfgSvc = CloudPulseAPI.configService;
  
  assert(cfgSvc.normalizeUrl('https://api.example.com/prod/') === 'https://api.example.com/prod', 'Trailing slash normalized');
  assert(cfgSvc.normalizeUrl('  https://api.example.com/prod  ') === 'https://api.example.com/prod', 'Leading/trailing whitespace trimmed');
  
  const invalidUrl = cfgSvc.validateUrl('not-a-url');
  assert(!invalidUrl.valid, 'Invalid URL correctly rejected');
  
  const secureUrl = cfgSvc.validateUrl('https://api.example.com/prod');
  assert(secureUrl.valid, 'Valid HTTPS URL accepted');
  
  const insecureUrl = cfgSvc.validateUrl('http://insecure-api.example.com/prod');
  assert(insecureUrl.valid && Boolean(insecureUrl.warning), 'Insecure HTTP URL triggers cloud warning');

  cfgSvc.setMode('demo');
  assert(!cfgSvc.isLiveMode(), 'Demo mode active when set');
  
  cfgSvc.saveConfig({ baseUrl: 'https://test.execute-api.us-east-1.amazonaws.com/prod' });
  cfgSvc.setMode('live');
  assert(cfgSvc.isLiveMode(), 'Live mode active with valid base URL');

  // Test 2: Auth Service
  console.log('\n[2] Testing Authentication Service...');
  const authSvc = CloudPulseAPI.authService;

  // Bearer mode
  cfgSvc.saveConfig({ authMode: 'bearer', bearerToken: 'mock-jwt-token-xyz' });
  let headers = authSvc.getAuthHeaders();
  assert(headers['Authorization'] === 'Bearer mock-jwt-token-xyz', 'Bearer token header correctly formatted');

  // Cognito mode
  cfgSvc.saveConfig({ authMode: 'cognito', cognito: { token: 'mock-id-token', clientId: 'app-client-123' } });
  headers = authSvc.getAuthHeaders();
  assert(headers['Authorization'] === 'Bearer mock-id-token', 'Cognito token correctly attached as Authorization Bearer');
  assert(headers['X-Cognito-Client-Id'] === 'app-client-123', 'Cognito client ID attached');

  // API Key mode
  cfgSvc.saveConfig({ authMode: 'apikey', apiKey: 'x-key-secret-456' });
  headers = authSvc.getAuthHeaders();
  assert(headers['x-api-key'] === 'x-key-secret-456', 'x-api-key header correctly attached');

  // None mode
  cfgSvc.saveConfig({ authMode: 'none' });
  headers = authSvc.getAuthHeaders();
  assert(Object.keys(headers).length === 0, 'No auth headers attached in public mode');

  // Test 3: API Client URL Construction
  console.log('\n[3] Testing ApiClient Request Architecture...');
  const client = CloudPulseAPI.apiClient;
  cfgSvc.saveConfig({ baseUrl: 'https://api.example.com/prod' });
  
  const url1 = client.buildUrl('/tasks');
  assert(url1 === 'https://api.example.com/prod/tasks', 'Base URL and endpoint combined properly');

  const url2 = client.buildUrl('goals');
  assert(url2 === 'https://api.example.com/prod/goals', 'Endpoint without leading slash handled');

  // Duplicate path prevention
  cfgSvc.saveConfig({ baseUrl: 'https://api.example.com/prod/tasks' });
  const url3 = client.buildUrl('/tasks');
  assert(url3 === 'https://api.example.com/prod/tasks', 'Duplicate resource path in base URL avoided');

  // Test 4: Error Normalization
  console.log('\n[4] Testing HTTP Error Normalization...');
  const err400 = client.normalizeHttpError({ status: 400, statusText: 'Bad Request' }, { message: 'Invalid payload' }, 'https://api.example.com/tasks');
  assert(err400.type === 'BAD_REQUEST' && err400.status === 400, 'HTTP 400 mapped to BAD_REQUEST');

  const err401 = client.normalizeHttpError({ status: 401, statusText: 'Unauthorized' }, null, 'https://api.example.com/tasks');
  assert(err401.type === 'UNAUTHORIZED' && err401.diagnostic.includes('authentication'), 'HTTP 401 diagnostic provides auth remediation');

  const err403 = client.normalizeHttpError({ status: 403, statusText: 'Forbidden' }, null, 'https://api.example.com/tasks');
  assert(err403.type === 'FORBIDDEN' && err403.diagnostic.includes('IAM'), 'HTTP 403 diagnostic provides IAM remediation');

  const err404 = client.normalizeHttpError({ status: 404, statusText: 'Not Found' }, null, 'https://api.example.com/tasks');
  assert(err404.type === 'NOT_FOUND', 'HTTP 404 mapped to NOT_FOUND');

  const err500 = client.normalizeHttpError({ status: 500, statusText: 'Internal Server Error' }, null, 'https://api.example.com/tasks');
  assert(err500.type === 'SERVER_ERROR' && err500.diagnostic.includes('Lambda'), 'HTTP 500 provides AWS Lambda / DynamoDB diagnostic');

  // Test 5: Analytics Service Fallback Calculation
  console.log('\n[5] Testing Analytics Service Local Aggregations...');
  const analyticsSvc = CloudPulseAPI.analyticsService;
  const mockTasks = [
    { id: '1', title: 'Task 1', status: 'Completed', progress: 100, dueDate: '2026-10-01' },
    { id: '2', title: 'Task 2', status: 'In Progress', progress: 50, dueDate: '2026-10-25' },
    { id: '3', title: 'Task 3', status: 'In Progress', progress: 30, dueDate: '2026-09-01' } // overdue
  ];
  const mockGoals = [
    { id: '1', title: 'Goal 1', status: 'On Track', progress: 70 },
    { id: '2', title: 'Goal 2', status: 'Completed', progress: 100 }
  ];
  const mockEmployees = [
    { id: '1', name: 'Alice', productivity: 95 },
    { id: '2', name: 'Bob', productivity: 85 }
  ];

  const calculated = analyticsSvc.calculateMetricsFromDatasets(mockTasks, mockGoals, mockEmployees);
  assert(calculated.totalTasks === 3, 'Total tasks counted correctly (3)');
  assert(calculated.completedTasks === 1, 'Completed tasks counted correctly (1)');
  assert(calculated.pendingTasks === 2, 'Pending tasks counted correctly (2)');
  assert(calculated.overdueTasks === 1, 'Overdue tasks evaluated accurately (1)');
  assert(calculated.activeGoals === 1, 'Active goals counted correctly (1)');
  assert(calculated.completionRate === 33, 'Completion rate computed correctly (33%)');
  assert(calculated.avgProductivity === 90, 'Average productivity computed correctly (90%)');
  assert(calculated.isCalculatedLocally === true, 'Honest calculation flag set');

  // Test 6: Health Service Connection Probe
  console.log('\n[6] Testing Health Service Probe Behavior...');
  const healthSvc = CloudPulseAPI.healthService;
  const probeInvalid = await healthSvc.testConnection({ baseUrl: 'invalid-url' });
  assert(!probeInvalid.success && probeInvalid.type === 'INVALID_URL', 'Invalid URL probe safely fails before making network calls');

  // Test 7: Live AWS Backend Integration (ap-south-1 / prod)
  console.log('\n[7] Testing Live AWS API Integration against Mumbai Stage (ap-south-1)...');
  const taskSvc = CloudPulseAPI.taskService;
  cfgSvc.saveConfig({ baseUrl: 'https://zpbpv26plb.execute-api.ap-south-1.amazonaws.com/prod', authMode: 'none' });
  cfgSvc.setMode('live');

  try {
    // 7.1 GET /tasks
    const initialTasks = await taskSvc.getTasks();
    assert(Array.isArray(initialTasks), `GET /tasks succeeded and returned ${initialTasks.length} task(s)`);

    // 7.2 POST /tasks
    const testTaskPayload = {
      title: 'Automated CI/CD Validation Task',
      description: 'Testing DynamoDB persistence and schema translation',
      status: 'In Progress',
      priority: 'HIGH'
    };
    const createdTask = await taskSvc.createTask(testTaskPayload);
    assert(Boolean(createdTask && createdTask.taskId), `POST /tasks created task with taskId: ${createdTask?.taskId}`);
    assert(createdTask.title === testTaskPayload.title, 'Created task retains title');

    const createdId = createdTask.taskId;

    // 7.3 GET /tasks/{id}
    const fetchedTask = await taskSvc.getTaskById(createdId);
    assert(Boolean(fetchedTask && (fetchedTask.taskId === createdId || fetchedTask.id === createdId)), `GET /tasks/{id} retrieved created task ${createdId}`);
    assert(fetchedTask.title === testTaskPayload.title, 'Fetched task matches created title');

    // 7.4 PUT /tasks/{id}
    const updatePayload = {
      title: 'Automated CI/CD Validation Task (Updated)',
      description: 'Updated payload description',
      status: 'Completed',
      priority: 'CRITICAL'
    };
    const updatedTask = await taskSvc.updateTask(createdId, updatePayload);
    assert(Boolean(updatedTask && updatedTask.title === updatePayload.title), 'PUT /tasks/{id} updated title in DynamoDB');
    assert(updatedTask.status === 'Completed', 'PUT /tasks/{id} updated status to Completed');

    // 7.5 DELETE /tasks/{id}
    const deleteRes = await taskSvc.deleteTask(createdId);
    assert(Boolean(deleteRes && (deleteRes.message || deleteRes.success !== false)), `DELETE /tasks/{id} deleted task ${createdId}`);

    // 7.6 Verify deletion persistence
    const afterDeleteTasks = await taskSvc.getTasks();
    const stillExists = afterDeleteTasks.some(t => t.taskId === createdId || t.id === createdId);
    assert(!stillExists, 'Verified task no longer present in DynamoDB after deletion');

  } catch (liveErr) {
    console.error('  ✗ Live AWS API Error:', liveErr);
    assert(false, `Live AWS test encountered error: ${liveErr.message}`);
  }

  console.log(`\n=== RESULTS: ${passedTests} PASSED, ${failedTests} FAILED ===\n`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
