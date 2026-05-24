import {
  Controller, Get, Query, Param,
  Inject, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { IVuelosService } from '../../../business/vuelos/interfaces/i-vuelos.service';
import { IVUELOS_SERVICE } from '../../../business/vuelos/interfaces/i-vuelos.service';
import { ApiResponse } from '../../common/api-response';

@ApiTags('Vuelos')
@Controller('api/v1/integracion/vuelos')
export class VuelosController {
  constructor(
    @Inject(IVUELOS_SERVICE) private readonly vuelosService: IVuelosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar vuelos del catálogo multi-proveedor' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listar(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.vuelosService.listar({
        page:  page  ? Number(page)  : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return ApiResponse.ok(data, 'Vuelos obtenidos exitosamente');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Error interno';
      throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un vuelo por ID (AeroCore)' })
  async obtenerPorId(@Param('id') id: string) {
    try {
      const data = await this.vuelosService.obtenerPorId(id);
      if (!data) {
        throw new HttpException(
          ApiResponse.fail(`Vuelo ${id} no encontrado`),
          HttpStatus.NOT_FOUND,
        );
      }
      return ApiResponse.ok(data, 'Vuelo obtenido exitosamente');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Error interno';
      throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
