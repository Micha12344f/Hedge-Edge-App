"""
PropFirmOne Overview Page Inspector - Manual Login Version
This script opens the page and waits for you to login manually, then inspects.
"""

from playwright.sync_api import sync_playwright
import time
import json

def inspect_overview_page():
    with sync_playwright() as p:
        # Launch browser in headed mode
        browser = p.chromium.launch(headless=False, slow_mo=100)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        print("=" * 60)
        print("PROPFIRMONE OVERVIEW PAGE INSPECTION")
        print("=" * 60)
        
        # Navigate to login page
        print("\n[1] Navigating to PropFirmOne...")
        page.goto("https://app.propfirmone.com/app/overview")
        
        print("\n" + "=" * 60)
        print("PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW")
        print("Email: ryansossion@gmail.com")
        print("Password: Remery67!")
        print("=" * 60)
        print("\nAfter logging in and reaching the Overview page,")
        print("type 'Y' and press Enter to start the inspection...")
        
        # Wait for user confirmation
        user_input = input("\nReady to inspect? (Y/n): ").strip().upper()
        
        if user_input != 'Y' and user_input != '':
            print("Inspection cancelled.")
            browser.close()
            return
        
        print("\nStarting inspection...")
        time.sleep(2)  # Give a moment for page to be fully ready
        
        print(f"\n[5] Current URL: {page.url}")
        print("\n" + "=" * 60)
        print("PAGE STRUCTURE ANALYSIS")
        print("=" * 60)
        
        # Take a screenshot
        page.screenshot(path="propfirmone_overview.png", full_page=True)
        print("\n[Screenshot saved as propfirmone_overview.png]")
        
        # Analyze the page structure
        print("\n--- NAVIGATION ELEMENTS (Top Nav) ---")
        nav_items = page.locator("nav a, nav button, header a, header button, [role='navigation'] a, [class*='nav'] a").all()
        for i, item in enumerate(nav_items[:25]):
            try:
                text = item.inner_text().strip()
                href = item.get_attribute("href") or "N/A"
                if text and len(text) < 50:
                    print(f"  {i+1}. '{text}' -> {href}")
            except:
                pass
        
        print("\n--- MAIN HEADINGS ---")
        headings = page.locator("h1, h2, h3").all()
        for h in headings[:15]:
            try:
                text = h.inner_text().strip()
                tag = h.evaluate("el => el.tagName")
                if text:
                    print(f"  [{tag}] {text}")
            except:
                pass
        
        print("\n--- BUTTONS & INTERACTIVE ELEMENTS ---")
        buttons = page.locator("button, [role='button']").all()
        for i, btn in enumerate(buttons[:30]):
            try:
                text = btn.inner_text().strip()
                classes = btn.get_attribute("class") or ""
                if text and len(text) < 60:
                    print(f"  {i+1}. Button: '{text}'")
            except:
                pass
        
        print("\n--- TABS (Phase Tabs) ---")
        tabs = page.locator("[role='tab'], [role='tablist'] button, button[data-state], [class*='tab']").all()
        for tab in tabs[:15]:
            try:
                text = tab.inner_text().strip()
                state = tab.get_attribute("data-state") or tab.get_attribute("aria-selected") or ""
                classes = tab.get_attribute("class") or ""
                if text and len(text) < 50:
                    print(f"  Tab: '{text}' | state: {state}")
            except:
                pass
        
        print("\n--- CARDS/SECTIONS ---")
        cards = page.locator("[class*='card'], [class*='Card'], [class*='panel'], [class*='account']").all()
        print(f"  Found {len(cards)} card-like elements")
        for i, card in enumerate(cards[:10]):
            try:
                text = card.inner_text().strip()[:100]
                if text:
                    print(f"  Card {i+1}: {text}...")
            except:
                pass
        
        print("\n--- STATISTICS/METRICS ---")
        # Look for stat displays
        stats_containers = page.locator("[class*='stat'], [class*='metric'], [class*='summary'], [class*='total']").all()
        for stat in stats_containers[:10]:
            try:
                text = stat.inner_text().strip()
                if text and len(text) < 150:
                    print(f"  {text}")
            except:
                pass
        
        print("\n--- TABLES ---")
        tables = page.locator("table, [class*='table'], [role='table'], [class*='grid']").all()
        print(f"  Found {len(tables)} table-like element(s)")
        for i, table in enumerate(tables[:5]):
            try:
                headers = table.locator("th, [role='columnheader']").all()
                header_texts = [h.inner_text().strip() for h in headers if h.inner_text().strip()]
                if header_texts:
                    print(f"  Table {i+1} headers: {header_texts}")
            except:
                pass
        
        print("\n--- EMPTY STATE MESSAGES ---")
        empty_elements = page.locator("[class*='empty'], [class*='Empty'], [class*='no-data'], [class*='placeholder']").all()
        for el in empty_elements[:5]:
            try:
                text = el.inner_text().strip()
                if text and len(text) < 200:
                    print(f"  {text}")
            except:
                pass
        
        # Also look for text containing "no" at start
        no_texts = page.locator("p:has-text('No '), div:has-text('No '), span:has-text('No ')").all()
        for el in no_texts[:5]:
            try:
                text = el.inner_text().strip()
                if text.startswith("No ") and len(text) < 150:
                    print(f"  '{text}'")
            except:
                pass
        
        print("\n--- DROPDOWN/SELECT ELEMENTS ---")
        dropdowns = page.locator("select, [role='combobox'], [role='listbox'], [class*='dropdown'], [class*='select'], [class*='Select']").all()
        for i, dd in enumerate(dropdowns[:5]):
            try:
                text = dd.inner_text().strip()[:50] or dd.get_attribute("placeholder") or "dropdown"
                print(f"  {i+1}. {text}")
            except:
                pass
        
        # Get full page HTML structure (simplified)
        print("\n" + "=" * 60)
        print("DETAILED DOM STRUCTURE")
        print("=" * 60)
        
        try:
            structure = page.evaluate("""() => {
                function getStructure(el, depth = 0) {
                    if (depth > 5) return '';
                    const indent = '  '.repeat(depth);
                    const tag = el.tagName.toLowerCase();
                    const id = el.id ? `#${el.id}` : '';
                    const classes = el.className && typeof el.className === 'string' 
                        ? '.' + el.className.split(' ').filter(c => c && !c.includes('_')).slice(0, 2).join('.') 
                        : '';
                    const text = el.childNodes[0]?.nodeValue?.trim()?.slice(0, 25) || '';
                    
                    let result = `${indent}<${tag}${id}${classes}>${text ? ' "' + text + '"' : ''}\\n`;
                    
                    for (const child of el.children) {
                        if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT'].includes(child.tagName)) continue;
                        result += getStructure(child, depth + 1);
                    }
                    return result;
                }
                
                const main = document.querySelector('main, [role="main"], .main') || document.body;
                return getStructure(main);
            }""")
            print(structure[:4000])
        except Exception as e:
            print(f"Could not extract DOM structure: {e}")
        
        # Get CSS Variables
        print("\n" + "=" * 60)
        print("COLOR SCHEME / CSS VARIABLES")
        print("=" * 60)
        
        try:
            css_vars = page.evaluate("""() => {
                const styles = getComputedStyle(document.documentElement);
                const vars = {};
                for (let i = 0; i < styles.length; i++) {
                    const prop = styles[i];
                    if (prop.startsWith('--') && (prop.includes('color') || prop.includes('background') || prop.includes('primary') || prop.includes('border'))) {
                        vars[prop] = styles.getPropertyValue(prop).trim();
                    }
                }
                return vars;
            }""")
            for var, value in list(css_vars.items())[:25]:
                print(f"  {var}: {value}")
        except Exception as e:
            print(f"  Could not extract CSS variables: {e}")
        
        print("\n" + "=" * 60)
        print("INTERACTIVE BEHAVIOR TESTING")
        print("=" * 60)
        
        # Test clicking on tabs
        print("\n--- Testing Tab Interactions ---")
        tab_triggers = page.locator("[role='tab'], button:has-text('Evaluation'), button:has-text('Funded'), button:has-text('phase')").all()
        for i, tab in enumerate(tab_triggers[:4]):
            try:
                text = tab.inner_text().strip()
                if text:
                    print(f"  Found tab: '{text}'")
                    tab.click()
                    time.sleep(1)
                    page.screenshot(path=f"tab_{i}_{text.replace(' ', '_')[:15]}.png")
                    print(f"    Screenshot saved: tab_{i}_{text.replace(' ', '_')[:15]}.png")
            except Exception as e:
                print(f"    Error clicking tab: {e}")
        
        # Test "New Account" or "Add" buttons
        print("\n--- Testing Add Account Button ---")
        add_buttons = page.locator("button:has-text('New Account'), button:has-text('Add Account'), button:has-text('+ New'), button:has-text('Add')").all()
        for btn in add_buttons[:2]:
            try:
                text = btn.inner_text().strip()
                if len(text) < 30:
                    print(f"  Found button: '{text}'")
                    btn.click()
                    time.sleep(2)
                    
                    # Check for modal/dialog
                    modal = page.locator("[role='dialog'], [class*='modal'], [class*='Modal'], [class*='Dialog'], [class*='sheet']").first
                    if modal.is_visible(timeout=2000):
                        print("  ✓ Modal/Dialog opened!")
                        page.screenshot(path="add_account_modal.png")
                        print("    Screenshot saved: add_account_modal.png")
                        
                        # Analyze modal contents
                        print("\n  Modal Fields:")
                        labels = modal.locator("label").all()
                        for label in labels:
                            try:
                                label_text = label.inner_text().strip()
                                if label_text:
                                    print(f"    - {label_text}")
                            except:
                                pass
                        
                        inputs = modal.locator("input, select, textarea").all()
                        print(f"\n  Modal has {len(inputs)} input fields:")
                        for inp in inputs:
                            try:
                                name = inp.get_attribute("name") or inp.get_attribute("placeholder") or inp.get_attribute("id") or "unknown"
                                inp_type = inp.get_attribute("type") or "text"
                                print(f"    - {name} ({inp_type})")
                            except:
                                pass
                        
                        # Get modal buttons
                        modal_buttons = modal.locator("button").all()
                        print(f"\n  Modal buttons:")
                        for mb in modal_buttons:
                            try:
                                mb_text = mb.inner_text().strip()
                                if mb_text:
                                    print(f"    - {mb_text}")
                            except:
                                pass
                        
                        # Close modal
                        close_btn = modal.locator("button:has-text('Cancel'), button:has-text('Close'), button[aria-label='Close'], [class*='close']").first
                        if close_btn.is_visible(timeout=1000):
                            close_btn.click()
                            print("\n  Modal closed")
                            time.sleep(1)
                    break
            except Exception as e:
                print(f"    Error: {e}")
        
        print("\n" + "=" * 60)
        print("FULL PAGE CONTENT SUMMARY")
        print("=" * 60)
        
        try:
            full_text = page.locator("body").inner_text()
            # Clean up and show relevant parts
            lines = [line.strip() for line in full_text.split('\n') if line.strip() and len(line.strip()) > 2]
            unique_lines = []
            for line in lines[:100]:
                if line not in unique_lines and len(line) < 100:
                    unique_lines.append(line)
            print("\n".join(unique_lines[:50]))
        except:
            pass
        
        print("\n" + "=" * 60)
        print("INSPECTION COMPLETE")
        print("=" * 60)
        print("\nScreenshots saved:")
        print("  - propfirmone_overview.png (full page)")
        print("  - tab_*.png (tab states)")  
        print("  - add_account_modal.png (if modal opened)")
        print("\nBrowser will remain open for 60 seconds for additional manual inspection...")
        
        time.sleep(60)
        browser.close()

if __name__ == "__main__":
    inspect_overview_page()
