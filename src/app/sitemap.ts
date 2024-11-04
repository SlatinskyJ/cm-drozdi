import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: 'https://cmdrozdi.cz',
			lastModified: new Date(),
		},
	];
}
