import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
  ) {}

  listForDriver(driverId: string): Promise<Vehicle[]> {
    return this.vehicles.find({ where: { driverId } });
  }

  create(driverId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.vehicles.save(this.vehicles.create({ ...dto, driverId }));
  }

  private async getOwned(driverId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOne({ where: { id, driverId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(
    driverId: string,
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    const vehicle = await this.getOwned(driverId, id);
    Object.assign(vehicle, dto);
    return this.vehicles.save(vehicle);
  }

  async remove(driverId: string, id: string): Promise<void> {
    const vehicle = await this.getOwned(driverId, id);
    await this.vehicles.remove(vehicle);
  }
}
