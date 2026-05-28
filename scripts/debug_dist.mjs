import fs from 'fs';

let c = fs.readFileSync('dist-electron/index.js', 'utf8');

// Count occurrences
const count1 = (c.match(/function getWorkspacePath/g) || []).length;
const count2 = (c.match(/function getDbPath/g) || []).length;
const count3 = (c.match(/globalThis\[WORKSPACE_PATH_KEY/g) || []).length;
console.log('getWorkspacePath count:', count1);
console.log('getDbPath count:', count2);
console.log('globalThis[WORKSPACE_PATH_KEY count:', count3);

// Add debug logging
c = c.replace(
  'globalThis[WORKSPACE_PATH_KEY$1] = workspacePath;',
  'console.error("[DBG] Instance1 setWorkspacePath:",workspacePath);globalThis[WORKSPACE_PATH_KEY$1] = workspacePath;'
);

c = c.replace(
  'function getWorkspacePath$1() {',
  'function getWorkspacePath$1() {console.error("[DBG] Instance1 getWorkspacePath returns:",globalThis[WORKSPACE_PATH_KEY$1]);'
);

c = c.replace(
  'function getWorkspacePath() {',
  'function getWorkspacePath() {console.error("[DBG] Instance2 getWorkspacePath returns:",globalThis[WORKSPACE_PATH_KEY]);'
);

// Also add logging to getDatabase functions
c = c.replace(
  'function getDatabase$1() {',
  'function getDatabase$1() {console.error("[DBG] Instance1 getDatabase called, db$1=", !!db$1);'
);

c = c.replace(
  'function getDatabase() {',
  'function getDatabase() {console.error("[DBG] Instance2 getDatabase called, db=", !!db);'
);

fs.writeFileSync('dist-electron/index.js', c);
console.log('Debug instrumentation done');
