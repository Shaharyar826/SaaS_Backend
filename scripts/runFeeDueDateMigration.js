#!/usr/bin/env node

/**
 * Script to run the fee due date migration
 * Usage: node runFeeDueDateMigration.js
 */

const path = require('path');

// Change to the backend directory
process.chdir(path.join(__dirname, '..'));

// Load environment variables from the backend directory
require('dotenv').config();

// Import and run the migration
const fixFeeDueDates = require('./fixFeeDueDates');

console.log('Starting fee due date migration...');
console.log('This will update all fee records to have due dates set to the last date of their respective months.');
console.log('');

fixFeeDueDates()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });