import { VerificationQueue } from '@/features/verifications/components/VerificationQueue';

export default function VerificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Verification queue</h1>
        <p className="text-sm text-black/50">
          Review driver documents awaiting approval.
        </p>
      </div>
      <VerificationQueue />
    </div>
  );
}
