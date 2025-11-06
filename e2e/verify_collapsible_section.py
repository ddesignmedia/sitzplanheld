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

        # Check that the student management section is hidden by default
        student_management_content = page.locator('#studentManagementContent')
        is_hidden = await student_management_content.is_hidden()
        if not is_hidden:
            print("Error: Student management section is not hidden by default.")
            await page.screenshot(path="e2e/collapsible_section_error_not_hidden.png")
            await browser.close()
            return

        # Click the toggle button
        await page.locator('#toggleStudentManagement').click()

        # Check that the student management section is visible
        is_visible = await student_management_content.is_visible()
        if not is_visible:
            print("Error: Student management section is not visible after clicking the toggle button.")
            await page.screenshot(path="e2e/collapsible_section_error_not_visible.png")
            await browser.close()
            return

        print("Test passed: Collapsible section works as expected.")

        # Take a screenshot
        screenshot_path = "e2e/collapsible_section_works.png"
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")


        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
