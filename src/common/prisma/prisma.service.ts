import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 1. Forzamos la lectura del archivo .env local antes de inicializar super()
    require('dotenv').config();
    
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está en el ambiente de Integración');
    }
    
    // 2. Pasamos la conexión a través del adaptador compatible de PostgreSQL
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      console.log('DB conectada — Microservicio Integración');
    } catch (error) {
      console.error('Error conectando DB en Integración:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}