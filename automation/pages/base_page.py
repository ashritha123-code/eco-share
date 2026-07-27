"""
Page Object Model - Base Page Implementation
"""
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from automation.config.config import Config

class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, Config.DEFAULT_TIMEOUT)

    def navigate_to(self, url=None):
        target = url or Config.BASE_URL
        self.driver.get(target)

    def find(self, by, locator):
        return self.wait.until(EC.presence_of_element_located((by, locator)))

    def safe_find(self, by, locator):
        try:
            return self.driver.find_element(by, locator)
        except:
            return None

    def click(self, by, locator):
        elem = self.wait.until(EC.element_to_be_clickable((by, locator)))
        elem.click()

    def type_text(self, by, locator, text):
        elem = self.find(by, locator)
        elem.clear()
        elem.send_keys(text)

    def get_text(self, by, locator):
        elem = self.find(by, locator)
        return elem.text.strip()

    def is_displayed(self, by, locator):
        elem = self.safe_find(by, locator)
        return elem is not None and elem.is_displayed()
