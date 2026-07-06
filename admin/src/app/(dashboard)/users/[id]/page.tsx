import { UserProfile } from '@/features/users/components/UserProfile';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserProfile id={id} />;
}
