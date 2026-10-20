import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export const metadata: Metadata = {
  title: 'Change password | Weekly Reports',
};

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
