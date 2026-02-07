import type { ApiOtherOther } from '$types/contentTypes';
import { type StrapiResponse, strapiUrl } from './pagination';

export async function listOthers(page = 1, draft = import.meta.env.DEV) {
  const url = new URL(
    `${strapiUrl}/api/others?pagination[page]=${page}&pagination[pageSize]=50&sort[0]=updatedAt:desc`,
  );
  if (draft) {
    url.searchParams.set('status', 'draft');
  }

  return fetch(url).then((r) => r.json()) as Promise<
    StrapiResponse<ApiOtherOther['attributes']>
  >;
}
