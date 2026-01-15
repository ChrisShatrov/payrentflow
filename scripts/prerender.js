import puppeteer from 'puppeteer';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { lookup } from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, '..', 'dist');
const indexPath = join(distPath, 'index.html');
const PORT = 4173;

// Simple static file server
function createStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(distPath, req.url === '/' ? 'index.html' : req.url);
      
      // Handle SPA routing - all routes serve index.html
      if (!existsSync(filePath) || !filePath.startsWith(distPath)) {
        filePath = indexPath;
      }
      
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const mimeType = lookup(extname(filePath)) || 'text/html';
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    server.listen(PORT, () => {
      console.log(`📦 Static server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function prerender() {
  // Skip pre-rendering on Vercel (Puppeteer doesn't work in Vercel's build environment)
  if (process.env.VERCEL || process.env.CI) {
    console.log('⏭️  Skipping pre-rendering (running on Vercel/CI - Puppeteer not available)');
    console.log('ℹ️  Note: Vercel will handle SEO through Edge Functions or you can pre-render locally');
    return;
  }

  if (!existsSync(indexPath)) {
    console.error('❌ index.html not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.log('🚀 Starting pre-rendering...');

  // Start static server
  const server = await createStaticServer();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the homepage
    console.log(`🌐 Navigating to http://localhost:${PORT}/...`);
    await page.goto(`http://localhost:${PORT}/`, {
      waitUntil: 'networkidle0',
    });
    
    // Wait a bit for any dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the fully rendered HTML
    const renderedHTML = await page.content();
    
    // Write the pre-rendered HTML back
    writeFileSync(indexPath, renderedHTML, 'utf-8');
    
    console.log('✅ Pre-rendering complete!');
    console.log('📄 Homepage has been pre-rendered with all content.');
  } catch (error) {
    console.error('❌ Pre-rendering failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
}

prerender();
