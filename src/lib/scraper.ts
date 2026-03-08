import * as cheerio from "cheerio";

export interface ScrapedResource {
  title: string;
  description: string;
  url: string;
  source: "Wikipedia" | "arXiv" | "Dev.to" | "OpenLibrary" | "GitHub";
  label: "Article" | "Paper" | "Book" | "Repository" | "PDF / Notes";
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchSafe(
  url: string,
  opts?: { timeout?: number; accept?: string },
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeout ?? 8000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: opts?.accept ?? "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[scraper] ${url} returned ${res.status}`);
      return null;
    }
    return res;
  } catch (e) {
    console.warn(`[scraper] ${url} failed:`, (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Wikipedia ────────────────────────────────────────────────────────────────
async function scrapeWikipedia(topic: string): Promise<ScrapedResource[]> {
  const q = encodeURIComponent(topic);
  const res = await fetchSafe(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json`,
  );
  if (!res) return [];
  const data = await res.json();
  const items: { title: string; snippet: string }[] = data?.query?.search ?? [];
  return items.map((item) => ({
    title: item.title,
    description: cheerio.load(item.snippet ?? "").text(),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    source: "Wikipedia" as const,
    label: "Article" as const,
  }));
}

// ── arXiv ────────────────────────────────────────────────────────────────────
async function scrapeArxiv(topic: string): Promise<ScrapedResource[]> {
  const q = encodeURIComponent(topic);
  const res = await fetchSafe(
    `https://export.arxiv.org/api/query?search_query=all:${q}&max_results=3&sortBy=relevance`,
    { timeout: 10000, accept: "application/xml" },
  );
  if (!res) return [];
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const results: ScrapedResource[] = [];
  $("entry").each((_, el) => {
    const title = $(el).find("title").text().trim().replace(/\s+/g, " ");
    const summary = $(el)
      .find("summary")
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200);
    const id = $(el).find("id").text().trim();
    if (title && id) {
      results.push({
        title,
        description: summary,
        url: id,
        source: "arXiv",
        label: "Paper",
      });
    }
  });
  return results;
}

// ── Dev.to ───────────────────────────────────────────────────────────────────
async function scrapeDevTo(topic: string): Promise<ScrapedResource[]> {
  const q = encodeURIComponent(topic);
  const res = await fetchSafe(
    `https://dev.to/api/articles?per_page=3&top=365&search=${q}`,
  );
  if (!res) return [];
  let articles: { title?: string; description?: string; url?: string }[];
  try {
    articles = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(articles)) return [];
  return articles
    .filter((a) => a.title && a.url)
    .slice(0, 3)
    .map((a) => ({
      title: a.title!,
      description: a.description ?? "",
      url: a.url!,
      source: "Dev.to" as const,
      label: "Article" as const,
    }));
}

// ── OpenLibrary ──────────────────────────────────────────────────────────────
async function scrapeOpenLibrary(topic: string): Promise<ScrapedResource[]> {
  const q = encodeURIComponent(topic);
  const res = await fetchSafe(
    `https://openlibrary.org/search.json?q=${q}&limit=3&fields=title,author_name,key,first_sentence`,
    { timeout: 10000 },
  );
  if (!res) return [];
  const data = await res.json();
  const docs: Record<string, unknown>[] = data?.docs ?? [];
  return docs.slice(0, 3).map((d) => {
    const firstSentence = Array.isArray(d.first_sentence)
      ? (d.first_sentence as string[])[0]
      : (d.first_sentence as string) ?? "";
    const authors = Array.isArray(d.author_name)
      ? (d.author_name as string[]).slice(0, 2).join(", ")
      : "";
    return {
      title: (d.title as string) ?? "Untitled",
      description: firstSentence || (authors ? `By ${authors}` : ""),
      url: `https://openlibrary.org${d.key as string}`,
      source: "OpenLibrary" as const,
      label: "Book" as const,
    };
  });
}

// ── GitHub ────────────────────────────────────────────────────────────────────
async function scrapeGitHub(topic: string): Promise<ScrapedResource[]> {
  const q = encodeURIComponent(topic);
  const res = await fetchSafe(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=3`,
    { accept: "application/vnd.github.v3+json" },
  );
  if (!res) return [];
  const data = await res.json();
  const items: Record<string, unknown>[] = data?.items ?? [];
  return items.slice(0, 3).map((r) => ({
    title: (r.full_name as string) ?? "repo",
    description: ((r.description as string) ?? "").slice(0, 200),
    url: r.html_url as string,
    source: "GitHub" as const,
    label: "Repository" as const,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function scrapeResources(
  topic: string,
): Promise<ScrapedResource[]> {
  console.log(`[scraper] Scraping resources for: "${topic}"`);

  const results = await Promise.allSettled([
    scrapeWikipedia(topic),
    scrapeArxiv(topic),
    scrapeDevTo(topic),
    scrapeOpenLibrary(topic),
    scrapeGitHub(topic),
  ]);

  const sources = ["Wikipedia", "arXiv", "Dev.to", "OpenLibrary", "GitHub"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`[scraper] ${sources[i]}: ${r.value.length} results`);
    } else {
      console.warn(`[scraper] ${sources[i]} failed:`, r.reason);
    }
  });

  const all = results
    .filter(
      (r): r is PromiseFulfilledResult<ScrapedResource[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value)
    .filter((r) => r.title && r.url);

  console.log(`[scraper] Total scraped: ${all.length}`);
  return all;
}
