import { runMigration } from './migrations/revertTo4Buckets.js';

async function main() {
  try {
    console.log('Starting migration process...');
    await runMigration();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main(); 