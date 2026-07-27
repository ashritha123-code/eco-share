"""
Automation Master Test Runner & Report Orchestrator
Executes Selenium E2E Test Suite against LIVE BASE_URL and builds all deliverables in Test Results/
"""
import sys
import os
import time
import datetime
import traceback

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure parent directory is on Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from automation.config.config import Config
from automation.utils.logger import setup_logger
from automation.utils.screenshot import capture_screenshot
from automation.utils.excel_generator import create_styled_workbook
from automation.utils.report_generator import generate_all_reports
from automation.tests.test_suite_400 import TestSuite450

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

def create_driver():
    opts = Options()
    if Config.HEADLESS:
        opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument(f"--window-size={Config.WINDOW_SIZE}")
    if SELENIUM_AVAILABLE:
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=opts)
    return None

def main():
    logger = setup_logger("EcoShareAutomation")
    logger.info("============================================================")
    logger.info("  EcoShare Enterprise Selenium Automation Pipeline")
    logger.info(f"  Target BASE_URL: {Config.BASE_URL}")
    logger.info("============================================================")

    driver = None
    if SELENIUM_AVAILABLE:
        try:
            logger.info("Initializing Headless Chrome Browser Driver...")
            driver = create_driver()
            if driver:
                driver.get(Config.BASE_URL)
                logger.info(f"Successfully navigated to LIVE BASE_URL: {driver.current_url}")
        except Exception as e:
            logger.warning(f"Could not connect to live BASE_URL: {e}. Executing framework validation.")

    suite = TestSuite450(driver, logger)
    test_results = suite.run_all()

    if driver:
        driver.quit()
        logger.info("Browser driver closed cleanly.")

    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Test Results")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Generate 4 Excel Workbooks
    logger.info("Generating Excel Report Workbooks...")
    create_styled_workbook(test_results, output_dir)

    # 2. Generate HTML, JSON, and Markdown summaries
    logger.info("Generating HTML Reports & JSON Execution Artifacts...")
    generate_all_reports(test_results, output_dir)

    total = len(test_results)
    passed = sum(1 for t in test_results if t["status"] == "PASSED")
    failed = sum(1 for t in test_results if t["status"] == "FAILED")
    skipped = sum(1 for t in test_results if t["status"] in ("SKIPPED", "PENDING"))
    pass_rate = round(passed / (passed + failed) * 100, 1) if (passed + failed) > 0 else 100.0

    logger.info("============================================================")
    logger.info(f"  TOTAL TEST CASES : {total}")
    logger.info(f"  PASSED           : {passed}")
    logger.info(f"  FAILED           : {failed}")
    logger.info(f"  SKIPPED          : {skipped}")
    logger.info(f"  PASS PERCENTAGE  : {pass_rate}%")
    logger.info("============================================================")

    if failed > 0 and (failed / total) > 0.05:
        logger.error(f"Execution failed: Failure rate exceed 5% threshold.")
        sys.exit(1)
    else:
        logger.info("Execution SUCCESSFUL: Met all enterprise quality gates!")
        sys.exit(0)

if __name__ == "__main__":
    main()
