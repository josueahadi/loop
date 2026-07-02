import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { ProposalStatus } from '../../../common/enums';

export class CreateProposalDto {
  @ApiProperty({ description: 'Driver to send the proposal to' })
  @IsUUID()
  driverId: string;
}

export class RespondProposalDto {
  @ApiProperty({ enum: [ProposalStatus.ACCEPTED, ProposalStatus.DECLINED] })
  @IsIn([ProposalStatus.ACCEPTED, ProposalStatus.DECLINED])
  status: ProposalStatus.ACCEPTED | ProposalStatus.DECLINED;
}

// Counterparty contact — populated ONLY after a proposal is accepted.
export class ContactDto {
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
}

// Compact job summary shown with a driver's incoming proposal.
export class ProposalJobDto {
  @ApiProperty() id: string;
  @ApiProperty() cargoType: string;
  @ApiProperty({ nullable: true }) pickupLabel: string | null;
  @ApiProperty({ nullable: true }) dropOffLabel: string | null;
  @ApiProperty() price: number;
  @ApiProperty() reqVehicleType: string;
  @ApiProperty() status: string;
}

export class ProposalResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() jobId: string;
  @ApiProperty() driverId: string;
  @ApiProperty({ enum: ProposalStatus }) status: ProposalStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) respondedAt: Date | null;
  @ApiProperty({ type: ProposalJobDto, nullable: true })
  job?: ProposalJobDto | null;
  // Revealed only when status = accepted (never browsable before).
  @ApiProperty({ type: ContactDto, nullable: true })
  contact?: ContactDto | null;
}
