export const strapiUrl = import.meta.env.STRAPI_API || 'http://localhost:1337';

export type StrapiResponse<T> = {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageCount: number;
      total: number;
    };
  };
};

export async function pagination<T>(
  baseUrl: string | URL,
  startPage = 1,
  perPage = 25,
): Promise<T[]> {
  const results: T[] = [];
  let page: StrapiResponse<T>;

  const url = new URL(baseUrl);

  url.searchParams.set('pagination[page]', startPage.toString());
  url.searchParams.set('pagination[pageSize]', perPage.toString());

  do {
    page = await fetch(url).then((r) => r.json() as Promise<StrapiResponse<T>>);
    results.push(...page.data);

    url.searchParams.set(
      'pagination[page]',
      (page.meta.pagination.page + 1).toString(),
    );
  } while (page.meta.pagination.page < page.meta.pagination.pageCount);
  return results;
}

export async function paginateFunction<T>(
  fn: (page: number, ...rest: unknown[]) => Promise<StrapiResponse<T>>,
  startPage = 1,
  ...otherArgs: unknown[]
) {
  // we have to grab the starting page.
  const init = await fn(startPage, ...otherArgs);

  // build the array of promises
  const build = Array.from(
    {
      length: init.meta.pagination.pageCount - startPage,
    },
    (_, i) => fn(i + startPage + 1, ...otherArgs),
  );

  const results = await Promise.allSettled(build).then((v) =>
    v.filter((p) => p.status === 'fulfilled').map((p) => p.value),
  );

  return init.data.concat(...results.flatMap((r) => r.data));
}
