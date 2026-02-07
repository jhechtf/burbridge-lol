# Burbridge.lol Monorepo

For my personal site at [burbridge.lol](https://burbridge.lol)

Hosted on [Fly.io](https://fly.io)

## Why a monorepo?

Originally it wasn't. However I found that needing to switch a branch, put a PR up, or have multiple work trees in order to be WIP on multiple things was not a workflow I enjoyed, and hindered my urge to write. 

I had been thinking of a headless CMS solution originally, but went with Astro as it had collections, and I figured "close enough". 

To be clear, Astro is not the issue here. I would have ran into this same set of issues if I had decided to use a pre-rendered sveltekit, solidstart, tanstack start, etc.; -based application. Astro itself is still great, and considering I don't plan on any of the stories to ever grow to a point where I need much more interactions than scrolling, it should serve this site just fine.

When I added in Strapi, I figured I needed somthing better than running two terminal instances in my VSCode, so I moved to TurboRepo with PNPM.

## Why Strapi, why not...

I chose Strapi because I had seen a couple of posts from it, and figured why not. I got a rough example working (in sveltekit) and decided it would work well enough to just use it.

Now that said, I do have a couple of gripes with Strapi as it sits.

1. The base "rich text" blocks are great but I wish there was a way to easily extend them that was backwards compatible. I want to be able to use blockquotes without needing to install a whole damned extension.
2. The API limits are weird. I will likely never hit the free tier limits for cloud but the numbers feel low. If I end up posting more blogs that require images I might consider self hosting Strapi.