import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <LoginForm />
      <Link
        href="/privacy"
        className="text-sm text-muted-foreground hover:underline"
      >
        Privacy &amp; Terms
      </Link>
    </main>
  );
}
