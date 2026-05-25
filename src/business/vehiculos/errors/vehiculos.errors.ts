import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

// Errores de dominio comunes para TODOS los proveedores de vehículos.
// Cada client mapea sus códigos HTTP propios (400/404/409/422/etc) a esta
// jerarquía. El gRPC controller los traduce a status codes gRPC.

export class ReservaInvalidaError extends BadRequestException {
  constructor(public readonly proveedor: string, message: string) {
    super(`[${proveedor}] ${message}`);
  }
}

export class ReservaNoDisponibleError extends ConflictException {
  constructor(public readonly proveedor: string, message: string) {
    super(`[${proveedor}] ${message}`);
  }
}

export class ReservaNoEncontradaError extends NotFoundException {
  constructor(public readonly proveedor: string, message: string) {
    super(`[${proveedor}] ${message}`);
  }
}

export class ProveedorIndisponibleError extends ServiceUnavailableException {
  constructor(public readonly proveedor: string, message: string) {
    super(`[${proveedor}] ${message}`);
  }
}

export class ProveedorNoSoportadoError extends BadRequestException {
  constructor(providerId: string) {
    super(`Proveedor ${providerId} no soportado para reservas externas`);
  }
}
