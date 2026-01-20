from playwright.sync_api import sync_playwright
import time

def inspect_propfirmone():
    with sync_playwright() as p:
        # Launch browser in headed mode so you can log in manually
        browser = p.chromium.launch(headless=False, slow_mo=300)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        # Navigate to the login page
        print("Navigating to PropFirmOne...")
        page.goto("https://app.propfirmone.com/sign-in")
        
        # Wait for user to log in manually
        print("\n" + "="*60)
        print("PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW")
        print("="*60)
        input("Press Enter when you've logged in and are on the Overview page...")
        
        print("\nWaiting for page to stabilize...")
        time.sleep(3)
        
        # Take initial screenshot
        print("\n1. Taking screenshot of Overview page (initial state)...")
        page.screenshot(path="01_overview_initial.png", full_page=True)
        print("   ✓ Saved: 01_overview_initial.png")
        
        print("\n" + "="*60)
        print("STEP 1: ANALYZING OVERVIEW PAGE STRUCTURE")
        print("="*60)
        
        # Get all buttons and their purposes
        print("\n--- All Interactive Buttons ---")
        buttons = page.locator("button").all()
        button_details = []
        for i, button in enumerate(buttons):
            try:
                text = button.inner_text().strip()
                if text:
                    classes = button.get_attribute("class") or ""
                    aria_label = button.get_attribute("aria-label") or ""
                    button_details.append({
                        'index': i,
                        'text': text,
                        'classes': classes[:100],
                        'aria_label': aria_label
                    })
                    print(f"  [{i}] '{text}'")
                    if aria_label:
                        print(f"      aria-label: {aria_label}")
            except:
                pass
        
        # Test clicking each major button
        print("\n" + "="*60)
        print("STEP 2: TESTING EACH BUTTON")
        print("="*60)
        
        # Test Tutorials button
        print("\n[Testing: Tutorials Button]")
        try:
            tutorials_btn = page.get_by_role("button", name="Tutorials")
            if tutorials_btn.count() > 0:
                tutorials_btn.first.click()
                time.sleep(2)
                page.screenshot(path="02_tutorials_clicked.png")
                print("   ✓ Clicked Tutorials - Screenshot saved")
                # Close any modal/dialog
                try:
                    page.keyboard.press("Escape")
                    time.sleep(1)
                except:
                    pass
        except Exception as e:
            print(f"   ✗ Could not test Tutorials: {e}")
        
        # Test Sync buttons
        print("\n[Testing: Sync Buttons]")
        try:
            sync_buttons = page.get_by_role("button").filter(has_text="Sync").all()
            for idx, btn in enumerate(sync_buttons[:3]):
                btn_text = btn.inner_text()
                print(f"   Testing: {btn_text}")
                btn.click()
                time.sleep(2)
                page.screenshot(path=f"03_sync_button_{idx}.png")
                print(f"   ✓ Screenshot saved: 03_sync_button_{idx}.png")
                time.sleep(1)
        except Exception as e:
            print(f"   ✗ Could not test Sync buttons: {e}")
        
        # Test Phase Tabs
        print("\n[Testing: Phase Tabs]")
        try:
            evaluation_tab = page.get_by_role("button", name="Evaluation")
            funded_tab = page.get_by_role("button", name="Funded")
            
            if evaluation_tab.count() > 0:
                print("   Clicking Evaluation tab...")
                evaluation_tab.first.click()
                time.sleep(2)
                page.screenshot(path="04_evaluation_tab.png")
                print("   ✓ Evaluation tab screenshot saved")
            
            if funded_tab.count() > 0:
                print("   Clicking Funded tab...")
                funded_tab.first.click()
                time.sleep(2)
                page.screenshot(path="05_funded_tab.png")
                print("   ✓ Funded tab screenshot saved")
        except Exception as e:
            print(f"   ✗ Could not test tabs: {e}")
        
        # Now test Add Account flow
        print("\n" + "="*60)
        print("STEP 3: TESTING ADD ACCOUNT FLOW")
        print("="*60)
        
        try:
            print("\n[Opening Add Account Modal]")
            add_btn = page.get_by_role("button", name="Add Account")
            add_btn.click()
            time.sleep(2)
            page.screenshot(path="06_add_account_modal_step1.png")
            print("   ✓ Modal opened - Step 1 screenshot saved")
            
            # Get modal structure
            print("\n   Modal Step 1 - Account Type Selection:")
            try:
                modal_text = page.locator("[role='dialog']").first.inner_text()
                print("   " + "\n   ".join(modal_text.split("\n")[:20]))
            except:
                print("   (Could not extract modal text)")
            
            # MANUAL INTERVENTION - Let user fill the form
            print("\n" + "="*60)
            print("MANUAL STEP: FILL OUT THE ADD ACCOUNT FORM")
            print("="*60)
            print("Please manually:")
            print("  1. Select account type (Evaluation)")
            print("  2. Click Continue")
            print("  3. Fill in: Account Name = 'd'")
            print("  4. Select: Account Size = $25k")
            print("  5. Select: Platform = MT5")
            print("  6. Select: Server = FTMO-Demo")
            print("  7. Check 'Add Prop Firm Rules'")
            print("  8. Set rules: Trading Days=5, Profit Target=10, Max Loss=5, Max Daily Loss=10")
            print("  9. Click 'Add Account' button")
            print("="*60)
            input("Press Enter once you've added the account and the modal has closed...")
            
            time.sleep(2)
            page.screenshot(path="11_account_added.png", full_page=True)
            print("   ✓ Account added - Final screenshot saved")
            
            # Analyze the new UI state
            print("\n[Analyzing Post-Add UI State]")
            print("   Looking for new account card...")
            account_cards = page.locator("[class*='card'], [class*='account']").all()
            print(f"   Found {len(account_cards)} potential account cards")
            
        except Exception as e:
            print(f"   ✗ Error during Add Account flow: {e}")
            page.screenshot(path="error_state.png")
            print("   Error screenshot saved")
        
        print("\n" + "="*60)
        print("INSPECTION COMPLETE - MANUAL REVIEW TIME")
        print("="*60)
        print("Explore the changes and verify the account was added.")
        print("Browser will remain open for 90 seconds...")
        
        time.sleep(90)
        
        browser.close()
        print("\n✓ All screenshots and analysis complete!")

if __name__ == "__main__":
    inspect_propfirmone()
