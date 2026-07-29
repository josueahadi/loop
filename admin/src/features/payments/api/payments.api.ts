import { api } from '@/lib/api';
import type { AdminPayment, RecheckResult } from '../types';

export async function listPayments(): Promise<AdminPayment[]> {
  const { data } = await api.get<AdminPayment[]>('/admin/payments');
  return data;
}

export async function recheckPayment(id: string): Promise<RecheckResult> {
  const { data } = await api.post<RecheckResult>(`/admin/payments/${id}/recheck`);
  return data;
}

export async function cancelPayment(id: string): Promise<void> {
  await api.post(`/admin/payments/${id}/cancel`);
}
