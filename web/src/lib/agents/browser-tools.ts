import { chromium, Browser, BrowserContext, Page } from "playwright";

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;
let _page: Page | null = null;

// Initialize a singleton browser instance
export async function getBrowserPage(): Promise<Page> {
    if (!_browser) {
        console.log("[Playwright] Launching headless chromium...");
        _browser = await chromium.launch({ headless: true });
        _context = await _browser.newContext({
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 720 }
        });
        _page = await _context.newPage();
    }
    return _page!;
}

// Ensure the browser cleans up properly
export async function closeBrowser() {
    if (_browser) {
        console.log("[Playwright] Closing browser...");
        await _browser.close();
        _browser = null;
        _context = null;
        _page = null;
    }
}

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export async function browserNavigate(url: string): Promise<string> {
    const page = await getBrowserPage();
    console.log(`[Browser] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });
    return `Successfully navigated to ${page.url()}`;
}

export async function browserGetContent(): Promise<string> {
    const page = await getBrowserPage();

    // Remove scripts, styles, and SVGs to compress the HTML size for the LLM context window
    const cleanHtml = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        const elementsToRemove = clone.querySelectorAll('script, style, svg, img, video, iframe, noscript');
        elementsToRemove.forEach(el => el.remove());

        // Compress excessive whitespace
        let html = clone.innerHTML;
        html = html.replace(/\s+/g, ' ').trim();
        return html;
    });

    console.log(`[Browser] Extracted ${cleanHtml.length} chars of compressed HTML.`);
    return cleanHtml;
}

export async function browserClick(selector: string): Promise<string> {
    const page = await getBrowserPage();
    console.log(`[Browser] Clicking: ${selector}`);
    await page.click(selector);
    await page.waitForLoadState("networkidle"); // Wait for potential nav
    return `Clicked ${selector}. Current URL is ${page.url()}`;
}

export async function browserType(selector: string, text: string): Promise<string> {
    const page = await getBrowserPage();
    console.log(`[Browser] Typing into: ${selector}`);
    await page.fill(selector, text);
    return `Typed into ${selector}.`;
}

export async function browserWait(ms: number): Promise<string> {
    const page = await getBrowserPage();
    await page.waitForTimeout(ms);
    return `Waited for ${ms} milliseconds.`;
}
