import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehiclesService } from './vehicles.service';

// Vehicles are driver-owned; a driver only ever sees/edits their own.
@ApiTags('vehicles')
@ApiBearerAuth()
@Roles(UserRole.DRIVER)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  async list(
    @CurrentUser('id') driverId: string,
  ): Promise<VehicleResponseDto[]> {
    const vehicles = await this.vehicles.listForDriver(driverId);
    return vehicles.map(VehicleResponseDto.from);
  }

  @Post()
  async create(
    @CurrentUser('id') driverId: string,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return VehicleResponseDto.from(await this.vehicles.create(driverId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') driverId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return VehicleResponseDto.from(
      await this.vehicles.update(driverId, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser('id') driverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.vehicles.remove(driverId, id);
  }
}
