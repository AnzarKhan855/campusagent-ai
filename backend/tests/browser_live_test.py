import uuid
from playwright.sync_api import sync_playwright

test_email = f"dup_check_{uuid.uuid4().hex[:6]}@example.com"
print(f"Testing initial signup with: {test_email}")

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True
    )
    context = browser.new_context()
    page = context.new_page()

    page.on("response", lambda res: print(f"[NET] {res.status} {res.request.method} {res.url}") if "api" in res.url else None)

    # 1. First signup
    page.goto("https://campusagent-ai.vercel.app/signup", wait_until="networkidle")
    page.locator('input[placeholder*="name" i]').fill("First Signup")
    page.locator('input[type="email"]').fill(test_email)
    page.locator('input[type="password"]').fill("Password123!")
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(5000)
    print("First signup URL:", page.url)

    # 2. Duplicate signup attempt
    print("\nAttempting DUPLICATE signup with same email...")
    page.goto("https://campusagent-ai.vercel.app/signup", wait_until="networkidle")
    page.locator('input[placeholder*="name" i]').fill("Second Duplicate")
    page.locator('input[type="email"]').fill(test_email)
    page.locator('input[type="password"]').fill("Password123!")
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(4000)

    print("Duplicate signup URL:", page.url)
    text = page.inner_text("body")
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    for line in lines:
        if any(w in line.lower() for w in ["already", "error", "failed", "registered"]):
            print("DUPLICATE FEEDBACK:", line)

    # 3. Test Login with created account
    print("\nTesting LOGIN with created credentials...")
    page.goto("https://campusagent-ai.vercel.app/login", wait_until="networkidle")
    page.locator('input[type="email"]').fill(test_email)
    page.locator('input[type="password"]').fill("Password123!")
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(5000)
    print("Post-login URL:", page.url)
    assert "/dashboard" in page.url

    browser.close()
    print("\nALL BROWSER AUTH TESTS COMPLETED SUCCESSFULLY!")
