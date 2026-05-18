import {
  Controller, Get, Param, Query,
  Inject, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import type { IVehiculosService } from '../../../business/vehiculos/interfaces/i-vehiculos.service';
import { IVEHICULOS_SERVICE } from '../../../business/vehiculos/interfaces/i-vehiculos.service';
import { ApiResponse } from '../../common/api-response';

@ApiTags('Productos / Vehículos')
@Controller('api/v1/integracion/productos')
export class ProductosController {
  constructor(
    @Inject(IVEHICULOS_SERVICE)
    private readonly vehiculosService: IVehiculosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar vehículos disponibles del catálogo UrbanCar EC' })
  @ApiQuery({ name: 'agenciaId',   required: false })
  @ApiQuery({ name: 'categoriaId', required: false })
  @ApiQuery({ name: 'status',      required: false })
  @ApiQuery({ name: 'page',        required: false, type: Number })
  @ApiQuery({ name: 'limit',       required: false, type: Number })
  async listar(
    @Query('agenciaId')   agenciaId?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('status')      status?: string,
    @Query('page')        page?: string,
    @Query('limit')       limit?: string,
  ) {
    try {
      const data = await this.vehiculosService.listar({
        agenciaId,
        categoriaId,
        status,
        page:  page  ? Number(page)  : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return ApiResponse.ok(data, 'Vehículos obtenidos exitosamente');
    } catch (err) {
      this.handleError(err);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener vehículo por ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  async obtenerPorId(@Param('id') id: string) {
    try {
      const data = await this.vehiculosService.obtenerPorId(id);
      return ApiResponse.ok(data, 'Vehículo obtenido exitosamente');
    } catch (err) {
      this.handleError(err);
    }
  }

  @Get(':id/disponibilidad')
  @ApiOperation({ summary: 'Consultar disponibilidad en tiempo real de un vehículo' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  async obtenerDisponibilidad(@Param('id') id: string) {
    try {
      const data = await this.vehiculosService.obtenerDisponibilidad(id);
      return ApiResponse.ok(data, 'Disponibilidad obtenida exitosamente');
    } catch (err) {
      this.handleError(err);
    }
  }

  private handleError(err: unknown): never {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : 'Error interno';
    throw new HttpException(ApiResponse.fail(msg), HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
