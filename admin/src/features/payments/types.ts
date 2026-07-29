export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled';

export interface AdminPayment {
  id: string;
  jobId: string;
  amount: number;
  currency: string;
  provider: string;
  providerRef: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
  payerName: string | null;
  payeeName: string | null;
}

export interface RecheckResult {
  status: PaymentStatus;
  changed: boolean;
  notFound?: boolean;
}
