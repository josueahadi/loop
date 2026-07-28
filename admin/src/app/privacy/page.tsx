import type { Metadata } from 'next';
import policyJson from '@/features/legal/policy.json';
import { PolicyView } from '@/features/legal/PolicyView';
import type { Policy } from '@/features/legal/types';

// Public — this route sits outside the (dashboard) group, so AdminGate never
// runs and it is reachable without logging in.
const policy = policyJson as Policy;

export const metadata: Metadata = {
  title: 'Privacy & Terms — Loop',
  description: 'Loop privacy policy and terms of use.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <PolicyView policy={policy} />
    </main>
  );
}
