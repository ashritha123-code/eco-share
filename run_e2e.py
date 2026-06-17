import urllib.request
import sys
import subprocess
import time

print("--- Starting EcoShare E2E Validation Tests ---")

# Step 1: Verify local web server is up
server_url = "http://localhost:3000"
print(f"Checking if local server is running at {server_url}...")
attempts = 5
server_up = False

for i in range(attempts):
    try:
        response = urllib.request.urlopen(server_url, timeout=2)
        if response.status == 200:
            print("SUCCESS: Local HTTP Server responded with status 200.")
            server_up = True
            break
    except Exception as e:
        print(f"Warning: Server connection attempt {i+1}/{attempts} failed. Retrying in 1s...")
        time.sleep(1)

if not server_up:
    print("ERROR: Local HTTP Server failed to start in time. Exiting with failure.")
    sys.exit(1)

# Step 2: Trigger detailed Excel report generation
print("Running Excel report generator (generate_excel.py)...")
try:
    # Run the generator script
    import generate_excel
    print("SUCCESS: Excel report sheet generated successfully.")
except Exception as e:
    print(f"ERROR: Failed to run report generator script: {e}")
    sys.exit(1)

print("--- E2E Validation Pipeline Completed Successfully! ---")
sys.exit(0)
