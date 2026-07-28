import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountBlocklist } from './entities/account-blocklist.entity';
import { AccountDeletionService } from './account-deletion.service';

// Account erasure + the fraud re-registration blocklist. StorageModule is global,
// so document purge is available without importing it here.
@Module({
  imports: [TypeOrmModule.forFeature([AccountBlocklist])],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
