import { Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

interface JwtTokenCacheOptions {
  proveedor: string;          // nombre para logs
  loginUrl: string;           // URL absoluta del POST /auth/login
  email: string | undefined;
  password: string | undefined;
  /** Si no podemos decodificar exp del JWT, asumimos esta duración. */
  fallbackTtlSeconds?: number;
  /** Margen para renovar antes del expiry (default 30s). */
  renewMarginSeconds?: number;
}

export class JwtTokenCache {
  private readonly logger: Logger;
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private renewalPromise: Promise<string> | null = null;

  constructor(private readonly opts: JwtTokenCacheOptions) {
    this.logger = new Logger(`JwtTokenCache:${opts.proveedor}`);
  }

  async getValidToken(): Promise<string> {
    const margin = (this.opts.renewMarginSeconds ?? 30) * 1000;
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - margin) {
      return this.cachedToken;
    }
    if (this.renewalPromise) return this.renewalPromise;

    this.renewalPromise = this.fetchNewToken();
    try {
      return await this.renewalPromise;
    } finally {
      this.renewalPromise = null;
    }
  }

  invalidate(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  private async fetchNewToken(): Promise<string> {
    if (!this.opts.email || !this.opts.password) {
      throw new ServiceUnavailableException(
        `Credenciales ${this.opts.proveedor} no configuradas (faltan email/password)`,
      );
    }
    this.logger.log(`Solicitando nuevo JWT a ${this.opts.loginUrl}`);
    const res = await axios.post(
      this.opts.loginUrl,
      { email: this.opts.email, password: this.opts.password },
      { timeout: 10_000 },
    );
    const token = res.data?.data?.token ?? res.data?.token ?? res.data?.access_token;
    if (!token || typeof token !== 'string') {
      throw new ServiceUnavailableException(`${this.opts.proveedor} no devolvió token en /auth/login`);
    }
    const expSeconds = this.decodeJwtExp(token) ?? (Date.now() / 1000 + (this.opts.fallbackTtlSeconds ?? 3600));
    this.cachedToken = token;
    this.tokenExpiresAt = expSeconds * 1000;
    const remaining = Math.floor((this.tokenExpiresAt - Date.now()) / 1000);
    this.logger.log(`JWT obtenido, expira en ${remaining}s`);
    return token;
  }

  private decodeJwtExp(token: string): number | null {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }
}
