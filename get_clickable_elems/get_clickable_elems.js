const playwright = require('playwright');
const fs = require('fs');
const { URL } = require('url');

// Get URLs from command line arguments
const urls = process.argv.slice(2);

// Setting global variables
const vp_width = 1920;
const vp_height = 1080;

if (urls.length === 0) {
    console.error('Please provide a list of URLs as command line arguments.');
    process.exit(1);
}

(async () => {
    const data_dir = './data';
    if (fs.existsSync(data_dir)) {
        fs.rmSync(data_dir, { recursive: true, force: true });
    }
    fs.mkdirSync(data_dir, { recursive: true });

    const browser = await playwright.chromium.launch({ headless: false }); 
    const context = await browser.newContext({
        viewport: { width: vp_width, height: vp_height },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ignoreHTTPSErrors: true, // Ignore HTTPS errors
    });
    const page = await context.newPage();

    for (const targetUrl of urls) {
        let attempt = 0;
        const RETRY_LIMIT = 3; // Define your retry limit

        while (attempt < RETRY_LIMIT) {
            try {
                attempt++;
                console.log(`Attempt ${attempt} to process ${targetUrl}`);

                const url = new URL(targetUrl);

                // Navigate to the desired URL with an increased timeout
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                console.log(`Navigated to ${targetUrl}`);

                const clickableElements = await findClickableElements(page);

                const baseFilename = url.hostname.replace('www.', ''); // Removes 'www.' if present
                fs.writeFileSync(`${data_dir}/${baseFilename}.json`, JSON.stringify(clickableElements, null, 4));
                await page.screenshot({ path: `${data_dir}/${baseFilename}.png` });

                console.log(`Successfully processed ${targetUrl}`);
                break;
            } catch (err) {
                console.error(`Failed processing ${targetUrl} on attempt ${attempt}: ${err.message}`);
                if (attempt >= RETRY_LIMIT) {
                    console.error(`Exceeded retry limit for ${targetUrl}`);
                }
            }
        }
    }

    await browser.close();
})();

async function findClickableElements(page) {
    const clickableElements = [];

    async function dfs(element) {
        try {
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            const isHiddenOrDropdown = await element.evaluate(el => {
                const style = getComputedStyle(el);
                const isHidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || el.offsetWidth === 0 || el.offsetHeight === 0;
                const isDropdown = el.tagName.toLowerCase() === 'select' || Array.from(el.classList).includes('dropdown');
                return isHidden || isDropdown;
            });

            if (isHiddenOrDropdown) {
                return;
            }

            const isVisible = await element.evaluate(el => {
                const style = getComputedStyle(el);
                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    el.offsetWidth > 0 &&
                    el.offsetHeight > 0
                );
            });

            if (isVisible) {
                const isAttached = await element.evaluate(el => !!el.isConnected);
                const hasPointerEvents = await element.evaluate(el => getComputedStyle(el).pointerEvents !== 'none');

                if (isAttached && hasPointerEvents) {
                    const boundingBox = await element.boundingBox();
                    if (boundingBox) {
                        const x = boundingBox.x + boundingBox.width / 2;
                        const y = boundingBox.y + boundingBox.height / 2;
                        console.log(`Moving mouse to element at (${x}, ${y})`);

                        await page.mouse.move(x, y);

                        await new Promise(resolve => setTimeout(resolve, 3));

                        const isClickableOnHover = await page.evaluate(el => {
                            const hoverCursor = getComputedStyle(el).cursor;
                            return hoverCursor === 'pointer' || (hoverCursor === 'text' && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' || el.isContentEditable));
                        }, element);

                        if (isClickableOnHover) {
                            clickableElements.push(boundingBox);
                        }

                        await new Promise(resolve => setTimeout(resolve, 3));
                    }
                }
            }

            const children = await element.$$('>*');
            for (const child of children) {
                await dfs(child); // Continue DFS
            }
        } catch (innerErr) {
            console.warn(`Skipped element due to error: ${innerErr.message}`);
        }
    }

    const root = await page.$('body');
    await dfs(root);

    return clickableElements.filter((bbox, index, self) =>
        !self.some((other, otherIndex) =>
            otherIndex !== index &&
            bbox.x >= other.x &&
            bbox.y >= other.y &&
            bbox.x + bbox.width <= other.x + other.width &&
            bbox.y + bbox.height <= other.y + other.height
        )
    );
}
