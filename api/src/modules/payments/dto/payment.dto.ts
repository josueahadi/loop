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
