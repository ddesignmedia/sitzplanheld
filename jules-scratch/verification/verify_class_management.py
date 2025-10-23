import os
from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath("index.html")

        # Go to the local index.html file
        page.goto(f"file://{file_path}")

        # 1. Add a new class
        page.get_by_placeholder("Neuer Klassenname").fill("Class A")
        page.locator("#addClassButton").click()

        # Expect the new class to be selected
        class_a_value = page.locator("#classSelector").get_attribute("value")
        if class_a_value is not None:
            expect(page.locator("#classSelector")).to_have_value(class_a_value)

        # 2. Add a second class
        page.get_by_placeholder("Neuer Klassenname").fill("Class B")
        page.locator("#addClassButton").click()

        # Expect the new class to be selected
        class_b_value = page.locator("#classSelector").get_attribute("value")
        if class_b_value is not None:
            expect(page.locator("#classSelector")).to_have_value(class_b_value)

        # 3. Switch back to the first class
        page.select_option("#classSelector", label="Class A")
        if class_a_value is not None:
            expect(page.locator("#classSelector")).to_have_value(class_a_value)

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run_verification()