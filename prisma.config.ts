import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error(
    '[prisma.config] DATABASE_URL no encontrada.\n' +
    `  Buscado en: ${path.join(__dirname, '.env')}\n` +
    '  Verifica que el archivo .env exista en la raíz del microservicio.',
  );
}

export default defineConfig({
  datasource: {
    url: rawUrl,
  },
});
