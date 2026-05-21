import {
  Controller, Get, Query,
  Inject, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { IAtraccionesService } from '../../../business/atracciones/interfaces/i-atracciones.service';
import { IATRACCIONES_SERVICE } from '../../../business/atracciones/interfaces/i-atracciones.service';
import { ApiResponse } from '../../common/api-response';

@ApiTags('Atracciones')
@Controller('api/v1/integracion/atracciones')
export class AtraccionesController {
  constructor(
    @Inject(IATRACCIONES_SERVICE) private readonly atraccionesService: IAtraccionesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar atracciones del catálogo TerraQuest' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listar(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.atraccionesService.listar({
        page:  page  ? Number(page)  : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return ApiResponse.ok(data, 'Atracciones obtenidas exitosamente');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Error interno';
      throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
