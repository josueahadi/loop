import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityStatus, UserRole } from '../../common/enums';
import { User } from './entities/user.entity';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async getByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.users.findOne({ where: { phone } });
  }

  async createUser(params: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const email = params.email.toLowerCase();
    if (await this.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.findByPhone(params.phone)) {
      throw new ConflictException('Phone already registered');
    }
    const isDriver = params.role === UserRole.DRIVER;
    const user = this.users.create({
      name: params.name,
      email,
      phone: params.phone,
      passwordHash: params.passwordHash,
      role: params.role,
      availabilityStatus: isDriver ? AvailabilityStatus.OFFLINE : null,
      averageRating: 0,
    });
    return this.users.save(user);
  }

  async updateProfile(id: string, dto: UpdateMeDto): Promise<User> {
    const user = await this.getByIdOrFail(id);
    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.findByPhone(dto.phone);
      if (existing && existing.id !== id) {
        throw new ConflictException('Phone already registered');
      }
      user.phone = dto.phone;
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.photoUrl !== undefined) user.photoUrl = dto.photoUrl;
    return this.users.save(user);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.users.update({ id }, { emailVerifiedAt: new Date() });
  }

  // Sets driver availability and (when provided) current location as a PostGIS
  // geography point. Location is only overwritten when both lat and lng are given.
  async updateAvailability(
    id: string,
    status: AvailabilityStatus,
    lat?: number,
    lng?: number,
  ): Promise<User> {
    if (status === AvailabilityStatus.ONLINE) {
      await this.assertDriverCanGoOnline(id);
    }

    await this.users.manager.query(
      `UPDATE users
         SET availability_status = $1,
             location = CASE
               WHEN $2::float8 IS NULL OR $3::float8 IS NULL THEN location
               ELSE ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
             END,
             updated_at = now()
       WHERE id = $4`,
      [status, lat ?? null, lng ?? null, id],
    );
    return this.getByIdOrFail(id);
  }

  private async assertDriverCanGoOnline(id: string): Promise<void> {
    const [vehicleRow] = await this.users.manager.query(
      `SELECT COUNT(*)::int AS count FROM vehicles WHERE driver_id = $1`,
      [id],
    );
    if ((vehicleRow?.count ?? 0) < 1) {
      throw new ForbiddenException('Add a vehicle before going online.');
    }

    const records = await this.users.manager.query(
      `SELECT document_type AS "documentType", status
       FROM verification_records
       WHERE driver_id = $1
         AND document_type IN ('licence', 'national_id', 'vehicle_reg')`,
      [id],
    );
    const approved = new Set(
      records
        .filter((r: { status: string }) => r.status === 'approved')
        .map((r: { documentType: string }) => r.documentType),
    );
    if (approved.size === 3) return;

    if (records.some((r: { status: string }) => r.status === 'rejected')) {
      throw new ForbiddenException(
        'A document was rejected. Please re-upload it.',
      );
    }
    if (records.some((r: { status: string }) => r.status === 'pending')) {
      throw new ForbiddenException('Your documents are still under review.');
    }

    throw new ForbiddenException(
      'Upload all required documents before going online.',
    );
  }

  async setPhotoUrl(id: string, photoUrl: string): Promise<User> {
    await this.users.update({ id }, { photoUrl });
    return this.getByIdOrFail(id);
  }

  async setPushToken(id: string, token: string | null): Promise<void> {
    await this.users.update({ id }, { fcmToken: token });
  }
}
