# Strapi → Payload Migration Script Design

**Date:** 2026-04-17

## Overview

A single TypeScript script (`payload/scripts/migrate.ts`) that reads all content from a production Strapi instance via its REST API and inserts it into a local Payload instance via its REST API.

## Configuration

The script is driven by environment variables:

| Variable | Default | Description |
|---|---|---|
| `STRAPI_URL` | *(required)* | Base URL of production Strapi (e.g. `https://cms.burbridge.lol`) |
| `STRAPI_TOKEN` | *(required)* | Strapi API token for authenticated access |
| `PAYLOAD_URL` | `http://localhost:3000` | Local Payload instance base URL |
| `PAYLOAD_EMAIL` | *(required)* | Payload admin email for login |
| `PAYLOAD_PASSWORD` | *(required)* | Payload admin password for login |

The script logs progress per collection and prints a summary (counts inserted, counts skipped) on completion.

## Insertion Order & ID Mapping

Records are inserted in dependency order to ensure relation IDs exist before they are referenced:

1. **Tags** — no dependencies
2. **Stories** — references tags
3. **Blogs** — references tags
4. **Others** — references tags
5. **Chapters** — references stories

A `strapiIdToPayload` map (one `Map<number, number>` per collection) is built as records are inserted. Each Strapi record's returned Payload ID is stored immediately after insertion so subsequent collections can resolve their relation IDs.

Records are inserted with their publish state preserved: published if Strapi's `publishedAt` is set, draft otherwise.

## Field Mapping

### Tag

| Strapi | Payload | Notes |
|---|---|---|
| `name` | `name` | direct |
| `display` | `display` | direct |
| `tag_id` | `slug` | direct copy |

### Story

| Strapi | Payload | Notes |
|---|---|---|
| `title` | `title` | direct |
| `slug` | `slug` | direct |
| `synopsis` | `description` | plain text → minimal Lexical JSON (single paragraph) |
| `tags` (relation ids) | `tags` | mapped via tag ID map |

### Blog

| Strapi | Payload | Notes |
|---|---|---|
| `title` | `title` | direct |
| `slug` | `slug` | direct |
| `contents` (blocks) | `contents` | Strapi blocks → Lexical (see below) |
| `tags` (relation ids) | `tags` | mapped via tag ID map |
| `header` | *(skipped)* | media migration out of scope |

### Other

| Strapi | Payload | Notes |
|---|---|---|
| `title` | `title` | direct |
| `slug` | `slug` | direct |
| `contents` (blocks) | `contents` | Strapi blocks → Lexical (see below) |
| `tags` (relation ids) | `tags` | mapped via tag ID map |

### Chapter

| Strapi | Payload | Notes |
|---|---|---|
| `chapter_title` | `title` | rename |
| `chapter_number` | `chapterNumber` | rename |
| `slug` | `slug` | direct |
| `contents` (blocks) | `contents` | Strapi blocks → Lexical (see below) |
| `story` (relation id) | `story` | mapped via story ID map |

## Strapi Blocks → Lexical Conversion

Handles the following Strapi block node types:

| Strapi type | Lexical equivalent |
|---|---|
| `paragraph` | `paragraph` node |
| `heading` (h1–h6) | `heading` node with matching tag |
| `list` (ordered) + `list-item` | `list` (number) + `listitem` nodes |
| `list` (unordered) + `list-item` | `list` (bullet) + `listitem` nodes |
| `quote` | `quote` node |
| `code` | `code` node |
| `image` | *(skipped — media out of scope)* |

Inline marks supported: `bold`, `italic`, `underline`, `strikethrough`, `code`.

Unrecognised block types are converted to a plain paragraph using extracted text content. The converter wraps all top-level nodes in a Lexical `root` node.

## Strapi API Pagination

Strapi paginates responses (default page size 25). The script fetches all pages per collection using `pagination[page]` and `pagination[pageSize]=100` query params, looping until `pagination.pageCount` is reached.

## Script Location

`payload/scripts/migrate.ts` — run with:

```sh
STRAPI_URL=https://... STRAPI_TOKEN=... PAYLOAD_EMAIL=... PAYLOAD_PASSWORD=... npx tsx payload/scripts/migrate.ts
```
