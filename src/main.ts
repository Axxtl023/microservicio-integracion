require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173';
  const origins = rawOrigins.split(',').map((o) => o.trim());

  app.enableCors({
    origin: origins,
    methods: ['GET', 'HEAD'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Microservicio Integración — UrbanCar EC')
    .setDescription('Proxy de catálogo de vehículos UrbanCar EC. Solo lectura.')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3003;
  await app.listen(port, '0.0.0.0');
  console.log(`Microservicio Integración corriendo en el puerto ${port}`);
}
bootstrap();
