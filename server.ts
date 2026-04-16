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
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-IN,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.google.com/",
      },
      timeout: 9000, 
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Handle 4xx gracefully
    });

    if (response.status === 403 || response.status === 429) {
      return res.status(200).json({ 
        success: false,
        error: `Website Blocked (${response.status})`,
        message: "The website is blocking automated access from this server. Please try using a descriptive prompt instead of a URL.",
        isBlocked: true 
      });
    }

    if (!response.data || typeof response.data !== "string") {
      throw new Error("Empty or invalid response data from target website.");
    }

    // Check for "soft" blocks (200 OK but page says Access Denied)
    const lowerData = response.data.toLowerCase();
    if (lowerData.includes("access denied") && lowerData.length < 2000) {
      return res.status(200).json({ 
        success: false,
        error: "Access Denied (Soft Block)",
        message: "The website returned a security challenge page. We recommend describing the brand style instead.",
        isBlocked: true 
      });
    }

    const $ = cheerio.load(response.data);
    
    // --- MEMORY OPTIMIZATION: Clean the entire DOM once ---
    $("script, style, noscript, iframe, svg, canvas, map, area, object, embed").remove();

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

    const structure: any = {
      success: true,
      title: $("title").text().trim() || "Untitled Page",
      brandName: $("meta[property='og:site_name']").attr("content") || $("title").text().split(/[|-]/)[0].trim() || "Brand",
      images,
      sections: [],
    };

    // Identify common sections
    const nav = $("nav, header").first();
    if (nav.length > 0) {
      structure.sections.push({
        id: "navbar",
        type: "navbar",
        content: {
          links: nav.find("a").map((i, el) => $(el).text().trim()).get().filter(t => t.length > 2 && t.length < 20).slice(0, 5)
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
          headline: h1.text().trim(),
          subheadline: h1.nextAll("p, h2, h3").first().text().trim(),
          cta: $("a, button").filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes("get") || text.includes("buy") || text.includes("start") || text.includes("shop") || text.includes("sign") || text.includes("try");
          }).first().text().trim() || "Get Started"
        }
      });
    }

    // Other sections
    $("section, div[id*='section'], div[class*='section'], article").each((i, el) => {
      const $el = $(el);
      const h2 = $el.find("h2, h3").first().text().trim();
      const p = $el.find("p").first().text().trim();
      const id = $el.attr("id") || $el.attr("class")?.split(" ")[0] || `section-${i}`;
      
      if ((h2 && h2.length > 5) || (p && p.length > 20)) {
        let type = "content_section";
        const text = $el.text().toLowerCase();
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
          text: footer.text().trim().slice(0, 100)
        }
      });
    }

    // If we found basically nothing, count it as a soft block
    if (structure.sections.length < 1 && images.length < 1) {
      return res.status(200).json({
        success: false,
        message: "No content found. The website might be blocking automated tools."
      });
    }

    res.json(structure);
  } catch (error: any) {
    console.error("Scraping error:", error.message);
    const message = error.code === 'ERR_BAD_URL' ? "Invalid URL format." : 
                    error.code === 'ECONNABORTED' ? "The target website took too long to respond." :
                    "We encountered an issue while accessing this URL.";
    
    // Always return 200 with success: false to the frontend to prevent 500 crashes
    res.status(200).json({ 
      success: false, 
      error: "Scrape Failed",
      message, 
      detail: error.code 
    });
  }
});

// Final error handler for Express
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled Error:", err);
  res.status(200).json({ success: false, error: "System Error", message: "An unexpected error occurred." });
});

async function startServer() {
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
