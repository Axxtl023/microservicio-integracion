require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'https://booking-frontend-ashy.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'booking.integration.v1',
      protoPath: join(__dirname, 'protos/integration.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT || 5003}`,
    },
  });

  const config = new DocumentBuilder()
    .setTitle('Microservicio Integración — UrbanCar EC')
    .setDescription('Proxy de catálogo de vehículos UrbanCar EC. Solo lectura.')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3003;
  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
  console.log(`gRPC IntegrationService escuchando en el puerto ${process.env.GRPC_PORT || 5003}`);
  console.log(`Microservicio Integración corriendo en el puerto ${port}`);
}
bootstrap();
