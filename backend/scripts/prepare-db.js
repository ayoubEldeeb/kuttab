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

  console.log('[prepare-db] Synchronizing database schema to PostgreSQL...');
  // DDL must not go through a transaction pooler, so aim the push at the
  // direct endpoint: Neon drops the "-pooler" host suffix, Supabase uses the
  // session port 5432 instead of 6543.
  const pushUrl = (() => {
    try {
      const u = new URL(dbUrl);
      u.hostname = u.hostname.replace('-pooler.', '.');
      if (u.port === '6543') u.port = '5432';
      u.searchParams.delete('pgbouncer');
      // libpq-only parameter that the Prisma engine does not understand
      u.searchParams.delete('channel_binding');
      return u.toString();
    } catch {
      return dbUrl
        .replace(':6543', ':5432')
        .replace('?pgbouncer=true', '')
        .replace('&pgbouncer=true', '');
    }
  })();

  try {
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: pushUrl },
    });
    console.log('[prepare-db] Schema pushed successfully to Supabase.');
  } catch (err) {
    console.warn('[prepare-db] Warning: prisma db push with direct URL failed, trying original URL:', err.message);
    try {
      execSync('npx prisma db push --skip-generate', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..'),
      });
      console.log('[prepare-db] Schema pushed successfully with original URL.');
    } catch (e) {
      console.warn('[prepare-db] Schema push notice:', e.message);
    }
  }
} else {
  console.log('[prepare-db] Using SQLite for local/desktop...');
  if (schema.includes('provider = "postgresql"')) {
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    fs.writeFileSync(schemaPath, schema);
  }
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}
