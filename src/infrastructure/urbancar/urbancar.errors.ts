import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export class ReservaInvalidaError extends BadRequestException {
  constructor(message = 'La reserva externa enviada a UrbanCar no es valida') {
    super(message);
  }
}

export class ReservaNoDisponibleError extends ConflictException {
  constructor(message = 'La reserva externa no esta disponible en UrbanCar') {
    super(message);
  }
}

export class ReservaNoEncontradaError extends NotFoundException {
  constructor(message = 'La reserva externa no existe en UrbanCar') {
    super(message);
  }
}

export class ProveedorIndisponibleError extends ServiceUnavailableException {
  constructor(message = 'UrbanCar no esta disponible') {
    super(message);
  }
}
