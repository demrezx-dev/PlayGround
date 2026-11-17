import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const url = process.env.CAPTURE_URL;
const outputDir = process.env.CAPTURE_DIR;

if (!url || !outputDir) {
  console.error("Set CAPTURE_URL and CAPTURE_DIR.");
  process.exit(1);
}

try {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CAPTURE_URL must be an HTTP(S) URL.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

function transient(error) {
  error.exitCode = 75;
  return error;
}

function fail(error, exitCode) {
  error.exitCode = error.exitCode || exitCode;
  return error;
}

function log(message) {
  console.log(`[capture] ${message}`);
}

const runtime = process.env.OMGITHUB_PLAYWRIGHT_ROOT || join(homedir(), ".local/share/omgithub-playwright");
const require = createRequire(join(runtime, "package.json"));
const { chromium } = require("playwright");
const configName = process.platform === "darwin" ? "metal.json" : "linux.json";
const config = JSON.parse(readFileSync(join(runtime, configName), "utf8"));

if (process.platform === "linux") {
  process.env.DISPLAY ||= ":" + readFileSync(join(runtime, "display"), "utf8").trim();
}

const views = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

let browser;

async function inspectCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#game");
    if (!canvas) return { ok: false, reason: "game canvas is missing" };

    let context;
    try {
      context = canvas.getContext("2d", { willReadFrequently: true });
    } catch {
      return { ok: false, reason: "2D canvas context unavailable" };
    }
    if (!context) return { ok: false, reason: "2D canvas context unavailable" };

    const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = canvas.width * canvas.height;
    const samples = 4000;
    let minimum = 255;
    let maximum = 0;
    const buckets = new Set();

    for (let index = 0; index < samples; index += 1) {
      const pixel = Math.floor((index / samples) * pixels);
      const offset = pixel * 4;
      const luminance = image[offset] * 0.2126 + image[offset + 1] * 0.7152 + image[offset + 2] * 0.0722;
      minimum = Math.min(minimum, luminance);
      maximum = Math.max(maximum, luminance);
      buckets.add(`${image[offset] >> 4}:${image[offset + 1] >> 4}:${image[offset + 2] >> 4}`);
    }

    if (maximum - minimum < 28) {
      return { ok: false, reason: `canvas looks flat (luma range ${(maximum - minimum).toFixed(1)})` };
    }
    if (buckets.size < 18) {
      return { ok: false, reason: `canvas has too few colors (${buckets.size} buckets)` };
    }

    return {
      ok: true,
      width: canvas.width,
      height: canvas.height,
      lumaRange: Number((maximum - minimum).toFixed(1)),
      colorBuckets: buckets.size,
    };
  });
}

async function play(page, view) {
  await page.click("#startBtn");
  await page.waitForTimeout(700);

  if (!view.isMobile) {
    await page.mouse.move(980, 330);
    await page.keyboard.down("d");
    await page.waitForTimeout(700);
    await page.keyboard.up("d");
    await page.keyboard.down("w");
    await page.waitForTimeout(450);
    await page.keyboard.up("w");
    await page.mouse.move(1150, 520);
    await page.keyboard.press("Space");
  }

  await page.waitForTimeout(2600);
}

async function captureView(view) {
  const started = Date.now();
  const context = await browser
    .newContext({
      viewport: view.viewport,
      deviceScaleFactor: view.deviceScaleFactor,
      isMobile: view.isMobile,
      hasTouch: view.hasTouch,
    })
    .catch((error) => {
      throw transient(error);
    });

  const page = await context.newPage().catch((error) => {
    throw transient(error);
  });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);
  page.on("pageerror", (error) => console.error(`[capture] page error: ${error.message}`));

  try {
    log(`${view.name}: opening ${url}`);
    let response;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (error) {
      throw transient(error);
    }

    if (!response) throw transient(new Error(`No response loading ${url}`));
    if (!response.ok()) {
      const status = response.status();
      const error = new Error(`HTTP ${status} loading ${url}`);
      throw fail(error, [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1);
    }

    await page
      .waitForSelector('html[data-ready="true"]', { state: "attached", timeout: 30000 })
      .catch((error) => {
        throw fail(new Error(`Game never signalled ready: ${error.message}`), 1);
      });

    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await play(page, view);
    await page.evaluate(() => window.scrollTo(0, 0));

    const inspection = await inspectCanvas(page);
    if (!inspection.ok) throw fail(new Error(`Rendering defect: ${inspection.reason}`), 1);

    const screenshotPath = join(outputDir, `final-${view.name}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 30000 });
    } catch (error) {
      if (error.name === "TimeoutError" || !browser.isConnected()) throw transient(error);
      throw fail(error, 1);
    }

    log(
      `${view.name}: saved ${screenshotPath} (${inspection.width}x${inspection.height} canvas, ` +
        `${inspection.colorBuckets} colors, ${Date.now() - started}ms)`
    );
  } finally {
    await context.close().catch(() => {});
  }
}

try {
  log(`launching Chromium from ${runtime}`);
  browser = await chromium.launch({ ...config.browser?.launchOptions, timeout: 30000 }).catch((error) => {
    throw transient(error);
  });

  for (const view of views) {
    await captureView(view);
  }
  log("capture complete");
} catch (error) {
  console.error(`[capture] ${error.stack || error.message}`);
  process.exitCode = error.exitCode || 1;
} finally {
  if (browser) {
    await browser.close().catch((error) => {
      console.error(`[capture] browser close failed: ${error.message}`);
      process.exitCode ||= 75;
    });
  }
}
