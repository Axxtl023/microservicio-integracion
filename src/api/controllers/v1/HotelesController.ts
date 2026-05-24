import {
  Controller, Get, Param, Query,
  Inject, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { IHotelesService } from '../../../business/hoteles/interfaces/i-hoteles.service';
import { IHOTELES_SERVICE } from '../../../business/hoteles/interfaces/i-hoteles.service';
import { ApiResponse } from '../../common/api-response';

@ApiTags('Hoteles')
@Controller('api/v1/integracion/hoteles')
export class HotelesController {
  constructor(
    @Inject(IHOTELES_SERVICE) private readonly hotelesService: IHotelesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar alojamientos del catálogo Locus' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listar(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.hotelesService.listar({
        page:  page  ? Number(page)  : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return ApiResponse.ok(data, 'Hoteles obtenidos exitosamente');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Error interno';
      throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un hotel por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'proveedor', required: false, type: String })
  async obtenerPorId(
    @Param('id')         id:         string,
    @Query('proveedor')  proveedor?: string,
  ) {
    try {
      const data = await this.hotelesService.obtenerPorId(Number(id), proveedor);
      return ApiResponse.ok(data, 'Hotel obtenido exitosamente');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Error interno';
      throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
