import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Rating } from '../entities/rating.entity';

export class CreateRatingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class RatingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() jobId: string;
  @ApiProperty() fromUserId: string;
  @ApiProperty() toUserId: string;
  @ApiProperty() score: number;
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty() createdAt: Date;

  static from(r: Rating): RatingResponseDto {
    return {
      id: r.id,
      jobId: r.jobId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt,
    };
  }
}

export class UserRatingsDto {
  @ApiProperty({ description: 'Average received score' }) average: number;
  @ApiProperty({ description: 'Number of ratings received' }) count: number;
  @ApiProperty({ type: [RatingResponseDto] }) ratings: RatingResponseDto[];
}
