import { PaymentsTable } from '@/features/payments/components/PaymentsTable';

export default function PaymentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Settlement records observed from the provider. Loop never holds funds;
          a payment only becomes successful via the provider&apos;s verified
          webhook. Use re-check to resolve a stuck pending payment from the
          provider, or cancel it so the owner can retry.
        </p>
      </div>
      <PaymentsTable />
    </div>
  );
}
