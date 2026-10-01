import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

const dbUrl = process.env.DATABASE_URL || '';
let schema = fs.readFileSync(schemaPath, 'utf8');

if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
  console.log('[prepare-db] Detected PostgreSQL URL. Setting provider to postgresql...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);

  console.log('[prepare-db] Generating Prisma client for PostgreSQL...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  console.log('[prepare-db] Synchronizing database schema to PostgreSQL (Supabase)...');
  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log('[prepare-db] Schema pushed successfully to Supabase.');
  } catch (err) {
    console.warn('[prepare-db] Warning: prisma db push failed:', err.message);
  }
} else {
  console.log('[prepare-db] Using SQLite for local/desktop...');
  if (schema.includes('provider = "postgresql"')) {
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    fs.writeFileSync(schemaPath, schema);
  }
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}
