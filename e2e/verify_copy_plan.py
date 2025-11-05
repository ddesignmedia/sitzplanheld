
import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Construct the full path to the index.html file
        index_path = os.path.abspath('index.html')

        await page.goto(f'file://{index_path}')

        # 1. Create a plan with students
        await page.click('#insertTestClassButton')

        # 2. Create a new, empty plan
        await page.click('#addTabButton')

        # 3. Copy the first plan to the second
        await page.select_option('#copyPlanSelect', index=0)
        await page.click('#copyPlanConfirmButton')

        # 4. Verify that the student names appear correctly in the second plan
        student_names = await page.input_value('#studentNames')
        if "Max Mustermann" in student_names and "Erika Musterfrau" in student_names:
            print("Test passed: Student names were copied successfully.")
        else:
            print("Test failed: Student names were not copied.")

        await page.screenshot(path="/home/jules/verification/screenshot.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
