import logo from '@public/logo.png';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'CM Drozdi',
	description: 'Cimbálová muzika Drozdi',
	icons: [{ rel: 'icon', url: '/favicon.ico' }],
	openGraph: {
		siteName: 'CM Drozdi',
		images: logo.src,
		url: 'http://cmdrozdi.cz',
	},
	twitter: {
		images: logo.src,
	},
	verification: {
		google: 'UIA_yQ2RFXxRh2mBtUqRN7jmYkUxlV0mdOtMIkK0rVU',
	},
};
