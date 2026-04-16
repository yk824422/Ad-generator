import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 8000, // Lowered for Vercel (10s limit)
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 403) {
      return res.status(403).json({ 
        error: "Access Forbidden (403). The website is blocking automated access.",
        isBlocked: true 
      });
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
      clone.find("script, style, noscript").remove();
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
          links: $("nav a, header a").map((i, el) => cleanText(el)).get().filter(t => t.length > 0).slice(0, 5)
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
          subheadline: cleanText(h1.nextAll("p, h2").first()),
          cta: $("a, button").filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes("get") || text.includes("buy") || text.includes("start") || text.includes("shop") || text.includes("sign");
          }).first().text().trim()
        }
      });
    }

    // Other sections
    $("section, div[id*='section'], div[class*='section'], article").each((i, el) => {
      const h2 = cleanText($(el).find("h2, h3").first());
      const p = cleanText($(el).find("p").first());
      const id = $(el).attr("id") || $(el).attr("class") || `section-${i}`;
      
      if (h2 || p) {
        let type = "content_section";
        const text = $(el).text().toLowerCase();
        if (text.includes("feature")) type = "features_grid";
        if (text.includes("testim") || text.includes("review")) type = "social_proof_slider";
        if (text.includes("price") || text.includes("plan")) type = "pricing_table";
        if (text.includes("faq")) type = "faq_section";

        structure.sections.push({
          id: id.split(" ")[0],
          type,
          content: { title: h2, text: p }
        });
      }
    });

    // Footer
    if ($("footer").length > 0) {
      structure.sections.push({
        id: "footer",
        type: "footer",
        content: {
          text: cleanText($("footer")).slice(0, 100)
        }
      });
    }

    res.json(structure);
  } catch (error: any) {
    console.error("Scraping error:", error.message);
    const status = error.response?.status || 500;
    const message = error.code === 'ERR_BAD_URL' ? "Invalid URL format." : 
                    error.code === 'ECONNABORTED' ? "Request timed out (Vercel limit)." :
                    "Failed to scrape landing page. The site might be blocking access or is offline.";
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
