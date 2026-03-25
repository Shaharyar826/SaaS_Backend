const { spawn } = require('child_process');
const path = require('path');

console.log('Running fee migration to fix monthlyFee field...');

const migrationScript = path.join(__dirname, 'fixMonthlyFeeField.js');
const child = spawn('node', [migrationScript], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\nMigration completed successfully!');
  } else {
    console.log(`\nMigration failed with exit code ${code}`);
  }
});

child.on('error', (error) => {
  console.error('Failed to start migration:', error);
});