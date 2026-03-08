import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { scrapeResources, type ScrapedResource } from "@/lib/scraper";

export interface Resource {
  title: string;
  description: string;
  label: "Article" | "Course" | "PDF / Notes" | "Book" | "Paper";
  searchUrl: string;
}

const MODEL = "gemini-2.5-flash";

function searchUrl(label: Resource["label"], title: string, topic: string): string {
  const q = encodeURIComponent(title);
  const t = encodeURIComponent(topic);
  switch (label) {
    case "Article":
      return `https://www.google.com/search?q=${q}`;
    case "Course":
      return `https://www.coursera.org/search?query=${t}`;
    case "PDF / Notes":
      return `https://scholar.google.com/scholar?q=${encodeURIComponent(title + " lecture notes PDF")}`;
    case "Book":
      return `https://www.amazon.com/s?k=${q}`;
    case "Paper":
      return `https://arxiv.org/search/?query=${t}&searchtype=all`;
  }
}

const PROMPT = (topic: string) =>
  `You are a learning resource curator. For the topic "${topic}", recommend 6 closely related readings and resources.

Use exactly this format, one per line, pipe-separated:
LABEL | Title | One-sentence description of what the reader will learn.

Rules:
- LABEL must be one of: ARTICLE, ARTICLE, COURSE, PDF, BOOK, PAPER
- Title must be a real, well-known resource title (not a made-up one)
- Description must be specific to the title, not generic
- Output exactly 6 lines, nothing else

Example line:
ARTICLE | The Alchemy of Air | Explores how Fritz Haber and Carl Bosch invented the nitrogen-fixation process that feeds the world.`;

async function fetchGeminiResources(
  topic: string,
  apiKey: string,
): Promise<Resource[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  });

  const result = await model.generateContent(PROMPT(topic));
  const text = result.response.text().trim();

  const LABEL_MAP: Record<string, Resource["label"]> = {
    ARTICLE: "Article",
    COURSE: "Course",
    PDF: "PDF / Notes",
    BOOK: "Book",
    PAPER: "Paper",
  };

  return text
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.includes("|"))
    .slice(0, 6)
    .map((line: string) => {
      const parts = line.split("|").map((p: string) => p.trim());
      const rawLabel = parts[0].replace(/^[-\d.\s]+/, "").toUpperCase();
      const label: Resource["label"] = LABEL_MAP[rawLabel] ?? "Article";
      const title = parts[1] ?? topic;
      const description = parts[2] ?? "";
      return { title, description, label, searchUrl: searchUrl(label, title, topic) };
    })
    .filter((r: { title: string }) => r.title);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  let topic: string;
  try {
    const body = await request.json();
    topic = body.topic?.trim();
    if (!topic) throw new Error("missing topic");
  } catch {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  try {
    const promises: [
      Promise<Resource[]>,
      Promise<ScrapedResource[]>,
    ] = [
      apiKey
        ? fetchGeminiResources(topic, apiKey)
        : Promise.resolve([]),
      scrapeResources(topic),
    ];

    const [resources, scraped] = await Promise.allSettled(promises);

    const geminiResources: Resource[] =
      resources.status === "fulfilled" ? resources.value : [];
    const scrapedResources: ScrapedResource[] =
      scraped.status === "fulfilled" ? scraped.value : [];

    return NextResponse.json({
      resources: geminiResources,
      scraped: scrapedResources,
    });
  } catch (err) {
    console.error("Resources API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch resources" },
      { status: 502 },
    );
  }
}
