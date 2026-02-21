#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runAddChallengeSidesMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = resolve('./migrations/20260212_add_challenge_sides.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration to add challenger_side and challenged_side columns...');
    await client.query(migrationSql);
    console.log('✅ Migration completed successfully!');

    // Verify columns were added
    console.log('\n🔍 Verifying columns...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'challenges' 
      AND column_name IN ('challenger_side', 'challenged_side')
      ORDER BY column_name;
    `);

    if (result.rows.length === 2) {
      console.log('✅ Both columns successfully added:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.warn('⚠️ Warning: Expected 2 columns but found', result.rows.length);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAddChallengeSidesMigration();
