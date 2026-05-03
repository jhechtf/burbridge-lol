/**
 * Strapi → Payload CMS migration script
 *
 * Usage:
 *   node payload/scripts/migrate.ts \
 *     --strapi-url https://strapi.example.com \
 *     --strapi-token <token> \
 *     --payload-email admin@example.com \
 *     --payload-password <password>
 *
 * All options can also be supplied as environment variables.
 * Run with Node 22+ (TypeScript types are stripped natively).
 */

// ---------------------------------------------------------------------------
// Configuration & CLI argument parsing
// ---------------------------------------------------------------------------

interface Config {
  strapiUrl: string;
  strapiToken: string;
  payloadUrl: string;
  payloadEmail: string;
  payloadPassword: string;
}

function parseArgs(): Partial<Config> {
  const args = process.argv.slice(2);
  const result: Partial<Config> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--strapi-url":
        result.strapiUrl = next;
        i++;
        break;
      case "--strapi-token":
        result.strapiToken = next;
        i++;
        break;
      case "--payload-url":
        result.payloadUrl = next;
        i++;
        break;
      case "--payload-email":
        result.payloadEmail = next;
        i++;
        break;
      case "--payload-password":
        result.payloadPassword = next;
        i++;
        break;
    }
  }

  return result;
}

function buildConfig(): Config {
  const cliArgs = parseArgs();

  const strapiUrl =
    cliArgs.strapiUrl ?? process.env.STRAPI_URL ?? "";
  const strapiToken =
    cliArgs.strapiToken ?? process.env.STRAPI_TOKEN ?? "";
  const payloadUrl =
    cliArgs.payloadUrl ?? process.env.PAYLOAD_URL ?? "http://localhost:3000";
  const payloadEmail =
    cliArgs.payloadEmail ?? process.env.PAYLOAD_EMAIL ?? "";
  const payloadPassword =
    cliArgs.payloadPassword ?? process.env.PAYLOAD_PASSWORD ?? "";

  const missing: string[] = [];
  if (!strapiUrl) missing.push("--strapi-url / STRAPI_URL");
  if (!strapiToken) missing.push("--strapi-token / STRAPI_TOKEN");
  if (!payloadEmail) missing.push("--payload-email / PAYLOAD_EMAIL");
  if (!payloadPassword) missing.push("--payload-password / PAYLOAD_PASSWORD");

  if (missing.length > 0) {
    console.error("Missing required configuration:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  return { strapiUrl, strapiToken, payloadUrl, payloadEmail, payloadPassword };
}

// ---------------------------------------------------------------------------
// Strapi API types
// ---------------------------------------------------------------------------

interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

interface StrapiResponse<T> {
  data: StrapiItem<T>[];
  meta: {
    pagination: StrapiPagination;
  };
}

interface StrapiItem<T> {
  id: number;
  attributes: T;
}

// Strapi block/inline content types
interface StrapiBlockChild {
  type: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  children?: StrapiBlockChild[];
  url?: string;
}

interface StrapiBlock {
  type: string;
  level?: number; // for headings (1-6)
  format?: "ordered" | "unordered"; // for lists
  children?: StrapiBlockChild[];
  // image fields (skipped)
  image?: unknown;
}

interface StrapiRelation {
  data: { id: number } | { id: number }[] | null;
}

// Collection-specific attribute shapes
interface StrapiTagAttributes {
  name: string;
  display: string;
  tag_id: string;
  publishedAt: string | null;
}

interface StrapiStoryAttributes {
  title: string;
  slug: string;
  synopsis: string | null;
  tags: StrapiRelation;
  publishedAt: string | null;
}

interface StrapiBlogAttributes {
  title: string;
  slug: string;
  contents: StrapiBlock[] | null;
  tags: StrapiRelation;
  publishedAt: string | null;
  header?: unknown;
}

interface StrapiOtherAttributes {
  title: string;
  slug: string;
  contents: StrapiBlock[] | null;
  tags: StrapiRelation;
  publishedAt: string | null;
}

interface StrapiChapterAttributes {
  chapter_title: string;
  chapter_number: number;
  slug: string;
  contents: StrapiBlock[] | null;
  story: StrapiRelation;
  publishedAt: string | null;
}

// ---------------------------------------------------------------------------
// Lexical node types
// ---------------------------------------------------------------------------

interface LexicalTextNode {
  type: "text";
  version: number;
  text: string;
  format: number; // bitmask
  mode: "normal";
  style: "";
  detail: number;
}

interface LexicalParagraphNode {
  type: "paragraph";
  version: number;
  children: LexicalTextNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  textFormat: number;
  textStyle: "";
}

interface LexicalHeadingNode {
  type: "heading";
  version: number;
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  children: LexicalTextNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  textFormat: number;
  textStyle: "";
}

interface LexicalListItemNode {
  type: "listitem";
  version: number;
  children: LexicalTextNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  value: number;
  checked?: boolean;
}

interface LexicalListNode {
  type: "list";
  version: number;
  listType: "number" | "bullet";
  tag: "ol" | "ul";
  children: LexicalListItemNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  start: number;
}

interface LexicalQuoteNode {
  type: "quote";
  version: number;
  children: LexicalTextNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  textFormat: number;
  textStyle: "";
}

interface LexicalCodeNode {
  type: "code";
  version: number;
  children: LexicalTextNode[];
  direction: "ltr" | null;
  format: "";
  indent: number;
  language: string;
}

type LexicalTopNode =
  | LexicalParagraphNode
  | LexicalHeadingNode
  | LexicalListNode
  | LexicalQuoteNode
  | LexicalCodeNode;

interface LexicalRoot {
  root: {
    type: "root";
    version: number;
    children: LexicalTopNode[];
    direction: "ltr" | null;
    format: "";
    indent: number;
  };
}

// ---------------------------------------------------------------------------
// Lexical helpers
// ---------------------------------------------------------------------------

/** Bitmask flags matching Lexical's IS_* constants */
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

function textFormat(child: StrapiBlockChild): number {
  let fmt = 0;
  if (child.bold) fmt |= FORMAT_BOLD;
  if (child.italic) fmt |= FORMAT_ITALIC;
  if (child.strikethrough) fmt |= FORMAT_STRIKETHROUGH;
  if (child.underline) fmt |= FORMAT_UNDERLINE;
  if (child.code) fmt |= FORMAT_CODE;
  return fmt;
}

function makeLexicalText(child: StrapiBlockChild): LexicalTextNode {
  return {
    type: "text",
    version: 1,
    text: child.text ?? "",
    format: textFormat(child),
    mode: "normal",
    style: "",
    detail: 0,
  };
}

/** Recursively extract all text from a Strapi block tree */
function extractText(children: StrapiBlockChild[] | undefined): string {
  if (!children) return "";
  return children
    .map((c) => (c.text !== undefined ? c.text : extractText(c.children)))
    .join("");
}

function childrenToLexicalTexts(
  children: StrapiBlockChild[] | undefined
): LexicalTextNode[] {
  if (!children || children.length === 0) {
    return [
      {
        type: "text",
        version: 1,
        text: "",
        format: 0,
        mode: "normal",
        style: "",
        detail: 0,
      },
    ];
  }
  // Flatten: text-type children are converted directly; non-text inlines (e.g.
  // links) have their visible text extracted so content is not silently dropped.
  return children.flatMap((c) => {
    if (c.type === "text") return [makeLexicalText(c)];
    // Non-text inline (e.g. link) — preserve visible text, lose href
    const text = extractText(c.children);
    if (!text) return [];
    return [makeLexicalText({ ...c, type: "text", text })];
  });
}

function makeParagraph(
  children: StrapiBlockChild[] | undefined
): LexicalParagraphNode {
  return {
    type: "paragraph",
    version: 1,
    children: childrenToLexicalTexts(children),
    direction: "ltr",
    format: "",
    indent: 0,
    textFormat: 0,
    textStyle: "",
  };
}

function convertStrapiBlocksToLexical(
  blocks: StrapiBlock[] | null | undefined
): LexicalRoot {
  const children: LexicalTopNode[] = [];

  if (!blocks || blocks.length === 0) {
    children.push(makeParagraph([]));
    return {
      root: {
        type: "root",
        version: 1,
        children,
        direction: "ltr",
        format: "",
        indent: 0,
      },
    };
  }

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph": {
        children.push(makeParagraph(block.children));
        break;
      }

      case "heading": {
        const level = block.level ?? 1;
        const tag = `h${Math.min(Math.max(level, 1), 6)}` as
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "h5"
          | "h6";
        children.push({
          type: "heading",
          version: 1,
          tag,
          children: childrenToLexicalTexts(block.children),
          direction: "ltr",
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
        });
        break;
      }

      case "list": {
        const isOrdered = block.format === "ordered";
        const listItems: LexicalListItemNode[] = [];
        let valueCounter = 1;

        for (const child of block.children ?? []) {
          if (child.type === "list-item") {
            listItems.push({
              type: "listitem",
              version: 1,
              children: childrenToLexicalTexts(child.children),
              direction: "ltr",
              format: "",
              indent: 0,
              value: valueCounter++,
            });
          }
        }

        if (listItems.length > 0) {
          children.push({
            type: "list",
            version: 1,
            listType: isOrdered ? "number" : "bullet",
            tag: isOrdered ? "ol" : "ul",
            children: listItems,
            direction: "ltr",
            format: "",
            indent: 0,
            start: 1,
          });
        }
        break;
      }

      case "quote": {
        children.push({
          type: "quote",
          version: 1,
          children: childrenToLexicalTexts(block.children),
          direction: "ltr",
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
        });
        break;
      }

      case "code": {
        children.push({
          type: "code",
          version: 1,
          children: childrenToLexicalTexts(block.children),
          direction: "ltr",
          format: "",
          indent: 0,
          language: "",
        });
        break;
      }

      case "image": {
        // Media out of scope — skip
        break;
      }

      default: {
        // Unknown block type — emit as plain paragraph using extracted text
        const text = extractText(block.children);
        children.push({
          type: "paragraph",
          version: 1,
          children: [
            {
              type: "text",
              version: 1,
              text,
              format: 0,
              mode: "normal",
              style: "",
              detail: 0,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
        });
        break;
      }
    }
  }

  return {
    root: {
      type: "root",
      version: 1,
      children,
      direction: "ltr",
      format: "",
      indent: 0,
    },
  };
}

/** Convert plain text to a minimal Lexical document */
function plainTextToLexical(text: string | null | undefined): LexicalRoot {
  return {
    root: {
      type: "root",
      version: 1,
      children: [
        {
          type: "paragraph",
          version: 1,
          children: [
            {
              type: "text",
              version: 1,
              text: text ?? "",
              format: 0,
              mode: "normal",
              style: "",
              detail: 0,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Strapi API helpers
// ---------------------------------------------------------------------------

async function fetchStrapiPage<T>(
  baseUrl: string,
  token: string,
  collection: string,
  page: number
): Promise<StrapiResponse<T>> {
  const url = new URL(`${baseUrl}/api/${collection}`);
  url.searchParams.set("populate", "*");
  url.searchParams.set("pagination[page]", String(page));
  url.searchParams.set("pagination[pageSize]", "100");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Strapi ${collection} page ${page}: HTTP ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<StrapiResponse<T>>;
}

async function fetchAllStrapi<T>(
  baseUrl: string,
  token: string,
  collection: string
): Promise<StrapiItem<T>[]> {
  const items: StrapiItem<T>[] = [];
  let page = 1;

  while (true) {
    const data = await fetchStrapiPage<T>(baseUrl, token, collection, page);
    items.push(...data.data);

    if (page >= data.meta.pagination.pageCount) break;
    page++;
  }

  return items;
}

// ---------------------------------------------------------------------------
// Payload API helpers
// ---------------------------------------------------------------------------

async function payloadLogin(
  payloadUrl: string,
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(`${payloadUrl}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Payload login failed: HTTP ${res.status} ${res.statusText}\n${body}`
    );
  }

  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error("Payload login: no token in response");
  return json.token;
}

async function payloadCreate(
  payloadUrl: string,
  token: string,
  collection: string,
  data: Record<string, unknown>,
  isDraft: boolean
): Promise<{ id: number | string }> {
  const url = isDraft
    ? `${payloadUrl}/api/${collection}?draft=true`
    : `${payloadUrl}/api/${collection}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `JWT ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Payload POST /${collection} HTTP ${res.status}: ${body}`
    );
  }

  const json = (await res.json()) as {
    doc?: { id?: number | string };
    id?: number | string;
  };
  const id = json.doc?.id ?? json.id;
  if (id === undefined)
    throw new Error(`POST /${collection}: no id in response`);
  return { id };
}

// ---------------------------------------------------------------------------
// Relation helpers
// ---------------------------------------------------------------------------

function getRelationIds(rel: StrapiRelation | undefined | null): number[] {
  if (!rel || !rel.data) return [];
  if (Array.isArray(rel.data)) return rel.data.map((d) => d.id);
  return [rel.data.id];
}

function mapIds(
  strapiIds: number[],
  idMap: Map<number, number | string>
): (number | string)[] {
  return strapiIds
    .map((sid) => idMap.get(sid))
    .filter((id): id is number | string => id !== undefined);
}

// ---------------------------------------------------------------------------
// Summary tracking
// ---------------------------------------------------------------------------

interface CollectionSummary {
  inserted: number;
  skipped: number;
}

const summary = new Map<string, CollectionSummary>();

function initSummary(name: string) {
  summary.set(name, { inserted: 0, skipped: 0 });
}

function recordInserted(name: string) {
  const s = summary.get(name) ?? { inserted: 0, skipped: 0 };
  s.inserted++;
  summary.set(name, s);
}

function recordSkipped(name: string) {
  const s = summary.get(name) ?? { inserted: 0, skipped: 0 };
  s.skipped++;
  summary.set(name, s);
}

function printSummary() {
  console.log("\n=== Migration Summary ===");
  console.log(
    `${"Collection".padEnd(12)} ${"Inserted".padEnd(10)} ${"Skipped".padEnd(10)}`
  );
  console.log("-".repeat(34));
  for (const [name, stats] of summary.entries()) {
    console.log(
      `${name.padEnd(12)} ${String(stats.inserted).padEnd(10)} ${String(stats.skipped).padEnd(10)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Collection migrations
// ---------------------------------------------------------------------------

async function migrateTags(
  cfg: Config,
  payloadToken: string
): Promise<Map<number, number | string>> {
  const label = "Tags";
  initSummary(label);
  const idMap = new Map<number, number | string>();

  const items = await fetchAllStrapi<StrapiTagAttributes>(
    cfg.strapiUrl,
    cfg.strapiToken,
    "tags"
  );
  console.log(`[${label}] Inserting ${items.length} records...`);

  for (const item of items) {
    const attrs = item.attributes;
    const isDraft = !attrs.publishedAt;

    try {
      const result = await payloadCreate(
        cfg.payloadUrl,
        payloadToken,
        "tags",
        {
          name: attrs.name,
          display: attrs.display,
          slug: attrs.tag_id,
        },
        isDraft
      );
      idMap.set(item.id, result.id);
      recordInserted(label);
      console.log(
        `[${label}] Inserted tag "${attrs.display}" (strapi: ${item.id} → payload: ${result.id})`
      );
    } catch (err) {
      recordSkipped(label);
      console.error(
        `[${label}] Failed to insert tag "${attrs.display}" (strapi: ${item.id}):`,
        (err as Error).message
      );
    }
  }

  return idMap;
}

async function migrateStories(
  cfg: Config,
  payloadToken: string,
  tagIdMap: Map<number, number | string>
): Promise<Map<number, number | string>> {
  const label = "Stories";
  initSummary(label);
  const idMap = new Map<number, number | string>();

  const items = await fetchAllStrapi<StrapiStoryAttributes>(
    cfg.strapiUrl,
    cfg.strapiToken,
    "stories"
  );
  console.log(`[${label}] Inserting ${items.length} records...`);

  for (const item of items) {
    const attrs = item.attributes;
    const isDraft = !attrs.publishedAt;
    const strapiTagIds = getRelationIds(attrs.tags);
    const payloadTagIds = mapIds(strapiTagIds, tagIdMap);

    try {
      const result = await payloadCreate(
        cfg.payloadUrl,
        payloadToken,
        "stories",
        {
          title: attrs.title,
          slug: attrs.slug,
          description: plainTextToLexical(attrs.synopsis),
          tags: payloadTagIds,
        },
        isDraft
      );
      idMap.set(item.id, result.id);
      recordInserted(label);
      console.log(
        `[${label}] Inserted story "${attrs.title}" (strapi: ${item.id} → payload: ${result.id})`
      );
    } catch (err) {
      recordSkipped(label);
      console.error(
        `[${label}] Failed to insert story "${attrs.title}" (strapi: ${item.id}):`,
        (err as Error).message
      );
    }
  }

  return idMap;
}

async function migrateBlogs(
  cfg: Config,
  payloadToken: string,
  tagIdMap: Map<number, number | string>
): Promise<void> {
  const label = "Blogs";
  initSummary(label);

  const items = await fetchAllStrapi<StrapiBlogAttributes>(
    cfg.strapiUrl,
    cfg.strapiToken,
    "blogs"
  );
  console.log(`[${label}] Inserting ${items.length} records...`);

  for (const item of items) {
    const attrs = item.attributes;
    const isDraft = !attrs.publishedAt;
    const strapiTagIds = getRelationIds(attrs.tags);
    const payloadTagIds = mapIds(strapiTagIds, tagIdMap);

    try {
      const result = await payloadCreate(
        cfg.payloadUrl,
        payloadToken,
        "blogs",
        {
          title: attrs.title,
          slug: attrs.slug,
          contents: convertStrapiBlocksToLexical(attrs.contents),
          tags: payloadTagIds,
          // header (media) intentionally skipped
        },
        isDraft
      );
      recordInserted(label);
      console.log(
        `[${label}] Inserted blog "${attrs.title}" (strapi: ${item.id} → payload: ${result.id})`
      );
    } catch (err) {
      recordSkipped(label);
      console.error(
        `[${label}] Failed to insert blog "${attrs.title}" (strapi: ${item.id}):`,
        (err as Error).message
      );
    }
  }
}

async function migrateOthers(
  cfg: Config,
  payloadToken: string,
  tagIdMap: Map<number, number | string>
): Promise<void> {
  const label = "Others";
  initSummary(label);

  const items = await fetchAllStrapi<StrapiOtherAttributes>(
    cfg.strapiUrl,
    cfg.strapiToken,
    "others"
  );
  console.log(`[${label}] Inserting ${items.length} records...`);

  for (const item of items) {
    const attrs = item.attributes;
    const isDraft = !attrs.publishedAt;
    const strapiTagIds = getRelationIds(attrs.tags);
    const payloadTagIds = mapIds(strapiTagIds, tagIdMap);

    try {
      const result = await payloadCreate(
        cfg.payloadUrl,
        payloadToken,
        "others",
        {
          title: attrs.title,
          slug: attrs.slug,
          contents: convertStrapiBlocksToLexical(attrs.contents),
          tags: payloadTagIds,
        },
        isDraft
      );
      recordInserted(label);
      console.log(
        `[${label}] Inserted other "${attrs.title}" (strapi: ${item.id} → payload: ${result.id})`
      );
    } catch (err) {
      recordSkipped(label);
      console.error(
        `[${label}] Failed to insert other "${attrs.title}" (strapi: ${item.id}):`,
        (err as Error).message
      );
    }
  }
}

async function migrateChapters(
  cfg: Config,
  payloadToken: string,
  storyIdMap: Map<number, number | string>
): Promise<void> {
  const label = "Chapters";
  initSummary(label);

  const items = await fetchAllStrapi<StrapiChapterAttributes>(
    cfg.strapiUrl,
    cfg.strapiToken,
    "chapters"
  );
  console.log(`[${label}] Inserting ${items.length} records...`);

  for (const item of items) {
    const attrs = item.attributes;
    const isDraft = !attrs.publishedAt;
    const strapiStoryIds = getRelationIds(attrs.story);
    const payloadStoryId =
      strapiStoryIds.length > 0 ? storyIdMap.get(strapiStoryIds[0]) : undefined;

    if (strapiStoryIds.length > 0 && payloadStoryId === undefined) {
      console.warn(
        `[${label}] Chapter "${attrs.chapter_title}" (strapi: ${item.id}) references story strapi:${strapiStoryIds[0]} which has no Payload mapping — story relation will be omitted`
      );
    }

    try {
      const result = await payloadCreate(
        cfg.payloadUrl,
        payloadToken,
        "chapters",
        {
          title: attrs.chapter_title,
          chapterNumber: attrs.chapter_number,
          slug: attrs.slug,
          contents: convertStrapiBlocksToLexical(attrs.contents),
          ...(payloadStoryId !== undefined ? { story: payloadStoryId } : {}),
        },
        isDraft
      );
      recordInserted(label);
      console.log(
        `[${label}] Inserted chapter "${attrs.chapter_title}" (strapi: ${item.id} → payload: ${result.id})`
      );
    } catch (err) {
      recordSkipped(label);
      console.error(
        `[${label}] Failed to insert chapter "${attrs.chapter_title}" (strapi: ${item.id}):`,
        (err as Error).message
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cfg = buildConfig();

  console.log("Logging in to Payload...");
  const payloadToken = await payloadLogin(
    cfg.payloadUrl,
    cfg.payloadEmail,
    cfg.payloadPassword
  );
  console.log("Payload login successful.");

  // 1. Tags (no dependencies)
  const tagIdMap = await migrateTags(cfg, payloadToken);

  // 2. Stories (references tags)
  const storyIdMap = await migrateStories(cfg, payloadToken, tagIdMap);

  // 3. Blogs (references tags)
  await migrateBlogs(cfg, payloadToken, tagIdMap);

  // 4. Others (references tags)
  await migrateOthers(cfg, payloadToken, tagIdMap);

  // 5. Chapters (references stories)
  await migrateChapters(cfg, payloadToken, storyIdMap);

  printSummary();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
