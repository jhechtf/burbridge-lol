import { strapiUrl } from './pagination';

export async function listStories(page = -1, drafts = import.meta.env.DEV) {
  const url = new URL(
    `${strapiUrl}/api/stories?populate[chapters][fields][0]=chapter_title&populate[chapters][fields][1]=chapter_number&populate[chapters][fields][2]=slug`,
  );

  if (page > -1) {
    url.searchParams.set('pagination[page]', page.toString());
    url.searchParams.set('pagination[pageSize]', '50');
  }

  if (drafts) {
    url.searchParams.set('status', 'draft');
  }
  const resp = await fetch(url).then((r) => r.json());
  return resp;
}

export async function getStory(slug: string) {
  const url = new URL(
    `${strapiUrl}/api/stories?slug=${encodeURIComponent(slug)}`,
  );
  const resp = await fetch(url).then((r) => r.json());
  return resp.data[0];
}
