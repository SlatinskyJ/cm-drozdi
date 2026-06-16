import { redirect } from 'next/navigation';
import { getServerAuthSession } from '~/server/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
	const session = await getServerAuthSession();
	if (session) redirect('/events');
	return <LoginForm />;
}
