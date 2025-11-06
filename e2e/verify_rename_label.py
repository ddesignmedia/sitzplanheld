import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Construct the file path to index.html
        file_path = "file://" + os.path.abspath("index.html")
        await page.goto(file_path)

        # Take a screenshot
        screenshot_path = "e2e/rename_label_verification.png"
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
