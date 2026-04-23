# Strapi → Payload Migration Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a single TypeScript script (`payload/scripts/migrate.ts`) that fetches all content from a production Strapi instance via REST API and inserts it into a local Payload instance via REST API.

**Architecture:** The script is organized into four concerns: config resolution (CLI args > env vars), a Strapi paginated fetch client, a Strapi blocks → Lexical converter, and a Payload REST inserter. Collections are inserted in dependency order (tags → stories → blogs → others → chapters) with a Strapi-ID-to-Payload-ID map maintained per collection to resolve relations.

**Tech Stack:** Node.js 22+ (native TS type stripping — no build step), native `fetch`, Payload's generated types from `payload/src/payload-types.ts`.

---

## File Structure

| File | Role |
|---|---|
| `payload/scripts/migrate.ts` | Single migration script — config, fetch, convert, insert, summary |
| `payload/tests/int/migrate-converter.int.spec.ts` | Unit tests for the blocks→Lexical converter |

---

## Background: Key Data Formats

### Strapi REST response envelope
```json
{
  "data": [{ "id": 1, "attributes": { "title": "...", "publishedAt": "2024-01-01T..." } }],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 3, "total": 250 } }
}
```
`publishedAt` is a date string if published, `null` if draft.

### Strapi blocks node shapes
```json
{ "type": "paragraph", "children": [{ "type": "text", "text": "Hello", "bold": true }] }
{ "type": "heading", "level": 2, "children": [{ "type": "text", "text": "Title" }] }
{ "type": "list", "format": "ordered", "children": [{ "type": "list-item", "children": [{ "type": "text", "text": "Item" }] }] }
{ "type": "quote", "children": [{ "type": "text", "text": "Quoted" }] }
{ "type": "code", "children": [{ "type": "text", "text": "const x = 1" }] }
```
Inline text marks: `bold`, `italic`, `underline`, `strikethrough`, `code` (boolean fields on text nodes).

### Lexical format (what Payload stores)
```json
{
  "root": {
    "type": "root", "version": 1, "direction": "ltr", "format": "", "indent": 0,
    "children": [
      {
        "type": "paragraph", "version": 1, "direction": "ltr", "format": "", "indent": 0,
        "children": [
          { "type": "text", "version": 1, "text": "Hello", "format": 1, "detail": 0, "mode": "normal", "style": "" }
        ]
      }
    ]
  }
}
```
Text `format` is a bitmask: bold=1, italic=2, strikethrough=4, underline=8, code=16.

### Payload REST endpoints
- `POST /api/users/login` — body `{ email, password }` → returns `{ token }`
- `POST /api/tags` — body is a Tag object; add `Authorization: JWT <token>` header
- `POST /api/stories`, `POST /api/blogs`, `POST /api/others`, `POST /api/chapters` — same pattern
- To publish: include `"_status": "published"` in body
- To create as draft: omit `_status` or include `"_status": "draft"`

---

## Task 1: Write failing tests for the blocks→Lexical converter

**Files:**
- Create: `payload/tests/int/migrate-converter.int.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
// payload/tests/int/migrate-converter.int.spec.ts
import { describe, it, expect } from "vitest";
import { convertBlocksToLexical, convertTextNode } from "../../scripts/migrate.ts";

describe("convertTextNode", () => {
  it("converts plain text with no marks", () => {
    const result = convertTextNode({ type: "text", text: "Hello" });
    expect(result).toEqual({
      type: "text", version: 1, text: "Hello",
      format: 0, detail: 0, mode: "normal", style: "",
    });
  });

  it("applies bold (format=1)", () => {
    const result = convertTextNode({ type: "text", text: "Bold", bold: true });
    expect(result.format).toBe(1);
  });

  it("applies italic (format=2)", () => {
    const result = convertTextNode({ type: "text", text: "Italic", italic: true });
    expect(result.format).toBe(2);
  });

  it("applies strikethrough (format=4)", () => {
    const result = convertTextNode({ type: "text", text: "Strike", strikethrough: true });
    expect(result.format).toBe(4);
  });

  it("applies underline (format=8)", () => {
    const result = convertTextNode({ type: "text", text: "Under", underline: true });
    expect(result.format).toBe(8);
  });

  it("applies code (format=16)", () => {
    const result = convertTextNode({ type: "text", text: "code", code: true });
    expect(result.format).toBe(16);
  });

  it("combines multiple marks as bitmask", () => {
    const result = convertTextNode({ type: "text", text: "BoldItalic", bold: true, italic: true });
    expect(result.format).toBe(3); // 1 + 2
  });
});

describe("convertBlocksToLexical", () => {
  it("wraps output in a root node", () => {
    const result = convertBlocksToLexical([]);
    expect(result.root.type).toBe("root");
    expect(result.root.children).toEqual([]);
  });

  it("converts a paragraph block", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", text: "Hi" }] }];
    const result = convertBlocksToLexical(blocks);
    const para = result.root.children[0];
    expect(para.type).toBe("paragraph");
    expect(para.children[0].text).toBe("Hi");
  });

  it("converts a heading block", () => {
    const blocks = [{ type: "heading", level: 2, children: [{ type: "text", text: "Title" }] }];
    const result = convertBlocksToLexical(blocks);
    const heading = result.root.children[0];
    expect(heading.type).toBe("heading");
    expect(heading.tag).toBe("h2");
  });

  it("converts an ordered list block", () => {
    const blocks = [{
      type: "list", format: "ordered",
      children: [{ type: "list-item", children: [{ type: "text", text: "Item" }] }],
    }];
    const result = convertBlocksToLexical(blocks);
    const list = result.root.children[0];
    expect(list.type).toBe("list");
    expect(list.listType).toBe("number");
    expect(list.children[0].type).toBe("listitem");
  });

  it("converts an unordered list block", () => {
    const blocks = [{
      type: "list", format: "unordered",
      children: [{ type: "list-item", children: [{ type: "text", text: "Item" }] }],
    }];
    const result = convertBlocksToLexical(blocks);
    expect(result.root.children[0].listType).toBe("bullet");
  });

  it("converts a quote block", () => {
    const blocks = [{ type: "quote", children: [{ type: "text", text: "Wise words" }] }];
    const result = convertBlocksToLexical(blocks);
    expect(result.root.children[0].type).toBe("quote");
  });

  it("converts a code block", () => {
    const blocks = [{ type: "code", children: [{ type: "text", text: "const x = 1" }] }];
    const result = convertBlocksToLexical(blocks);
    expect(result.root.children[0].type).toBe("code");
  });

  it("falls back to paragraph for unknown block types", () => {
    const blocks = [{ type: "image", url: "https://example.com/img.png", children: [{ type: "text", text: "" }] }];
    const result = convertBlocksToLexical(blocks);
    expect(result.root.children[0].type).toBe("paragraph");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm test:int 2>&1 | head -30
```

Expected: `Cannot find module '../../scripts/migrate.ts'`

---

## Task 2: Implement the blocks→Lexical converter and config parser (make tests pass)

**Files:**
- Create: `payload/scripts/migrate.ts`

- [ ] **Step 1: Create the script with config parsing and the converter**

```typescript
// payload/scripts/migrate.ts

// ── Config ────────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function getConfig() {
  const args = parseArgs();
  const get = (argKey: string, envKey: string, fallback?: string): string => {
    const val = args[argKey] ?? process.env[envKey] ?? fallback;
    if (!val) throw new Error(`Required: --${argKey} or ${envKey} env var`);
    return val;
  };
  return {
    strapiUrl: get("strapi-url", "STRAPI_URL"),
    strapiToken: get("strapi-token", "STRAPI_TOKEN"),
    payloadUrl: get("payload-url", "PAYLOAD_URL", "http://localhost:3000"),
    payloadEmail: get("payload-email", "PAYLOAD_EMAIL"),
    payloadPassword: get("payload-password", "PAYLOAD_PASSWORD"),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrapiTextNode {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

interface StrapiBlock {
  type: string;
  level?: number;
  format?: string;
  children: (StrapiTextNode | StrapiBlock)[];
  [k: string]: unknown;
}

interface LexicalTextNode {
  type: "text";
  version: 1;
  text: string;
  format: number;
  detail: 0;
  mode: "normal";
  style: "";
}

interface LexicalNode {
  type: string;
  version: 1;
  direction: "ltr";
  format: string;
  indent: 0;
  children?: (LexicalNode | LexicalTextNode)[];
  [k: string]: unknown;
}

interface LexicalRoot {
  root: {
    type: "root";
    version: 1;
    direction: "ltr";
    format: "";
    indent: 0;
    children: (LexicalNode | LexicalTextNode)[];
  };
}

// ── Converter ─────────────────────────────────────────────────────────────────

export function convertTextNode(node: StrapiTextNode): LexicalTextNode {
  let format = 0;
  if (node.bold) format |= 1;
  if (node.italic) format |= 2;
  if (node.strikethrough) format |= 4;
  if (node.underline) format |= 8;
  if (node.code) format |= 16;
  return { type: "text", version: 1, text: node.text, format, detail: 0, mode: "normal", style: "" };
}

function convertChildren(children: (StrapiTextNode | StrapiBlock)[]): (LexicalNode | LexicalTextNode)[] {
  return children.map((child) => {
    if (child.type === "text") return convertTextNode(child as StrapiTextNode);
    if (child.type === "list-item") {
      return {
        type: "listitem", version: 1 as const, direction: "ltr" as const, format: "" as const, indent: 0 as const,
        children: convertChildren((child as StrapiBlock).children),
      };
    }
    return convertTextNode({ type: "text", text: extractText(child as StrapiBlock) });
  });
}

function extractText(block: StrapiBlock): string {
  return block.children
    .map((c) => (c.type === "text" ? (c as StrapiTextNode).text : extractText(c as StrapiBlock)))
    .join("");
}

function convertBlock(block: StrapiBlock): LexicalNode {
  const base = { version: 1 as const, direction: "ltr" as const, format: "" as const, indent: 0 as const };
  switch (block.type) {
    case "paragraph":
      return { ...base, type: "paragraph", children: convertChildren(block.children) };
    case "heading":
      return { ...base, type: "heading", tag: `h${block.level ?? 1}`, children: convertChildren(block.children) };
    case "list":
      return {
        ...base, type: "list",
        listType: block.format === "ordered" ? "number" : "bullet",
        children: convertChildren(block.children),
      };
    case "quote":
      return { ...base, type: "quote", children: convertChildren(block.children) };
    case "code":
      return { ...base, type: "code", children: convertChildren(block.children) };
    default:
      return { ...base, type: "paragraph", children: [convertTextNode({ type: "text", text: extractText(block) })] };
  }
}

export function convertBlocksToLexical(blocks: StrapiBlock[]): LexicalRoot {
  return {
    root: {
      type: "root", version: 1, direction: "ltr", format: "", indent: 0,
      children: blocks.map(convertBlock),
    },
  };
}

function wrapPlainTextAsLexical(text: string | null | undefined): LexicalRoot {
  return convertBlocksToLexical(
    text ? [{ type: "paragraph", children: [{ type: "text", text }] }] : []
  );
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm test:int 2>&1 | tail -20
```

Expected: all converter tests pass.

- [ ] **Step 3: Commit**

```sh
git add payload/scripts/migrate.ts payload/tests/int/migrate-converter.int.spec.ts
git commit -m "feat: add blocks→Lexical converter and config parser for migration script"
```

---

## Task 3: Add Strapi paginated fetch client

**Files:**
- Modify: `payload/scripts/migrate.ts`

- [ ] **Step 1: Append the Strapi client to the script**

Add this after the converter section in `payload/scripts/migrate.ts`:

```typescript
// ── Strapi client ─────────────────────────────────────────────────────────────

interface StrapiResponse<T> {
  data: Array<{ id: number; attributes: T }>;
  meta: { pagination: { page: number; pageCount: number; total: number } };
}

async function strapiGetAll<T>(baseUrl: string, token: string, path: string): Promise<Array<{ id: number } & T>> {
  const results: Array<{ id: number } & T> = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const url = `${baseUrl}/api/${path}?populate=*&pagination[page]=${page}&pagination[pageSize]=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Strapi fetch failed: ${res.status} ${url}`);
    const json = (await res.json()) as StrapiResponse<T>;
    for (const item of json.data) results.push({ id: item.id, ...item.attributes } as { id: number } & T);
    pageCount = json.meta.pagination.pageCount;
    page++;
  }
  return results;
}
```

- [ ] **Step 2: Confirm tests still pass**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm test:int 2>&1 | tail -5
```

Expected: all tests pass (no regressions).

- [ ] **Step 3: Commit**

```sh
git add payload/scripts/migrate.ts
git commit -m "feat: add Strapi paginated fetch client to migration script"
```

---

## Task 4: Add Payload REST client (login + create)

**Files:**
- Modify: `payload/scripts/migrate.ts`

- [ ] **Step 1: Append the Payload client to the script**

Add after the Strapi client section:

```typescript
// ── Payload client ────────────────────────────────────────────────────────────

async function payloadLogin(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Payload login failed: ${res.status}`);
  const json = (await res.json()) as { token: string };
  return json.token;
}

async function payloadCreate(
  baseUrl: string,
  token: string,
  collection: string,
  data: Record<string, unknown>,
): Promise<number> {
  const res = await fetch(`${baseUrl}/api/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Payload create failed [${collection}]: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { doc: { id: number } };
  return json.doc.id;
}
```

- [ ] **Step 2: Confirm tests still pass**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm test:int 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```sh
git add payload/scripts/migrate.ts
git commit -m "feat: add Payload login and create client to migration script"
```

---

## Task 5: Add migration runners and main entry point

**Files:**
- Modify: `payload/scripts/migrate.ts`

- [ ] **Step 1: Append the migration runners and main function**

Add after the Payload client section:

```typescript
// ── Strapi attribute types ────────────────────────────────────────────────────

interface StrapiTag {
  id: number;
  name: string;
  display: string;
  tag_id: string;
  publishedAt: string | null;
}

interface StrapiStory {
  id: number;
  title: string | null;
  synopsis: string | null;
  slug: string;
  publishedAt: string | null;
  tags: { data: Array<{ id: number }> } | null;
}

interface StrapiBlog {
  id: number;
  title: string;
  slug: string;
  contents: StrapiBlock[];
  publishedAt: string | null;
  tags: { data: Array<{ id: number }> } | null;
}

interface StrapiOther {
  id: number;
  title: string;
  slug: string;
  contents: StrapiBlock[];
  publishedAt: string | null;
  tags: { data: Array<{ id: number }> } | null;
}

interface StrapiChapter {
  id: number;
  chapter_title: string | null;
  chapter_number: number;
  slug: string;
  contents: StrapiBlock[];
  publishedAt: string | null;
  story: { data: { id: number } | null } | null;
}

// ── Migration runners ─────────────────────────────────────────────────────────

type IdMap = Map<number, number>;

function status(publishedAt: string | null): "published" | "draft" {
  return publishedAt ? "published" : "draft";
}

async function migrateTags(
  strapiUrl: string, strapiToken: string,
  payloadUrl: string, payloadToken: string,
): Promise<IdMap> {
  console.log("Migrating tags...");
  const records = await strapiGetAll<StrapiTag>(strapiUrl, strapiToken, "tags");
  const idMap: IdMap = new Map();
  let count = 0;
  for (const tag of records) {
    try {
      const payloadId = await payloadCreate(payloadUrl, payloadToken, "tags", {
        name: tag.name,
        display: tag.display,
        slug: tag.tag_id,
        generateSlug: false,
        _status: status(tag.publishedAt),
      });
      idMap.set(tag.id, payloadId);
      count++;
    } catch (e) {
      console.warn(`  Skipped tag ${tag.id} (${tag.name}): ${(e as Error).message}`);
    }
  }
  console.log(`  Done: ${count}/${records.length} tags inserted`);
  return idMap;
}

async function migrateStories(
  strapiUrl: string, strapiToken: string,
  payloadUrl: string, payloadToken: string,
  tagIdMap: IdMap,
): Promise<IdMap> {
  console.log("Migrating stories...");
  const records = await strapiGetAll<StrapiStory>(strapiUrl, strapiToken, "stories");
  const idMap: IdMap = new Map();
  let count = 0;
  for (const story of records) {
    const tags = (story.tags?.data ?? []).map((t) => tagIdMap.get(t.id)).filter(Boolean) as number[];
    try {
      const payloadId = await payloadCreate(payloadUrl, payloadToken, "stories", {
        title: story.title,
        slug: story.slug,
        generateSlug: false,
        description: story.synopsis ? wrapPlainTextAsLexical(story.synopsis) : undefined,
        tags,
        _status: status(story.publishedAt),
      });
      idMap.set(story.id, payloadId);
      count++;
    } catch (e) {
      console.warn(`  Skipped story ${story.id} (${story.title}): ${(e as Error).message}`);
    }
  }
  console.log(`  Done: ${count}/${records.length} stories inserted`);
  return idMap;
}

async function migrateBlogs(
  strapiUrl: string, strapiToken: string,
  payloadUrl: string, payloadToken: string,
  tagIdMap: IdMap,
): Promise<number> {
  console.log("Migrating blogs...");
  const records = await strapiGetAll<StrapiBlog>(strapiUrl, strapiToken, "blogs");
  let count = 0;
  for (const blog of records) {
    const tags = (blog.tags?.data ?? []).map((t) => tagIdMap.get(t.id)).filter(Boolean) as number[];
    try {
      await payloadCreate(payloadUrl, payloadToken, "blogs", {
        title: blog.title,
        slug: blog.slug,
        generateSlug: false,
        contents: convertBlocksToLexical(blog.contents ?? []),
        tags,
        _status: status(blog.publishedAt),
      });
      count++;
    } catch (e) {
      console.warn(`  Skipped blog ${blog.id} (${blog.title}): ${(e as Error).message}`);
    }
  }
  console.log(`  Done: ${count}/${records.length} blogs inserted`);
  return count;
}

async function migrateOthers(
  strapiUrl: string, strapiToken: string,
  payloadUrl: string, payloadToken: string,
  tagIdMap: IdMap,
): Promise<number> {
  console.log("Migrating others...");
  const records = await strapiGetAll<StrapiOther>(strapiUrl, strapiToken, "others");
  let count = 0;
  for (const other of records) {
    const tags = (other.tags?.data ?? []).map((t) => tagIdMap.get(t.id)).filter(Boolean) as number[];
    try {
      await payloadCreate(payloadUrl, payloadToken, "others", {
        title: other.title,
        slug: other.slug,
        generateSlug: false,
        contents: convertBlocksToLexical(other.contents ?? []),
        tags,
        _status: status(other.publishedAt),
      });
      count++;
    } catch (e) {
      console.warn(`  Skipped other ${other.id} (${other.title}): ${(e as Error).message}`);
    }
  }
  console.log(`  Done: ${count}/${records.length} others inserted`);
  return count;
}

async function migrateChapters(
  strapiUrl: string, strapiToken: string,
  payloadUrl: string, payloadToken: string,
  storyIdMap: IdMap,
): Promise<number> {
  console.log("Migrating chapters...");
  const records = await strapiGetAll<StrapiChapter>(strapiUrl, strapiToken, "chapters");
  let count = 0;
  for (const chapter of records) {
    const storyPayloadId = chapter.story?.data?.id ? storyIdMap.get(chapter.story.data.id) : undefined;
    try {
      await payloadCreate(payloadUrl, payloadToken, "chapters", {
        title: chapter.chapter_title,
        chapterNumber: chapter.chapter_number,
        slug: chapter.slug,
        generateSlug: false,
        contents: convertBlocksToLexical(chapter.contents ?? []),
        story: storyPayloadId ?? null,
        _status: status(chapter.publishedAt),
      });
      count++;
    } catch (e) {
      console.warn(`  Skipped chapter ${chapter.id} (${chapter.chapter_title}): ${(e as Error).message}`);
    }
  }
  console.log(`  Done: ${count}/${records.length} chapters inserted`);
  return count;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const config = getConfig();
  console.log(`Strapi: ${config.strapiUrl}`);
  console.log(`Payload: ${config.payloadUrl}`);
  console.log("Logging into Payload...");
  const payloadToken = await payloadLogin(config.payloadUrl, config.payloadEmail, config.payloadPassword);
  console.log("Login successful.\n");

  const tagIdMap = await migrateTags(config.strapiUrl, config.strapiToken, config.payloadUrl, payloadToken);
  const storyIdMap = await migrateStories(config.strapiUrl, config.strapiToken, config.payloadUrl, payloadToken, tagIdMap);
  await migrateBlogs(config.strapiUrl, config.strapiToken, config.payloadUrl, payloadToken, tagIdMap);
  await migrateOthers(config.strapiUrl, config.strapiToken, config.payloadUrl, payloadToken, tagIdMap);
  await migrateChapters(config.strapiUrl, config.strapiToken, config.payloadUrl, payloadToken, storyIdMap);

  console.log("\nMigration complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Confirm tests still pass**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm test:int 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```sh
git add payload/scripts/migrate.ts
git commit -m "feat: add migration runners and main entry point"
```

---

## Task 6: Smoke test the script end-to-end

- [ ] **Step 1: Make sure Payload is running locally**

```sh
cd /Users/jim/projects/burbridge-lol/payload
pnpm dev
```

Leave it running, then open a new terminal.

- [ ] **Step 2: Run the script with `--help` flag absent to confirm it exits cleanly on missing config**

```sh
cd /Users/jim/projects/burbridge-lol
node payload/scripts/migrate.ts 2>&1
```

Expected: `Error: Required: --strapi-url or STRAPI_URL env var`

- [ ] **Step 3: Run with real credentials**

```sh
node payload/scripts/migrate.ts \
  --strapi-url=https://YOUR_STRAPI_URL \
  --strapi-token=YOUR_TOKEN \
  --payload-email=YOUR_EMAIL \
  --payload-password=YOUR_PASSWORD
```

Expected output:
```
Strapi: https://YOUR_STRAPI_URL
Payload: http://localhost:3000
Logging into Payload...
Login successful.

Migrating tags...
  Done: N/N tags inserted
Migrating stories...
  Done: N/N stories inserted
Migrating blogs...
  Done: N/N blogs inserted
Migrating others...
  Done: N/N others inserted
Migrating chapters...
  Done: N/N chapters inserted

Migration complete.
```

- [ ] **Step 4: Verify in Payload admin at `http://localhost:3000/admin` that records appear in each collection**

- [ ] **Step 5: Final commit**

```sh
git add -A
git commit -m "chore: verify migration script works end-to-end"
```
