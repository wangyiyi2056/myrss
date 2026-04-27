import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function discoverRSS(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      redirect: 'follow'
    });
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get("content-type") || "";
    
    // If it's already XML, we don't need to discover
    if (contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom")) {
      return null; 
    }

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Standard RSS/Atom discovery
      const links = [
        $('link[type="application/rss+xml"]').attr('href'),
        $('link[type="application/atom+xml"]').attr('href'),
        $('link[type="application/rdf+xml"]').attr('href'),
        // Fallback for common patterns if no clear type is set
        $('a[href$="/rss"]').attr('href'),
        $('a[href$="/feed"]').attr('href'),
        $('a[href$=".xml"]').attr('href')
      ];
      
      for (const link of links) {
        if (link) {
          try {
            return new URL(link, url).href;
          } catch (e) {
            continue;
          }
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Discovery error:", e);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    timeout: 10000,
  });

  app.use(express.json());

  // RSS Proxy Endpoint
  app.get("/api/rss", async (req, res) => {
    let { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "参数错误", suggestion: "URL 是必须的。" });
    }

    // Add protocol if missing
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    try {
      // Step 1: Try discovery first if it looks like a generic homepage
      const discovered = await discoverRSS(url);
      const targetUrl = discovered || url;

      if (discovered) {
        console.log(`Discovered RSS link for ${url}: ${discovered}`);
      }

      // Step 2: Parse
      try {
        const feed = await parser.parseURL(targetUrl);
        return res.json(feed);
      } catch (parseError: any) {
        // If we hadn't tried discovery or direct parse failed even with discovered URL
        if (!discovered) {
           const retryUrl = await discoverRSS(url);
           if (retryUrl && retryUrl !== url) {
             const feed = await parser.parseURL(retryUrl);
             return res.json(feed);
           }
        }
        throw parseError;
      }
    } catch (error: any) {
      console.error(`RSS Error for ${url}:`, error.message);
      
      let suggestion = "请确保该网站支持 RSS 订阅。有些现代网站并不提供此功能。";
      let errorType = "订阅失败";

      if (error.message.includes("Attribute without value") || 
          error.message.includes("Unquoted attribute value") ||
          error.message.includes("Invalid character")) {
        suggestion = "该地址返回的是 HTML 网页而非 RSS 订阅格式。这通常说明该网站没有提供 RSS 订阅接口，或者你输入的只是普通网页地址。";
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
        suggestion = "无法访问该服务器，请检查网络或链接是否有效。";
      } else if (error.message.includes("timeout")) {
        suggestion = "请求超时，该网站响应太慢。";
      }

      res.status(500).json({ 
        error: errorType, 
        details: error.message,
        suggestion: suggestion
      });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
