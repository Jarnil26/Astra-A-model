import requests
import time
import os

APP_URL = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:10000")
HEALTH_URL = f"{APP_URL}/health"

def keep_alive():
    print(f"📡 Starting Health Pinger for {HEALTH_URL}")
    while True:
        try:
            response = requests.get(HEALTH_URL, timeout=10)
            if response.status_code == 200:
                print(f"💓 Heartbeat successful: {response.json().get('status')}")
            else:
                print(f"⚠️ Heartbeat returned status {response.status_code}")
        except Exception as e:
            print(f"❌ Heartbeat failed: {e}")
        
        time.sleep(120)  # 2 minutes

if __name__ == "__main__":
    keep_alive()
