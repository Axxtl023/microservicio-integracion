import axios from 'axios';
import {
  ProveedorIndisponibleError,
  ReservaInvalidaError,
  ReservaNoDisponibleError,
  ReservaNoEncontradaError,
} from './vehiculos.errors';

/** Mapea un error HTTP de un proveedor a la jerarquía de errores de dominio. */
export function mapHttpToDomainError(
  err: unknown,
  proveedor: string,
  fallbackMessage: string,
): Error {
  if (!axios.isAxiosError(err)) {
    const message = err instanceof Error ? err.message : fallbackMessage;
    return new ProveedorIndisponibleError(proveedor, message);
  }

  const status = err.response?.status;
  const message = extractMessage(err.response?.data) ?? fallbackMessage;

  if (status === 400) return new ReservaInvalidaError(proveedor, message);
  if (status === 404) return new ReservaNoEncontradaError(proveedor, message);
  if (status === 409 || status === 422) return new ReservaNoDisponibleError(proveedor, message);
  return new ProveedorIndisponibleError(proveedor, message);
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const c = body as { message?: unknown; error?: unknown; details?: unknown };
  if (typeof c.message === 'string') return c.message;
  if (typeof c.error === 'string') return c.error;
  if (c.error && typeof c.error === 'object') {
    const err = c.error as { message?: unknown };
    if (typeof err.message === 'string') return err.message;
  }
  if (typeof c.details === 'string') return c.details;
  return undefined;
}
