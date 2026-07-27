"""
Test Data Repository for Automation Framework
"""

USERS = {
    "admin": {"email": "admin@ecoshare.com", "password": "EcoPass123!", "role": "Community Admin"},
    "household": {"email": "user@test.com", "password": "UserPass123!", "role": "Household / Resident"},
    "ngo": {"email": "ngo@charity.org", "password": "NgoPass123!", "role": "NGO / Charity"},
    "volunteer": {"email": "volunteer@eco.org", "password": "VolPass123!", "role": "Volunteer"}
}

CATEGORIES = [
    "Food", "Clothes", "Books", "Furniture", "Electronics",
    "Kitchen Items", "Medical Supplies", "Educational Materials", "Household Items", "Other"
]

VIEWPORTS = [
    {"name": "Mobile Small", "width": 375, "height": 667},
    {"name": "Mobile Medium", "width": 390, "height": 844},
    {"name": "Mobile Large", "width": 412, "height": 915},
    {"name": "Tablet", "width": 768, "height": 1024},
    {"name": "Desktop HD", "width": 1280, "height": 900},
    {"name": "Desktop FHD", "width": 1920, "height": 1080}
]

TEST_MODULES = [
    ("Authentication", 40),
    ("Authorization", 40),
    ("Navigation", 30),
    ("UI Validation", 50),
    ("Forms", 50),
    ("CRUD Operations", 50),
    ("Input Validation", 40),
    ("Error Handling", 20),
    ("Session Management", 20),
    ("File Upload", 20),
    ("Accessibility", 20),
    ("Responsive Design", 20),
    ("Performance Smoke Tests", 20),
    ("Regression", 50)
]
