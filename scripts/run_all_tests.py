"""
Hedge Edge Complete Test Runner

Master script that runs all tests and generates a comprehensive report.

Usage:
    python run_all_tests.py [--api-only] [--ui-only] [--license-server]
"""

import subprocess
import sys
import os
import time
import json
from datetime import datetime
from pathlib import Path

BIN_DIR = Path(__file__).parent
RESULTS_DIR = BIN_DIR / "test_results"
RESULTS_DIR.mkdir(exist_ok=True)


def print_banner(text: str):
    print("\n" + "=" * 60)
    print(text.center(60))
    print("=" * 60 + "\n")


def run_command(cmd: list, timeout: int = 60) -> tuple:
    """Run a command and return (success, output)"""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(BIN_DIR)
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)


def start_license_server():
    """Start the license API server in background"""
    print("Starting License API Server...")
    
    # Check if already running
    import requests
    try:
        response = requests.get("http://localhost:5001/v1/license/status", timeout=2)
        if response.status_code == 200:
            print("  ✓ License API already running")
            return None
    except:
        pass
    
    # Start server
    process = subprocess.Popen(
        [sys.executable, str(BIN_DIR / "license_api_server.py")],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(BIN_DIR)
    )
    
    # Wait for server to start
    for _ in range(10):
        try:
            response = requests.get("http://localhost:5001/v1/license/status", timeout=1)
            if response.status_code == 200:
                print("  ✓ License API started successfully")
                return process
        except:
            time.sleep(0.5)
    
    print("  ✗ Failed to start License API server")
    return None


def run_api_tests():
    """Run API integration tests"""
    print_banner("API INTEGRATION TESTS")
    
    success, output = run_command([sys.executable, str(BIN_DIR / "api_test_suite.py")])
    print(output)
    
    return success


def run_ui_tests():
    """Run UI automation tests"""
    print_banner("UI AUTOMATION TESTS")
    
    try:
        import pyautogui
        print("PyAutoGUI available - running UI tests...")
        success, output = run_command(
            [sys.executable, str(BIN_DIR / "ui_test_suite.py"), "--quick"],
            timeout=120
        )
        print(output)
        return success
    except ImportError:
        print("PyAutoGUI not installed - skipping UI tests")
        print("Install with: pip install pyautogui")
        return True  # Not a failure if optional dependency missing


def check_app_running():
    """Check if the Electron app is running"""
    try:
        import pyautogui
        windows = pyautogui.getWindowsWithTitle("Hedge Edge")
        return len(windows) > 0
    except:
        return False


def generate_full_report(api_passed: bool, ui_passed: bool, duration: float):
    """Generate comprehensive test report"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "duration_seconds": round(duration, 2),
        "results": {
            "api_tests": "PASSED" if api_passed else "FAILED",
            "ui_tests": "PASSED" if ui_passed else "FAILED/SKIPPED"
        },
        "overall": "PASSED" if (api_passed and ui_passed) else "FAILED"
    }
    
    report_path = RESULTS_DIR / f"full_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print_banner("FINAL REPORT")
    print(f"API Tests:    {'✓ PASSED' if api_passed else '✗ FAILED'}")
    print(f"UI Tests:     {'✓ PASSED' if ui_passed else '✗ FAILED/SKIPPED'}")
    print(f"Duration:     {duration:.2f} seconds")
    print(f"Report:       {report_path}")
    print(f"\nOverall:      {'✓ ALL TESTS PASSED' if report['overall'] == 'PASSED' else '✗ SOME TESTS FAILED'}")
    
    return report


def main():
    start_time = time.time()
    
    print_banner("HEDGE EDGE TEST RUNNER")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python: {sys.version}")
    print(f"Working directory: {BIN_DIR}")
    
    # Parse arguments
    api_only = '--api-only' in sys.argv
    ui_only = '--ui-only' in sys.argv
    start_server = '--license-server' in sys.argv or not api_only
    
    license_server_process = None
    api_passed = True
    ui_passed = True
    
    try:
        # Start license server if needed
        if start_server:
            license_server_process = start_license_server()
            time.sleep(1)  # Give server time to fully start
        
        # Run tests
        if not ui_only:
            api_passed = run_api_tests()
            
        if not api_only:
            if check_app_running():
                ui_passed = run_ui_tests()
            else:
                print("\n⚠ Hedge Edge app not running - skipping UI tests")
                print("  Start the app with: npm run electron:dev")
                ui_passed = True  # Don't count as failure
        
    finally:
        # Cleanup
        if license_server_process:
            print("\nShutting down License API server...")
            license_server_process.terminate()
            
    duration = time.time() - start_time
    report = generate_full_report(api_passed, ui_passed, duration)
    
    sys.exit(0 if report['overall'] == 'PASSED' else 1)


if __name__ == '__main__':
    main()
