import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the local HTML file
        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Click the first color icon to open the modal
        await page.locator('span[title="Farbe ändern"]').first.click()

        # Select a color and confirm
        await page.locator('.color-grid-swatch[data-color="#ff0099"]').click()
        await page.click('#confirmColor')

        # Take a screenshot to verify the tab color has changed
        screenshot_path = os.path.join('/home/jules/verification', 'color_picker_verification.png')
        await page.locator('.tab.active').screenshot(path=screenshot_path)

        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
