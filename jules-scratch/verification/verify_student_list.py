
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"file://{os.path.abspath('index.html')}")

    # Add a student to see them in the list
    page.fill('#addStudentNameInput', 'Test Student')
    page.click('#addStudentButton')

    # Take a screenshot to verify the student list
    page.screenshot(path='jules-scratch/verification/student-list.png')

    # Remove the student from the list
    page.click('.remove-student-button')

    # Take a screenshot to verify the student was removed
    page.screenshot(path='jules-scratch/verification/verification.png')

    browser.close()

import os
with sync_playwright() as playwright:
    run(playwright)
