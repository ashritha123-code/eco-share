"""
Screenshot utility for failure and evidence capturing
"""
import os
import datetime
from automation.config.config import Config

def capture_screenshot(driver, test_id, status="FAILURE"):
    if not driver:
        return ""
    Config.ensure_directories()
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{test_id}_{status}_{timestamp}.png"
    filepath = os.path.join(Config.SCREENSHOT_DIR, filename)
    try:
        driver.save_screenshot(filepath)
        return filepath
    except Exception as e:
        return f"Failed to capture screenshot: {e}"
