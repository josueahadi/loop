import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { GeocodeModule } from './modules/geocode/geocode.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MailModule } from './modules/mail/mail.module';
import { MatchingModule } from './modules/matching/matching.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { PushModule } from './modules/push/push.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { RoutingModule } from './modules/routing/routing.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { VerificationModule } from './modules/verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        autoLoadEntities: true,
        synchronize: false,
        // Off by default (Railway private PostGIS / local compose have no SSL);
        // DB_SSL=true opts in for an external managed DB.
        ssl: config.get<boolean>('dbSsl')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    HealthModule,
    MailModule,
    StorageModule,
    NotificationsModule,
    PushModule,
    UsersModule,
    AuthModule,
    VerificationModule,
    VehiclesModule,
    MatchingModule,
    PricingModule,
    JobsModule,
    ProposalsModule,
    MessagingModule,
    RatingsModule,
    PaymentsModule,
    GeocodeModule,
    RoutingModule,
    AdminModule,
  ],
  providers: [
    // Order matters: authenticate first, then authorize by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
