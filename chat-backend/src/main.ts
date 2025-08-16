import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getEnvVar } from './utils/env.utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Debug: Log environment variables
  console.log('Environment variables loaded:');
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  console.log('SERVER_PORT:', process.env.SERVER_PORT);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  // Enable CORS for frontend with variable substitution resolved
  const frontendUrl = getEnvVar('FRONTEND_URL', 'http://localhost:3000');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port = process.env.SERVER_PORT || 3001;
  await app.listen(port);
  console.log(`Backend server running on port ${port}`);
  console.log(`CORS enabled for origin: ${frontendUrl}`);
}
bootstrap();
