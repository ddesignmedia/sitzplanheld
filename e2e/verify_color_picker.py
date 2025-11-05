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

        # There is one tab by default. Let's find the color picker icon inside it.
        # The icon has a title "Farbe ändern"
        await page.locator('span[title="Farbe ändern"]').click()

        # Wait for the modal to be visible
        await page.wait_for_selector('#colorModal:not(.hidden)')

        # Take a screenshot of the modal
        await page.locator('#colorModal').screenshot(path="e2e/color_picker_desktop.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
