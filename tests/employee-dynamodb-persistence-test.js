/**
 * CLOUDPULSE SUITE 4: EMPLOYEE DYNAMODB PERSISTENCE & LIFECYCLE TEST
 */

const CloudPulseAPI = require('../api-client.js');

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runEmployeeDynamoDbTest() {
  console.log('\n=== RUNNING EMPLOYEE DYNAMODB PERSISTENCE & SYNC TEST ===\n');

  const employeeService = CloudPulseAPI.employeeService;
  const taskService = CloudPulseAPI.taskService;
  const configService = CloudPulseAPI.configService;

  configService.saveConfig({ baseUrl: 'https://zpbpv26plb.execute-api.ap-south-1.amazonaws.com/prod', authMode: 'none' });
  configService.setMode('live');

  // Test 1: Create Employee in DynamoDB table CloudPulse-Tasks
  console.log('[1] Creating Employee in DynamoDB table CloudPulse-Tasks...');
  const testEmpData = {
    name: 'Sarah Connor',
    role: 'Cybersecurity Threat Lead',
    dept: 'Security',
    manager: 'Maya Patel',
    productivity: 99,
    focusHours: '42.5h',
    status: 'Deep Work',
    kudos: 'Validated automated zero-trust authorization pipeline'
  };

  const created = await employeeService.createEmployee(testEmpData);
  assert(Boolean(created && created.dbTaskId), `Employee created in DynamoDB with dbTaskId: ${created?.dbTaskId}`);
  assert(created.name === testEmpData.name, 'Created employee name preserved');
  assert(created.isFromDynamoDB === true, 'Flagged as isFromDynamoDB');

  const empDbId = created.dbTaskId;

  // Test 2: Fetch Employees from DynamoDB
  console.log('\n[2] Fetching Employees from DynamoDB...');
  const dbEmployees = await employeeService.getEmployees();
  assert(Array.isArray(dbEmployees), `Retrieved ${dbEmployees.length} employee(s) from DynamoDB`);
  const foundEmp = dbEmployees.find(e => e.name === testEmpData.name || e.dbTaskId === empDbId);
  assert(Boolean(foundEmp), `Successfully found "${testEmpData.name}" in DynamoDB employee records`);
  assert(foundEmp && foundEmp.role === testEmpData.role, 'Fetched role matches input');
  assert(foundEmp && foundEmp.manager === testEmpData.manager, 'Fetched manager matches input');

  // Test 2B: Update Employee in DynamoDB
  console.log('\n[2B] Updating Employee in DynamoDB...');
  const updatedEmpResult = await employeeService.updateEmployee(empDbId, {
    ...testEmpData,
    dbTaskId: empDbId,
    role: 'Principal Security Architect',
    productivity: 100
  });
  assert(Boolean(updatedEmpResult), 'updateEmployee completed');

  // Verify persistent update from fresh DynamoDB query
  const dbEmployeesAfterUpdate = await employeeService.getEmployees();
  const updatedEmp = dbEmployeesAfterUpdate.find(e => e.dbTaskId === empDbId || e.name === testEmpData.name);
  assert(Boolean(updatedEmp && updatedEmp.role === 'Principal Security Architect'), 'DynamoDB permanently stored updated role (Principal Security Architect)');
  assert(Boolean(updatedEmp && updatedEmp.productivity === 100), 'DynamoDB permanently stored updated productivity rating (100)');

  // Test 3: Verify TaskService.getTasks filters out Employee records
  console.log('\n[3] Verifying TaskService.getTasks isolates tasks from employee records...');
  const tasks = await taskService.getTasks();
  const foundInTasks = tasks.some(t => (t.title && t.title.includes(testEmpData.name)) || (t.title && t.title.startsWith('[EMPLOYEE]')));
  assert(!foundInTasks, 'TaskService properly filtered out [EMPLOYEE] records from task lists');

  // Test 4: Delete Employee from DynamoDB
  console.log('\n[4] Deleting Employee from DynamoDB...');
  await employeeService.deleteEmployee(empDbId);
  console.log('  Delete request completed for', empDbId);

  // Test 5: Verify employee removed from DynamoDB
  console.log('\n[5] Verifying Employee record is purged from DynamoDB...');
  const updatedDbEmployees = await employeeService.getEmployees();
  const stillExists = updatedDbEmployees.some(e => e.dbTaskId === empDbId || e.name === testEmpData.name);
  assert(!stillExists, 'Employee record successfully purged from AWS DynamoDB table');

  console.log(`\n=== EMPLOYEE DYNAMODB TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runEmployeeDynamoDbTest().catch(err => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
