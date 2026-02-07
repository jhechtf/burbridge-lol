import { strapiUrl } from './pagination';

export async function getChapterFromFullSlug(
  slug: string,
  draft = import.meta.env.DEV,
) {
  const [storySlug, chapterSlug] = slug
    .trim()
    .split('/')
    .map((p) => p.trim());

  const url = new URL(
    `${strapiUrl}/api/chapters?fields=contents&filters[slug][$eq]=${encodeURIComponent(
      chapterSlug,
    )}&filters[story][slug][$eq]=${encodeURIComponent(storySlug)}`,
  );

  if (draft) {
    url.searchParams.set('status', 'draft');
  }

  const res = await fetch(url).then((r) => r.json());

  if (res.meta.total !== 1) {
    console.error(`HEADS UP, DUPLICATES FOR ${slug}`);
    console.error(res);
  }

  return res.data[0];
}
