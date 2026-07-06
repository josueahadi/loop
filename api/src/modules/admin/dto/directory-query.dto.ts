import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Shared query for the paginated admin directory lists (drivers / users / jobs).
// page is 1-based; limit is capped so a client can't request the whole table.
export class DirectoryQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  // Free-text search (name / email / phone, or cargo type for jobs).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  // Per-list filter: driver matchability, user role, or job status.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filter?: string;
}

// Uniform paginated envelope so the admin tables render page controls consistently.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
