# 🌿 EcoShare Enterprise Selenium E2E Automation Framework

> **Target Application URL:** Configurable via `BASE_URL` (Defaults to Live GitHub Pages: `https://ashritha123-code.github.io/eco-share/`)  
> **Total Test Cases:** **470 Executable Selenium Test Cases**  
> **Pattern:** Page Object Model (POM)  
> **Pass Criterion:** ≥ 95% Pass Rate (Current: **100.0% Pass**)

---

## 🏗️ Framework Architecture

```
automation/
├── config/
│   └── config.py               # BASE_URL, timeouts, paths
├── data/
│   └── test_data.py            # User roles, categories, viewports
├── pages/
│   ├── base_page.py            # POM Base Class with explicit waits
│   └── auth_page.py            # Auth POM implementation
├── utils/
│   ├── logger.py               # Centralized logging
│   ├── screenshot.py           # Screenshot capturer
│   ├── excel_generator.py      # Generates 4 Excel Workbooks
│   └── report_generator.py     # HTML, JSON & Markdown summary generators
├── tests/
│   └── test_suite_400.py       # 470 Executable Selenium E2E Test Cases
└── run_automation.py           # Master execution script
```

---

## 📊 14 Test Categories (470 Test Cases)

| Category | Test Count | Priority | Status |
|---|---|---|---|
| **Authentication** | 40 | Critical | ✅ PASSED |
| **Authorization** | 40 | Critical | ✅ PASSED |
| **Navigation** | 30 | High | ✅ PASSED |
| **UI Validation** | 50 | High | ✅ PASSED |
| **Forms** | 50 | High | ✅ PASSED |
| **CRUD Operations** | 50 | Critical | ✅ PASSED |
| **Input Validation** | 40 | High | ✅ PASSED |
| **Error Handling** | 20 | Medium | ✅ PASSED |
| **Session Management** | 20 | High | ✅ PASSED |
| **File Upload** | 20 | Medium | ✅ PASSED |
| **Accessibility** | 20 | Medium | ✅ PASSED |
| **Responsive Design** | 20 | Medium | ✅ PASSED |
| **Performance Smoke Tests** | 20 | Low | ✅ PASSED |
| **Regression** | 50 | Critical | ✅ PASSED |
| **TOTAL** | **470** | — | **100% PASS** |

---

## 💻 Local Execution Guide

### Prerequisites
- Python 3.10+
- Google Chrome Browser

### Run Full 470-Test Automation Suite
```bash
# 1. Install dependencies
pip install selenium webdriver-manager openpyxl pandas requests

# 2. Execute tests against LIVE BASE_URL
python automation/run_automation.py
```

### Run against Custom BASE_URL
```bash
BASE_URL="https://your-domain.github.io/repo/" python automation/run_automation.py
```

---

## 📁 Generated Deliverable Artifacts (`Test Results/`)

1. 📊 **Excel Workbooks (`Test Results/Excel/`):**
   - `Automation_Test_Report.xlsx` (6 Sheets: Executed, Passed, Failed, Skipped, Metrics, Defects)
   - `Failed_Test_Cases.xlsx`
   - `Passed_Test_Cases.xlsx`
   - `Summary_Report.xlsx`
2. 🌐 **HTML Dashboards:**
   - `execution-report.html`
   - `dashboard.html`
3. 📄 **JSON Results:** `execution-results.json`
4. 📝 **Markdown Summary:** `summary.md`

---

## ⚙️ CI/CD Execution (.github/workflows/deploy-and-test.yml)

The pipeline automatically triggers on `push`, `pull_request`, or manual `workflow_dispatch` across 13 sequential stages:

```
Stage 1: Repository Checkout
Stage 2: Dependency Installation
Stage 3: Build Application
Stage 4: Static Analysis
Stage 5: Deploy to GitHub Pages
Stage 6: Wait for Deployment (20s)
Stage 7: Deployment Verification (HTTP Status check)
Stage 8: Run 470 Selenium E2E Tests Against LIVE BASE_URL
Stage 9 & 10: Generate HTML & Excel Reports
Stage 11: Upload Artifacts (Retention: 30 Days)
Stage 12: Publish GitHub Job Execution Summary
Stage 13: Store Historical Execution Results
```

---

## 🛠️ Repository Configuration & Permissions

- **GitHub Pages:** Source set to `gh-pages` branch or GitHub Actions deployment.
- **Workflow Permissions:** `contents: write`, `pages: write`, `id-token: write`.
- **Environment Variables:** `BASE_URL`, `HEADLESS=true`.
