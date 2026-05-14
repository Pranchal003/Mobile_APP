print('DEBUG: Script started.')

import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
import datetime

# --- Globals ---
BASE_URL = "https://myblocks.in/"
MENU_OPTION = "Add Report"

# --- Utility functions ---
def load_credentials(credentials_file="my_credentials.txt"):
    """Loads username and password from a file."""
    if not os.path.exists(credentials_file):
        print(f"Error: Credentials file '{credentials_file}' not found!")
        sys.exit(1)
    credentials = {}
    with open(credentials_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    credentials[key.strip()] = value.strip()
                else:
                    print(f"Warning: Skipping malformed line in credentials file: {line}")
    if 'username' not in credentials or 'password' not in credentials:
        print("Error: Credentials file must contain 'username' and 'password' fields!")
        sys.exit(1)
    return credentials

def load_report_data(report_file="my_report.txt"):
    """Loads report data from the my_report.txt file."""
    if not os.path.exists(report_file):
        print(f"Error: Report file '{report_file}' not found!")
        # Return empty dict if not found; main function will handle this
        return {}
    report_data = {}
    with open(report_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    report_data[key.strip()] = value.strip()
    return report_data

def setup_driver():
    """Sets up the Chrome WebDriver."""
    options = ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    # options.add_argument("--headless")
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    return driver

def login_and_navigate(driver, credentials):
    """Logs in, navigates to Business App, and then to the Add Report page."""
    driver.get(BASE_URL)
    wait = WebDriverWait(driver, 40)

    try:
        # --- Login ---
        print("Waiting for login page to load...")
        wait.until(EC.visibility_of_element_located((By.ID, "username")))
        
        print("Entering username...")
        driver.find_element(By.ID, "username").send_keys(credentials['username'])
        
        print("Entering password...")
        driver.find_element(By.ID, "password").send_keys(credentials['password'])

        print("Selecting 'Business User' from dropdown...")
        Select(driver.find_element(By.ID, "userType")).select_by_value("BUSINESSAPP")
        print("'Business User' selected.")

        print("Clicking login button...")
        driver.find_element(By.ID, "login-button").click()

        # --- Navigation ---
        print("Login successful. Navigating to Business App...")
        business_app_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(text(), 'Business App')]")))
        business_app_link.click()

        print(f"Navigating to '{MENU_OPTION}'...")
        add_report_link = wait.until(EC.element_to_be_clickable((By.XPATH, f"//a[text()='{MENU_OPTION}']")))
        add_report_link.click()
        
        print("Navigation to report form successful.")
        return True

    except Exception as e:
        print(f"An error occurred during login or navigation: {e}")
        driver.save_screenshot("error_final_navigation.png")
        with open("error_final_navigation.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("Saved debug files for navigation error.")
        return False


def fill_report_form(driver, report_text):
    """Fills the report form with the provided text."""
    wait = WebDriverWait(driver, 40)
    
    try:
        # First, wait for a unique element of the report page to be visible
        print("Waiting for the report page to fully load...")
        wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[text()='Report Page']")))
        print("Report page loaded.")

        # --- Autofill Date ---
        today = datetime.date.today().strftime('%Y-%m-%d')
        print(f"Autofilling date: {today}")
        date_field = wait.until(EC.presence_of_element_located((By.NAME, "createdDate")))
        driver.execute_script("arguments[0].value = arguments[1];", date_field, today)

        # --- Autofill Start Time and End Time ---
        now = datetime.datetime.now()
        start_time = now.strftime('%H:%M')
        end_time = (now + datetime.timedelta(hours=1)).strftime('%H:%M')
        print(f"Autofilling start time: {start_time}, end time: {end_time}")
        start_time_field = wait.until(EC.presence_of_element_located((By.NAME, "startTime")))
        end_time_field = wait.until(EC.presence_of_element_located((By.NAME, "endTime")))
        driver.execute_script("arguments[0].value = arguments[1];", start_time_field, start_time)
        driver.execute_script("arguments[0].value = arguments[1];", end_time_field, end_time)

        # --- Autofill Task ---
        print(f"Autofilling task: {report_text}")
        task_field = wait.until(EC.presence_of_element_located((By.NAME, "task")))
        driver.execute_script("arguments[0].value = arguments[1];", task_field, report_text)

        # --- Autofill Project ID (select first non-empty option) ---
        print("Autofilling project ID (first available option)...")
        project_select = wait.until(EC.presence_of_element_located((By.NAME, "projectID")))
        options = project_select.find_elements(By.TAG_NAME, "option")
        for option in options:
            if option.get_attribute("value"):
                driver.execute_script("arguments[0].value = arguments[1];", project_select, option.get_attribute("value"))
                print(f"Selected project ID: {option.get_attribute('value')}")
                break
        else:
            print("No project ID options available to select.")

        # --- Autofill Description ---
        print("Waiting for the description form field to be present...")
        description_field = wait.until(EC.presence_of_element_located((By.NAME, "description")))
        print("Description field is present. Pausing for 1 second for stability...")
        time.sleep(1)
        print(f"Attempting to enter description: '{report_text[:50]}...'")
        driver.execute_script("arguments[0].value = arguments[1];", description_field, report_text)
        print("Filled description field using JavaScript.")

        print("Locating and clicking Submit button...")
        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']")))
        submit_btn.click()
        print("Submit button clicked successfully.")

    except Exception as e:
        error_type = type(e).__name__
        print(f"Could not fill report form fields. Error Type: {error_type}, Message: {e}")
        driver.save_screenshot("error_filling_form.png")
        with open("error_page_source_form.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("Saved page source to error_page_source_form.html for debugging.")
        return

    print("Form submission process completed.")
    time.sleep(15)

def main():
    """Main function to run the complete automation."""
    # Load data from files instead of arguments
    print("Loading report data...")
    report_data = load_report_data()
    report_text = report_data.get('description')

    if not report_text:
        print("Error: 'description' not found in my_report.txt. Aborting selenium script.")
        return # Exit gracefully

    print(f"Transcribed text received: {report_text}")
    print("Loading credentials...")
    credentials = load_credentials()
    
    print("Setting up WebDriver...")
    driver = setup_driver()
    
    try:
        print("Attempting full automation process...")
        if login_and_navigate(driver, credentials):
            print("Navigation successful. Proceeding to fill form...")
            fill_report_form(driver, report_text)
        else:
            print("Login or navigation failed. Aborting.")
    except Exception as e:
        print(f"An unexpected error occurred in main execution: {e}")
    finally:
        print("Closing browser...")
        driver.quit()
        print("Browser closed.")

if __name__ == "__main__":
    # The script is now controlled by the app.py, which creates the report file.
    # We no longer need to check sys.argv here.
    main() 