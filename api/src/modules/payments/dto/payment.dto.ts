import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../../common/enums';
import { Payment } from '../entities/payment.entity';

// Response when initiating a payment: the checkout link the client opens.
export class CreatePaymentResponseDto {
  @ApiProperty({ description: 'Our payment id' })
  payment_id: string;

  @ApiProperty({ description: 'Hosted checkout URL to open' })
  checkout_url: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;
}

// The payment row as returned to participants. No raw webhook payload is exposed.
export class PaymentResponseDto {
  @ApiProperty() payment_id: string;
  @ApiProperty() job_id: string;
  @ApiProperty({ description: 'Whole RWF' }) amount: number;
  @ApiProperty() currency: string;
  @ApiProperty() provider: string;
  @ApiProperty({ enum: PaymentStatus }) status: PaymentStatus;
  @ApiProperty({ nullable: true }) paid_at: string | null;
  @ApiProperty({ nullable: true }) failure_reason: string | null;

  static from(p: Payment): PaymentResponseDto {
    return {
      payment_id: p.id,
      job_id: p.jobId,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      paid_at: p.paidAt ? p.paidAt.toISOString() : null,
      failure_reason: p.failureReason,
    };
  }
}

// A payment row for the admin oversight table (adds counterparty names; still no
// raw webhook payload).
export class AdminPaymentDto {
  @ApiProperty() id: string;
  @ApiProperty() jobId: string;
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
  @ApiProperty() provider: string;
  @ApiProperty() providerRef: string;
  @ApiProperty({ enum: PaymentStatus }) status: PaymentStatus;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true }) paidAt: string | null;
  @ApiProperty({ nullable: true }) failureReason: string | null;
  @ApiProperty({ nullable: true }) payerName: string | null;
  @ApiProperty({ nullable: true }) payeeName: string | null;
}

export interface AdminRecheckResult {
  status: PaymentStatus;
  changed: boolean;
  notFound?: boolean;
}
