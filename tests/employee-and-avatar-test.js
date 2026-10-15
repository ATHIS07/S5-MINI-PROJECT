/**
 * CLOUDPULSE SUITE 2: ATHISH EXECUTIVE, EMPTY AVATAR & HEAD EMPLOYEE ACCESS TEST
 */

const fs = require('fs');
const path = require('path');

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

async function runAudit() {
  console.log('\n=== RUNNING CLOUDPULSE AUDIT: EXECUTIVE, AVATAR & HEAD ACCESS ===\n');

  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');

  // Test 1: Check no photographic avatar image files are referenced
  console.log('[1] Checking Avatar & Profile Photo Specifications...');
  assert(!indexHtml.includes('assets/images/avatar_'), 'index.html has zero photographic avatar references');
  assert(!appJs.includes('assets/images/avatar_'), 'app.js has zero photographic avatar references');
  assert(indexHtml.includes("data:image/svg+xml"), 'index.html sidebar uses empty profile photo SVG');
  assert(appJs.includes('const EMPTY_AVATAR = "data:image/svg+xml'), 'app.js defines reusable EMPTY_AVATAR SVG');

  // Test 2: Check Executive Name is ATHISH
  console.log('\n[2] Checking Executive Name Specification...');
  assert(!indexHtml.includes('Dr. Sarah Jenkins'), 'index.html contains zero references to Dr. Sarah Jenkins');
  assert(!appJs.includes('Dr. Sarah Jenkins'), 'app.js contains zero references to Dr. Sarah Jenkins');
  assert(indexHtml.includes('id="sidebarUserName">ATHISH</span>'), 'Sidebar executive user name is ATHISH');
  assert(appJs.includes("name: 'ATHISH'"), 'app.js Head role profile name is ATHISH');

  // Test 3: Check Preloaded Tasks Removal
  console.log('\n[3] Checking Preloaded Tasks Cleared for Live DB Truth...');
  assert(appJs.includes('distributedTasks: [],'), 'distributedTasks initialized to empty array []');
  assert(!appJs.includes("id: 'task-1'"), 'Preloaded mock task-1 removed');
  assert(!appJs.includes("id: 'task-2'"), 'Preloaded mock task-2 removed');
  assert(!appJs.includes("id: 'task-6'"), 'Preloaded mock task-6 removed');

  // Test 4: Check Head Access to Create, Edit, and Remove Employee
  console.log('\n[4] Checking Head Authority to Create, Edit, and Remove Employee...');
  assert(indexHtml.includes('id="btnOpenAddEmployeeModal"'), 'Add Employee button present in personnel directory');
  assert(indexHtml.includes('id="btnHeadAddEmployee"'), 'Add Employee button present in Head workforce management tab');
  assert(indexHtml.includes('id="modalAddEmployee"'), 'Add Employee modal dialog defined in index.html');
  assert(indexHtml.includes('id="modalEditEmployee"'), 'Edit Employee modal dialog defined in index.html');
  assert(indexHtml.includes('id="formEditEmployee"'), 'Edit Employee form defined in index.html');
  assert(appJs.includes('const DEFAULT_EMPLOYEES = [];'), 'DEFAULT_EMPLOYEES initialized to empty array (no AI-generated mock employees)');
  assert(appJs.includes('window.openAddEmployeeModal = function'), 'openAddEmployeeModal controller function defined');
  assert(appJs.includes('window.openEditEmployeeModal = function'), 'openEditEmployeeModal controller function defined');
  assert(appJs.includes('window.removeEmployeePrompt = function'), 'removeEmployeePrompt controller function defined');
  assert(appJs.includes("state.currentRole !== 'head'"), 'Strict role validation enforces Head authority only');
  assert(appJs.includes('saveEmployeesToStorage()'), 'Employee state persists locally on add/remove');

  console.log(`\n=== AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runAudit();
