import { redirect } from 'next/navigation';

export default function LoginPage() {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.sonear.com';
  const appSlug = 'csv-importer';
  
  // Rediriger vers Auth Central
  redirect(`${authUrl}/login?app=${appSlug}`);
}
