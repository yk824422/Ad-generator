import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API Route for scraping
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    // Basic URL validation
    new URL(url);
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      timeout: 9000, // Stay under Vercel's 10s limit
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 403 || response.status === 429) {
      return res.status(response.status).json({ 
        error: `Access Denied (${response.status}). The website is blocking automated access from this IP.`,
        isBlocked: true 
      });
    }

    if (!response.data || typeof response.data !== "string") {
      throw new Error("Empty or invalid response data from target website.");
    }

    const $ = cheerio.load(response.data);
    
    // Extract images including from picture tags
    const images: string[] = [];
    $("img, picture source").each((i, el) => {
      const src = $(el).attr("src") || $(el).attr("srcset")?.split(",")[0].split(" ")[0];
      if (src && !src.includes("data:image") && images.length < 15) {
        try {
          const absoluteUrl = new URL(src, url).href;
          if (!images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        } catch (e) {}
      }
    });

    const cleanText = (el: any) => {
      if (!el || $(el).length === 0) return "";
      const clone = $(el).clone();
      clone.find("script, style, noscript, iframe, svg").remove();
      return clone.text().replace(/\s+/g, " ").trim();
    };

    const structure: any = {
      title: $("title").text() || "Untitled Page",
      brandName: $("meta[property='og:site_name']").attr("content") || $("title").text().split(/[|-]/)[0].trim() || "Brand",
      images,
      sections: [],
    };

    // Identify common sections
    if ($("nav, header").length > 0) {
      structure.sections.push({
        id: "navbar",
        type: "navbar",
        content: {
          links: $("nav a, header a").map((i, el) => cleanText(el)).get().filter(t => t.length > 2).slice(0, 5)
        }
      });
    }

    // Hero section
    const h1 = $("h1").first();
    if (h1.length > 0) {
      structure.sections.push({
        id: "hero_section",
        type: "hero_section",
        content: {
          headline: cleanText(h1),
          subheadline: cleanText(h1.nextAll("p, h2, h3").first()),
          cta: $("a, button").filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes("get") || text.includes("buy") || text.includes("start") || text.includes("shop") || text.includes("sign") || text.includes("try");
          }).first().text().trim() || "Get Started"
        }
      });
    }

    // Other sections
    $("section, div[id*='section'], div[class*='section'], article").each((i, el) => {
      const h2 = cleanText($(el).find("h2, h3").first());
      const p = cleanText($(el).find("p").first());
      const id = $(el).attr("id") || $(el).attr("class")?.split(" ")[0] || `section-${i}`;
      
      if ((h2 && h2.length > 5) || (p && p.length > 20)) {
        let type = "content_section";
        const text = $(el).text().toLowerCase();
        if (text.includes("feature")) type = "features_grid";
        if (text.includes("testim") || text.includes("review") || text.includes("what people say")) type = "social_proof_slider";
        if (text.includes("price") || text.includes("plan") || text.includes("cost")) type = "pricing_table";
        if (text.includes("faq") || text.includes("question")) type = "faq_section";

        structure.sections.push({
          id,
          type,
          content: { title: h2, text: p }
        });
      }
    });

    // Footer
    const footer = $("footer").first();
    if (footer.length > 0) {
      structure.sections.push({
        id: "footer",
        type: "footer",
        content: {
          text: cleanText(footer).slice(0, 100)
        }
      });
    }

    res.json(structure);
  } catch (error: any) {
    console.error("Scraping error:", error.message);
    const status = error.response?.status || 500;
    const message = error.code === 'ERR_BAD_URL' ? "Invalid URL format." : 
                    error.code === 'ECONNABORTED' ? "The target website took too long to respond (Vercel limit)." :
                    error.message || "Failed to scrape landing page.";
    res.status(status).json({ error: message, detail: error.code });
  }
});

// Final error handler for Express
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

async function startServer() {
  // Vite middleware for development
  const isVercel = process.env.VERCEL === "true";
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isVercel) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded.");
    } catch (e) {
      console.error("Failed to load Vite middleware:", e);
    }
  } else if (!isVercel) {
    // Only serve static files if NOT on Vercel (Vercel handles static files via vercel.json)
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only start listener if not on Vercel
  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// In standard Vercel environment, startServer might not be awaited before export
startServer();

export default app;
