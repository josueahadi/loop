import { VerificationQueue } from '@/features/verifications/components/VerificationQueue';

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string }>;
}) {
  const { driver } = await searchParams;
  return <VerificationQueue initialDriverId={driver} />;
}
