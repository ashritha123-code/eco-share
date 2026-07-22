"""
Page Object Model - Auth Page Implementation
"""
from selenium.webdriver.common.by import By
from automation.pages.base_page import BasePage

class AuthPage(BasePage):
    TAB_LOGIN = (By.ID, "tabLogin")
    TAB_REGISTER = (By.ID, "tabRegister")
    LOGIN_FORM = (By.ID, "loginForm")
    REGISTER_FORM = (By.ID, "registerForm")
    LOGIN_EMAIL = (By.ID, "loginEmail")
    LOGIN_PASS = (By.ID, "loginPassword")
    REG_NAME = (By.ID, "registerName")
    REG_EMAIL = (By.ID, "registerEmail")
    REG_PASS = (By.ID, "registerPassword")
    REG_CONFIRM = (By.ID, "registerConfirmPassword")
    REG_ROLE = (By.ID, "registerRole")
    REG_LOCATION = (By.ID, "registerLocation")

    def switch_to_login(self):
        if self.is_displayed(*self.TAB_LOGIN):
            self.click(*self.TAB_LOGIN)

    def switch_to_register(self):
        if self.is_displayed(*self.TAB_REGISTER):
            self.click(*self.TAB_REGISTER)

    def login(self, email, password):
        self.switch_to_login()
        self.type_text(*self.LOGIN_EMAIL, email)
        self.type_text(*self.LOGIN_PASS, password)
        form = self.safe_find(*self.LOGIN_FORM)
        if form:
            form.submit()
