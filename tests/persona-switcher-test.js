/**
 * CLOUDPULSE SUITE 5: ACTIVE EMPLOYEE & MANAGER PERSONA SWITCHER TEST
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

function runPersonaSwitcherTests() {
  console.log('\n=== RUNNING PERSONA SWITCHER ARCHITECTURE AUDIT ===\n');

  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
  const stylesCss = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf-8');

  // [1] Index.html Verification
  console.log('[1] Checking HTML structure for Persona Switchers...');
  assert(indexHtml.includes('id="employeePersonaSwitcher"'), 'Employee persona switcher container defined in index.html');
  assert(indexHtml.includes('id="employeeSelectActive"'), 'Employee select active dropdown defined');
  assert(indexHtml.includes('id="employeeQuickPills"'), 'Employee quick pill buttons container defined');
  assert(indexHtml.includes('id="managerPersonaSwitcher"'), 'Manager persona switcher container defined in index.html');
  assert(indexHtml.includes('id="managerSelectActive"'), 'Manager select active dropdown defined');
  assert(indexHtml.includes('id="managerQuickPills"'), 'Manager quick pill buttons container defined');

  // Verify placement: employeePersonaSwitcher should be right below employeeHeaderSubtitle
  const empSubIndex = indexHtml.indexOf('id="employeeHeaderSubtitle"');
  const empSwitchIndex = indexHtml.indexOf('id="employeePersonaSwitcher"');
  assert(empSubIndex !== -1 && empSwitchIndex > empSubIndex && empSwitchIndex - empSubIndex < 500, 'Employee switcher positioned immediately below employee header name');

  // Verify placement: managerPersonaSwitcher should be right below managerHeaderSubtitle
  const mgrSubIndex = indexHtml.indexOf('id="managerHeaderSubtitle"');
  const mgrSwitchIndex = indexHtml.indexOf('id="managerPersonaSwitcher"');
  assert(mgrSubIndex !== -1 && mgrSwitchIndex > mgrSubIndex && mgrSwitchIndex - mgrSubIndex < 500, 'Manager switcher positioned immediately below manager header name');

  // Verify sidebar and navbar persona switchers
  assert(indexHtml.includes('id="sidebarPersonaSelectorWrap"'), 'Sidebar persona switcher wrapper defined in index.html');
  assert(indexHtml.includes('id="sidebarPersonaSelect"'), 'Sidebar persona select dropdown defined');
  assert(indexHtml.includes('id="navbarPersonaDropdownWrap"'), 'Navbar persona dropdown wrapper defined in index.html');
  assert(indexHtml.includes('id="navbarPersonaSelect"'), 'Navbar persona select dropdown defined');

  // [2] CSS Styling Verification
  console.log('\n[2] Checking CSS styling for Persona Switcher components...');
  assert(stylesCss.includes('.active-persona-bar'), '.active-persona-bar style rule defined in styles.css');
  assert(stylesCss.includes('.persona-switch-dropdown'), '.persona-switch-dropdown style rule defined in styles.css');
  assert(stylesCss.includes('.persona-pill-btn'), '.persona-pill-btn style rule defined in styles.css');
  assert(stylesCss.includes('.persona-pill-btn.active'), '.persona-pill-btn.active highlight style rule defined');
  assert(stylesCss.includes('.persona-quick-pills'), '.persona-quick-pills flex container style rule defined');
  assert(stylesCss.includes('.sidebar-persona-select'), '.sidebar-persona-select style rule defined in styles.css');
  assert(stylesCss.includes('.navbar-persona-select'), '.navbar-persona-select style rule defined in styles.css');

  // [3] JavaScript Logic Verification
  console.log('\n[3] Checking JavaScript controller logic in app.js...');
  assert(appJs.includes('window.switchActiveEmployee = function'), 'window.switchActiveEmployee defined in app.js');
  assert(appJs.includes('window.switchActiveManager = function'), 'window.switchActiveManager defined in app.js');
  assert(appJs.includes('function syncGlobalPersonaBars'), 'syncGlobalPersonaBars defined in app.js');
  assert(appJs.includes("localStorage.setItem('cloudpulse_active_employee'"), 'Active employee persists to localStorage');
  assert(appJs.includes("localStorage.setItem('cloudpulse_active_manager'"), 'Active manager persists to localStorage');
  assert(appJs.includes("localStorage.getItem('cloudpulse_active_employee')"), 'Saved active employee loaded on database sync');
  assert(appJs.includes("localStorage.getItem('cloudpulse_active_manager')"), 'Saved active manager loaded on database sync');
  assert(appJs.includes("document.getElementById('employeeSelectActive')"), 'employeeSelectActive referenced in render logic');
  assert(appJs.includes("document.getElementById('employeeQuickPills')"), 'employeeQuickPills rendered in dashboard');
  assert(appJs.includes("document.getElementById('managerSelectActive')"), 'managerSelectActive referenced in render logic');
  assert(appJs.includes("document.getElementById('managerQuickPills')"), 'managerQuickPills rendered in dashboard');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runPersonaSwitcherTests();

