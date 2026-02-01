import type { ApiTagTag } from '$types/contentTypes';
import { type StrapiResponse, pagination, strapiUrl } from './pagination';

export async function getAllEntitiesByTag(tag: string) {
  const url = new URL(`${strapiUrl}/api/tags?populate=*`);
  let page: StrapiResponse<ApiTagTag['attributes']>;
  const tags: ApiTagTag['attributes'][] = [];

  do {
    page = await fetch(url).then((r) => r.json());
    tags.push(...page.data);
  } while (page.meta.pagination.page < page.meta.pagination.pageCount);

  return tags;
}

export async function getAllTagsForType(type: string) {
  // populate the relationship of the given type.
  const url = new URL(`${strapiUrl}/api/tags?populate=${type}`);

  // If we are in Dev mode, make sure we include drafts
  if (import.meta.env.DEV) {
    url.searchParams.set('status', 'draft');
  }

  // Paginations all values into one array.
  return pagination<ApiTagTag['attributes']>(url);
}
