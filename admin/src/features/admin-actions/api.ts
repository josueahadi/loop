import { api } from '@/lib/api';

export async function forceDriverOffline(id: string): Promise<void> {
  await api.patch(`/admin/drivers/${id}/offline`);
}

export async function setUserSuspension(
  id: string,
  suspended: boolean,
): Promise<void> {
  await api.patch(`/admin/users/${id}/suspension`, { suspended });
}

export async function cancelJob(id: string): Promise<void> {
  await api.patch(`/admin/jobs/${id}/cancel`);
}

export async function reopenVerification(id: string): Promise<void> {
  await api.patch(`/admin/verifications/${id}/reopen`);
}
