/**
 * CLOUDPULSE LIVE METADATA PERSISTENCE & BIDIRECTIONAL BACKEND SYNC TEST
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

async function runLiveSyncTest() {
  console.log('\n=== RUNNING LIVE AWS BACKEND METADATA & PERSISTENCE TEST ===\n');

  const taskService = CloudPulseAPI.taskService;

  // Step 1: Create a task with full frontend metadata
  console.log('[1] Creating task with full metadata on live AWS backend...');
  const initialTaskData = {
    title: 'Automated Live Sync Verification Task',
    parentDirective: 'Scale Cloud Microservices Architecture for 10M DAU',
    assignedEmployee: 'David Kim',
    assignedManager: 'Maya Patel',
    dueDate: '2026-11-28',
    estHours: 24,
    progress: 60,
    status: 'In Progress',
    priority: 'HIGH'
  };

  const created = await taskService.createTask(initialTaskData);
  const taskId = created.taskId;
  console.log(`  Created task ID: ${taskId}`);

  assert(Boolean(taskId), 'Task ID received from DynamoDB');
  assert(created.title === initialTaskData.title, 'Created title matches input');
  assert(created.assignedEmployee === 'David Kim', 'Created assignee preserved as David Kim');
  assert(created.assignedManager === 'Maya Patel', 'Created manager preserved as Maya Patel');
  assert(created.parentDirective === initialTaskData.parentDirective, 'Created directive preserved');
  assert(created.dueDate === '2026-11-28', 'Created due date preserved');
  assert(created.status === 'In Progress', 'Created status preserved as In Progress');

  // Step 2: Fetch task by ID from live AWS API
  console.log('\n[2] Fetching task by ID directly from DynamoDB via GET /tasks/{id}...');
  const fetched = await taskService.getTaskById(taskId);
  assert(fetched.taskId === taskId, 'Fetched correct task ID from DynamoDB');
  assert(fetched.title === initialTaskData.title, 'Fetched title matches');
  assert(fetched.assignedEmployee === 'David Kim', 'Fetched assignee matches David Kim');
  assert(fetched.assignedManager === 'Maya Patel', 'Fetched manager matches Maya Patel');
  assert(fetched.status === 'In Progress', 'Fetched status is In Progress');

  // Step 3: Update task in live DynamoDB
  console.log('\n[3] Updating task (reassigning, changing status to Completed & progress to 100%)...');
  const updateData = {
    ...fetched,
    title: 'Automated Live Sync Task - Updated',
    assignedEmployee: 'Elena Rostova',
    assignedManager: 'Alex Rivera',
    status: 'Completed',
    progress: 100
  };

  const updated = await taskService.updateTask(taskId, updateData);
  assert(updated.title === updateData.title, 'Updated title reflected');
  assert(updated.assignedEmployee === 'Elena Rostova', 'Updated assignee reflected as Elena Rostova');
  assert(updated.assignedManager === 'Alex Rivera', 'Updated manager reflected as Alex Rivera');
  assert(updated.status === 'Completed', 'Updated status reflected as Completed');
  assert(updated.progress === 100, 'Updated progress reflected as 100%');

  // Step 4: Re-fetch from GET /tasks/{id} to verify DynamoDB actually saved the update
  console.log('\n[4] Re-fetching from GET /tasks/{id} to verify DynamoDB persistent storage...');
  const reFetched = await taskService.getTaskById(taskId);
  assert(reFetched.assignedEmployee === 'Elena Rostova', 'DynamoDB permanently stored new assignee');
  assert(reFetched.assignedManager === 'Alex Rivera', 'DynamoDB permanently stored new manager');
  assert(reFetched.status === 'Completed', 'DynamoDB permanently stored Completed status');

  // Step 5: Delete task from live DynamoDB
  console.log('\n[5] Deleting task from DynamoDB via DELETE /tasks/{id}...');
  await taskService.deleteTask(taskId);
  console.log(`  Deleted task ID: ${taskId}`);

  // Step 6: Verify deletion in DynamoDB
  const allTasks = await taskService.getTasks();
  const exists = allTasks.some(t => t.taskId === taskId || t.id === taskId);
  assert(!exists, 'Task successfully purged from AWS DynamoDB table');

  console.log(`\n=== LIVE SYNC TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runLiveSyncTest().catch(err => {
  console.error('Fatal live sync test error:', err);
  process.exit(1);
});
