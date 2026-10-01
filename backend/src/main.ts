import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  // Search for frontend dist directory
  const possiblePaths = [
    process.env.FRONTEND_PATH,
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend'),
    path.resolve(__dirname, './public'),
  ].filter(Boolean) as string[];

  let frontendPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      frontendPath = p;
      break;
    }
  }

  if (frontendPath) {
    console.log(`[Backend] Serving frontend static assets from: ${frontendPath}`);
    app.useStaticAssets(frontendPath);

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use((req: any, res: any, next: any) => {
      if (req.method !== 'GET') {
        return next();
      }
      const p = req.path || req.url;
      if (
        p.startsWith('/students') ||
        p.startsWith('/sheikhs') ||
        p.startsWith('/settings') ||
        p.startsWith('/api')
      ) {
        return next();
      }
      res.sendFile(path.join(frontendPath!, 'index.html'));
    });
  } else {
    console.log('[Backend] No frontend dist directory found, running API only mode.');
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 39281;
  await app.listen(port, '0.0.0.0');
  console.log(`[Backend] Kittab API is running on http://127.0.0.1:${port}`);
}
bootstrap();
