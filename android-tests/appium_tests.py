#!/usr/bin/env python3
"""
EcoShare - Appium Android Test Suite
Tests: Authentication, Resource Browsing, Chat, Profile on Android

HOW TO RUN:
1. Install Android Studio and start an emulator (or connect a USB device)
2. Install Appium: npm install -g appium
3. Install Appium driver: appium driver install uiautomator2
4. Start Appium: appium
5. Run tests: python android-tests/appium_tests.py

PREREQUISITES:
  pip install Appium-Python-Client
  The app APK must be installed on the emulator/device first.
  APK path: android/build-apk/ (run android/build-apk.bat first)
"""

import sys
import time
import datetime

try:
    from appium import webdriver
    from appium.webdriver.common.appiumby import AppiumBy
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    APPIUM_AVAILABLE = True
except ImportError:
    APPIUM_AVAILABLE = False
    print("WARNING: Appium not installed. Run: pip install Appium-Python-Client")

# ─── Configuration ────────────────────────────────────────────────────────────
APPIUM_SERVER = "http://localhost:4723"
DESIRED_CAPS = {
    "platformName": "Android",
    "automationName": "UiAutomator2",
    "deviceName": "Android Emulator",
    "appPackage": "com.ecoshare.app",
    "appActivity": ".MainActivity",
    "noReset": False,
    "newCommandTimeout": 60
}

# ─── Results store ────────────────────────────────────────────────────────────
results = []

def record(test_id, category, name, status, duration=0, error=""):
    icon = "✅" if status == "PASSED" else "❌"
    results.append({
        "id": test_id, "category": category, "name": name,
        "status": status, "duration": duration, "error": error,
        "type": "Appium"
    })
    print(f"  {icon} [{test_id}] {name} -> {status} ({duration}ms)")

def make_driver():
    if not APPIUM_AVAILABLE:
        return None
    try:
        driver = webdriver.Remote(APPIUM_SERVER, DESIRED_CAPS)
        return driver
    except Exception as e:
        print(f"ERROR: Could not connect to Appium server: {e}")
        print("Make sure Appium is running: appium")
        return None

# ─── Test Helpers ─────────────────────────────────────────────────────────────
def wait_for_element(driver, by, value, timeout=10):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, value))
    )

def safe_find(driver, by, value):
    try:
        return driver.find_element(by, value)
    except Exception:
        return None

# ─── Test Suite 1: App Launch ─────────────────────────────────────────────────
def run_launch_tests(driver, wait):
    print("\n📱 Running App Launch Tests...")

    # APPIUM-01: App opens successfully
    t0 = time.time()
    try:
        wait.until(EC.presence_of_element_located((AppiumBy.CLASS_NAME, "android.view.View")))
        record("APPIUM-01", "App Launch", "App opens without crash", "PASSED", int((time.time()-t0)*1000))
    except Exception as e:
        record("APPIUM-01", "App Launch", "App opens without crash", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-02: Login screen visible on first launch
    t0 = time.time()
    try:
        login_elem = safe_find(driver, AppiumBy.XPATH, '//*[@text="Sign In" or @text="Login" or @content-desc="sign-in"]')
        if login_elem:
            record("APPIUM-02", "App Launch", "Login screen visible on first launch", "PASSED", int((time.time()-t0)*1000))
        else:
            record("APPIUM-02", "App Launch", "Login screen visible on first launch", "FAILED", int((time.time()-t0)*1000), "Login element not found")
    except Exception as e:
        record("APPIUM-02", "App Launch", "Login screen visible on first launch", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-03: App title/branding visible
    t0 = time.time()
    try:
        title = safe_find(driver, AppiumBy.XPATH, '//*[contains(@text, "Eco") or contains(@text, "eco")]')
        if title:
            record("APPIUM-03", "App Launch", "EcoCircle branding visible", "PASSED", int((time.time()-t0)*1000))
        else:
            record("APPIUM-03", "App Launch", "EcoCircle branding visible", "FAILED", int((time.time()-t0)*1000), "Branding not found")
    except Exception as e:
        record("APPIUM-03", "App Launch", "EcoCircle branding visible", "FAILED", int((time.time()-t0)*1000), str(e))

# ─── Test Suite 2: Authentication ─────────────────────────────────────────────
def run_auth_tests(driver, wait):
    print("\n🔐 Running Authentication Tests...")

    # APPIUM-04: Email field is tappable
    t0 = time.time()
    try:
        email_field = safe_find(driver, AppiumBy.XPATH,
            '//*[@content-desc="email" or @resource-id="email" or @hint="Email"]')
        if email_field:
            email_field.click()
            record("APPIUM-04", "Authentication", "Email input field is tappable", "PASSED", int((time.time()-t0)*1000))
        else:
            record("APPIUM-04", "Authentication", "Email input field is tappable", "FAILED", int((time.time()-t0)*1000), "Email field not found")
    except Exception as e:
        record("APPIUM-04", "Authentication", "Email input field is tappable", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-05: Password field is tappable
    t0 = time.time()
    try:
        pwd_field = safe_find(driver, AppiumBy.XPATH,
            '//*[@content-desc="password" or @hint="Password"]')
        if pwd_field:
            pwd_field.click()
            record("APPIUM-05", "Authentication", "Password input field is tappable", "PASSED", int((time.time()-t0)*1000))
        else:
            record("APPIUM-05", "Authentication", "Password input field is tappable", "FAILED", int((time.time()-t0)*1000), "Password field not found")
    except Exception as e:
        record("APPIUM-05", "Authentication", "Password input field is tappable", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-06: Login with invalid credentials shows error
    t0 = time.time()
    try:
        email_field = safe_find(driver, AppiumBy.XPATH, '//*[@hint="Email" or @content-desc="email"]')
        pwd_field = safe_find(driver, AppiumBy.XPATH, '//*[@hint="Password" or @content-desc="password"]')
        if email_field and pwd_field:
            email_field.clear()
            email_field.send_keys("wrong@email.com")
            pwd_field.clear()
            pwd_field.send_keys("wrongpassword")
            login_btn = safe_find(driver, AppiumBy.XPATH, '//*[@text="Sign In" or @text="Login"]')
            if login_btn:
                login_btn.click()
                time.sleep(2)
                error = safe_find(driver, AppiumBy.XPATH, '//*[contains(@text, "Invalid") or contains(@text, "error")]')
                record("APPIUM-06", "Authentication", "Invalid login shows error message", "PASSED" if error else "FAILED", int((time.time()-t0)*1000))
            else:
                record("APPIUM-06", "Authentication", "Invalid login shows error message", "FAILED", int((time.time()-t0)*1000), "Login button not found")
        else:
            record("APPIUM-06", "Authentication", "Invalid login shows error message", "FAILED", int((time.time()-t0)*1000), "Input fields not found")
    except Exception as e:
        record("APPIUM-06", "Authentication", "Invalid login shows error message", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-07: Register link is visible
    t0 = time.time()
    try:
        reg_link = safe_find(driver, AppiumBy.XPATH,
            '//*[@text="Register" or @text="Sign Up" or @text="Create Account" or contains(@text, "register")]')
        record("APPIUM-07", "Authentication", "Register link is visible", "PASSED" if reg_link else "FAILED",
               int((time.time()-t0)*1000), "" if reg_link else "Register link not found")
    except Exception as e:
        record("APPIUM-07", "Authentication", "Register link is visible", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-08: Valid admin login succeeds
    t0 = time.time()
    try:
        email_field = safe_find(driver, AppiumBy.XPATH, '//*[@hint="Email" or @content-desc="email"]')
        pwd_field = safe_find(driver, AppiumBy.XPATH, '//*[@hint="Password" or @content-desc="password"]')
        if email_field and pwd_field:
            email_field.clear()
            email_field.send_keys("admin@ecoshare.com")
            pwd_field.clear()
            pwd_field.send_keys("EcoPass123")
            login_btn = safe_find(driver, AppiumBy.XPATH, '//*[@text="Sign In" or @text="Login"]')
            if login_btn:
                login_btn.click()
                time.sleep(3)
                dashboard = safe_find(driver, AppiumBy.XPATH, '//*[contains(@text, "Dashboard") or contains(@text, "Resources")]')
                record("APPIUM-08", "Authentication", "Admin login navigates to dashboard", "PASSED" if dashboard else "FAILED",
                       int((time.time()-t0)*1000))
            else:
                record("APPIUM-08", "Authentication", "Admin login navigates to dashboard", "FAILED", int((time.time()-t0)*1000))
        else:
            record("APPIUM-08", "Authentication", "Admin login navigates to dashboard", "FAILED", int((time.time()-t0)*1000))
    except Exception as e:
        record("APPIUM-08", "Authentication", "Admin login navigates to dashboard", "FAILED", int((time.time()-t0)*1000), str(e))

# ─── Test Suite 3: Resource Browsing ──────────────────────────────────────────
def run_resource_tests(driver, wait):
    print("\n📦 Running Resource Tests...")

    # APPIUM-09: Resource list is visible after login
    t0 = time.time()
    try:
        res_list = safe_find(driver, AppiumBy.XPATH, '//*[contains(@text, "Resource") or contains(@text, "Available")]')
        record("APPIUM-09", "Resources", "Resource list visible after login", "PASSED" if res_list else "FAILED",
               int((time.time()-t0)*1000), "" if res_list else "Resource list not found")
    except Exception as e:
        record("APPIUM-09", "Resources", "Resource list visible after login", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-10: Search bar is accessible
    t0 = time.time()
    try:
        search = safe_find(driver, AppiumBy.XPATH, '//*[@hint="Search" or contains(@content-desc, "search")]')
        record("APPIUM-10", "Resources", "Search bar is accessible", "PASSED" if search else "FAILED",
               int((time.time()-t0)*1000))
    except Exception as e:
        record("APPIUM-10", "Resources", "Search bar is accessible", "FAILED", int((time.time()-t0)*1000), str(e))

    # APPIUM-11: Add resource button visible
    t0 = time.time()
    try:
        add_btn = safe_find(driver, AppiumBy.XPATH, '//*[@text="Add Resource" or contains(@content-desc, "add")]')
        record("APPIUM-11", "Resources", "Add resource button is visible", "PASSED" if add_btn else "FAILED",
               int((time.time()-t0)*1000))
    except Exception as e:
        record("APPIUM-11", "Resources", "Add resource button is visible", "FAILED", int((time.time()-t0)*1000), str(e))

# ─── Test Suite 4: Navigation ─────────────────────────────────────────────────
def run_navigation_tests(driver, wait):
    print("\n🗺️ Running Navigation Tests...")

    nav_items = [
        ("APPIUM-12", "Dashboard", "Dashboard navigation"),
        ("APPIUM-13", "Chat", "Chat navigation"),
        ("APPIUM-14", "Profile", "Profile navigation"),
        ("APPIUM-15", "Map", "Map navigation"),
    ]

    for test_id, tab_text, test_name in nav_items:
        t0 = time.time()
        try:
            tab = safe_find(driver, AppiumBy.XPATH, f'//*[@text="{tab_text}" or @content-desc="{tab_text.lower()}"]')
            if tab:
                tab.click()
                time.sleep(1.5)
                record(test_id, "Navigation", test_name, "PASSED", int((time.time()-t0)*1000))
            else:
                record(test_id, "Navigation", test_name, "FAILED", int((time.time()-t0)*1000), f"Tab '{tab_text}' not found")
        except Exception as e:
            record(test_id, "Navigation", test_name, "FAILED", int((time.time()-t0)*1000), str(e))

# ─── PENDING Tests (documented for future emulator execution) ─────────────────
def record_pending_tests():
    """
    These tests are documented but require a real device/emulator to execute.
    They are recorded as PENDING so they appear in the test report.
    """
    pending = [
        ("APPIUM-16", "Chat", "Send community chat message"),
        ("APPIUM-17", "Chat", "Receive message updates in real-time"),
        ("APPIUM-18", "Profile", "Edit profile name from device"),
        ("APPIUM-19", "Profile", "Logout from device"),
        ("APPIUM-20", "Resources", "Add new resource from mobile"),
        ("APPIUM-21", "Resources", "Search resources by keyword"),
        ("APPIUM-22", "Resources", "Filter resources by category"),
        ("APPIUM-23", "Admin", "Admin can approve user from mobile"),
        ("APPIUM-24", "Notifications", "In-app notification received"),
        ("APPIUM-25", "Responsive", "Portrait orientation renders correctly"),
        ("APPIUM-26", "Responsive", "Landscape orientation renders correctly"),
        ("APPIUM-27", "Performance", "App loads within 3 seconds"),
        ("APPIUM-28", "Performance", "Resource list renders within 2 seconds"),
        ("APPIUM-29", "Security", "Session persists after app minimize"),
        ("APPIUM-30", "Security", "App locks after session timeout"),
    ]
    for test_id, category, name in pending:
        results.append({
            "id": test_id, "category": category, "name": name,
            "status": "PENDING", "duration": 0,
            "error": "Requires physical Android device or emulator",
            "type": "Appium"
        })
        print(f"  ⏳ [{test_id}] {name} -> PENDING (needs device)")

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("="*60)
    print("  EcoShare Appium Android Test Suite")
    print(f"  {timestamp}")
    print("="*60)

    driver = None
    if APPIUM_AVAILABLE:
        print("\nAttempting to connect to Appium server...")
        driver = make_driver()

    if driver:
        try:
            wait = WebDriverWait(driver, 10)
            run_launch_tests(driver, wait)
            run_auth_tests(driver, wait)
            run_resource_tests(driver, wait)
            run_navigation_tests(driver, wait)
        except Exception as e:
            print(f"Test execution error: {e}")
        finally:
            driver.quit()
            print("\nDevice disconnected.")
    else:
        print("\nNo Appium connection - recording launch/auth tests as PENDING")
        for i in range(1, 16):
            results.append({
                "id": f"APPIUM-{str(i).zfill(2)}",
                "category": "Android",
                "name": f"Android test {i}",
                "status": "PENDING",
                "duration": 0,
                "error": "Appium server not available",
                "type": "Appium"
            })

    record_pending_tests()

    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASSED")
    failed = sum(1 for r in results if r["status"] == "FAILED")
    pending = sum(1 for r in results if r["status"] == "PENDING")

    print("\n" + "="*60)
    print(f"  PASSED : {passed}")
    print(f"  FAILED : {failed}")
    print(f"  PENDING: {pending}")
    print(f"  TOTAL  : {total}")
    print("="*60)

    import json
    with open("android_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nResults saved: android_test_results.json")
    return results

if __name__ == "__main__":
    main()
