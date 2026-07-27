/**
 * Selenium E2E - Login Flow Test
 * Tests the EcoCircle login form on the live GitHub Pages deployment.
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const SITE_URL = 'https://ashritha123-code.github.io/eco-share';

async function runLoginTest() {
  const options = new chrome.Options();
  options.addArguments('--headless');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1280,900');

  let driver;
  let passed = 0;
  let failed = 0;

  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    console.log('\n=================================================');
    console.log('  EcoCircle Selenium Login Test Suite');
    console.log('=================================================\n');

    // ─── TEST 1: Page loads ───────────────────────────────────
    try {
      await driver.get(SITE_URL);
      await driver.wait(until.elementLocated(By.tagName('body')), 10000);
      const title = await driver.getTitle();
      console.log(`✅ [SEL-01] Page loaded: "${title}"`);
      passed++;
    } catch (e) {
      console.log(`❌ [SEL-01] Page failed to load: ${e.message}`);
      failed++;
    }

    // ─── TEST 2: Auth container visible ──────────────────────
    try {
      await new Promise(r => setTimeout(r, 2000));
      const authContainer = await driver.findElement(By.id('authContainer'));
      if (authContainer) {
        console.log('✅ [SEL-02] Auth container visible on first load');
        passed++;
      }
    } catch (e) {
      console.log(`❌ [SEL-02] Auth container not found: ${e.message}`);
      failed++;
    }

    // ─── TEST 3: Login tab clickable ─────────────────────────
    try {
      const loginTab = await driver.findElement(By.id('tabLogin'));
      await loginTab.click();
      await new Promise(r => setTimeout(r, 500));
      console.log('✅ [SEL-03] Login tab clicked successfully');
      passed++;
    } catch (e) {
      console.log(`❌ [SEL-03] Login tab not found: ${e.message}`);
      failed++;
    }

    // ─── TEST 4: Email input has id="loginEmail" ─────────────
    try {
      const emailInput = await driver.findElement(By.id('loginEmail'));
      await emailInput.clear();
      await emailInput.sendKeys('test@ecocircle.com');
      const val = await emailInput.getAttribute('value');
      if (val === 'test@ecocircle.com') {
        console.log('✅ [SEL-04] Email input accepts text');
        passed++;
      }
    } catch (e) {
      console.log(`❌ [SEL-04] Email input error: ${e.message}`);
      failed++;
    }

    // ─── TEST 5: Password input type="password" ───────────────
    try {
      const pwInput = await driver.findElement(By.id('loginPassword'));
      const type = await pwInput.getAttribute('type');
      if (type === 'password') {
        console.log('✅ [SEL-05] Password input type is "password"');
        passed++;
      } else {
        throw new Error(`Expected type="password", got "${type}"`);
      }
    } catch (e) {
      console.log(`❌ [SEL-05] Password input error: ${e.message}`);
      failed++;
    }

    // ─── TEST 6: Password input accepts text ─────────────────
    try {
      const pwInput = await driver.findElement(By.id('loginPassword'));
      await pwInput.sendKeys('TestPass123');
      console.log('✅ [SEL-06] Password input accepts text');
      passed++;
    } catch (e) {
      console.log(`❌ [SEL-06] Password input error: ${e.message}`);
      failed++;
    }

    // ─── TEST 7: Register tab navigates to register form ─────
    try {
      const regTab = await driver.findElement(By.id('tabRegister'));
      await regTab.click();
      await new Promise(r => setTimeout(r, 500));
      const regForm = await driver.findElement(By.id('registerForm'));
      if (regForm) {
        console.log('✅ [SEL-07] Register tab shows register form');
        passed++;
      }
    } catch (e) {
      console.log(`❌ [SEL-07] Register tab error: ${e.message}`);
      failed++;
    }

    // ─── TEST 8: All 4 register fields exist ─────────────────
    try {
      const fields = ['registerName', 'registerEmail', 'registerPassword', 'registerConfirmPassword'];
      for (const fid of fields) {
        await driver.findElement(By.id(fid));
      }
      console.log('✅ [SEL-08] All 4 register fields present');
      passed++;
    } catch (e) {
      console.log(`❌ [SEL-08] Register fields error: ${e.message}`);
      failed++;
    }

    // ─── TEST 9: Toast container in DOM ──────────────────────
    try {
      const toast = await driver.findElement(By.id('toastContainer'));
      if (toast) {
        console.log('✅ [SEL-09] Toast container present');
        passed++;
      }
    } catch (e) {
      console.log(`❌ [SEL-09] Toast container missing: ${e.message}`);
      failed++;
    }

    // ─── TEST 10: Viewport meta tag present ──────────────────
    try {
      const meta = await driver.findElement(By.css("meta[name='viewport']"));
      if (meta) {
        console.log('✅ [SEL-10] Viewport meta tag present');
        passed++;
      }
    } catch (e) {
      console.log(`❌ [SEL-10] Viewport meta missing: ${e.message}`);
      failed++;
    }

  } finally {
    if (driver) await driver.quit();
  }

  const total = passed + failed;
  console.log('\n=================================================');
  console.log(`  ✅ PASSED  : ${passed}`);
  console.log(`  ❌ FAILED  : ${failed}`);
  console.log(`  📊 TOTAL   : ${total}`);
  console.log('=================================================\n');

  if (failed > 0) {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('🎉 All Selenium tests passed!');
    process.exit(0);
  }
}

runLoginTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
