import type { ApiBlogBlog } from '$types/contentTypes';
import { type StrapiResponse, strapiUrl } from './pagination';

export async function listBlogs(page = 1, draft = import.meta.env.DEV) {
  const url = new URL(
    `${strapiUrl}/api/blogs?sort[0]=updatedAt:desc&sort[1]=publishedAt:desc&populate=header`,
  );

  // Set the drafts
  if (draft) {
    url.searchParams.set('status', 'draft');
  }

  url.searchParams.set('pagination[page]', page.toString());
  url.searchParams.set('pagination[pageSize]', '50');

  return fetch(url).then(
    (r) => r.json() as Promise<StrapiResponse<ApiBlogBlog['attributes']>>,
  );
}
