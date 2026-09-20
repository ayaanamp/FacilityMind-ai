"""Automated Quality Gate and Workspace Verification Script.

Executes comprehensive health, build, lint, and test checks across frontend and backend.
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def safe_print(text: str) -> None:
    """Print text safely across all OS consoles without encoding crashes."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def run_step(step_name: str, cmd: list[str], cwd: Path) -> bool:
    """Run a single verification step and print results."""
    safe_print(f"\n[CHECK] {step_name}...")
    safe_print(f"        Running: {' '.join(cmd)} in {cwd.name}")
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if result.returncode == 0:
            safe_print(f"[PASS]  {step_name}")
            return True
        else:
            safe_print(f"[FAIL]  {step_name}")
            if result.stdout:
                safe_print("--- STDOUT ---")
                safe_print(result.stdout.strip())
            if result.stderr:
                safe_print("--- STDERR ---")
                safe_print(result.stderr.strip())
            return False
    except Exception as e:
        safe_print(f"[ERROR] {step_name} exception: {e}")
        return False


def main() -> int:
    """Main verification orchestrator."""
    print("=" * 60)
    print("FACILITYMIND AI PLATFORM VERIFICATION GATE")
    print("=" * 60)

    # Determine Python executable
    python_exe = sys.executable
    venv_py = ROOT_DIR / "backend" / ".venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        python_exe = str(venv_py)

    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

    steps = [
        # 1. Backend Linting
        (
            "Backend Lint (Ruff)",
            [python_exe, "-m", "ruff", "check", "backend"],
            ROOT_DIR,
        ),
        # 2. Backend Unit & Integration Tests
        (
            "Backend Tests (Pytest)",
            [python_exe, "-m", "pytest", "backend/tests"],
            ROOT_DIR,
        ),
        # 3. Backend Module Import & Startup Check
        (
            "Backend App Import Check",
            [python_exe, "-c", "from backend.app.main import app; print('FastAPI App Initialized OK')"],
            ROOT_DIR,
        ),
        # 4. Frontend Type Checking & Production Build
        (
            "Frontend Build (TypeScript & Vite)",
            [npm_cmd, "run", "build"],
            ROOT_DIR / "frontend",
        ),
        # 5. Frontend Tests (Vitest)
        (
            "Frontend Tests (Vitest)",
            [npm_cmd, "run", "test"],
            ROOT_DIR / "frontend",
        ),
    ]

    all_passed = True
    results = []

    for name, cmd, cwd in steps:
        passed = run_step(name, cmd, cwd)
        results.append((name, passed))
        if not passed:
            all_passed = False

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    for name, passed in results:
        status_str = "PASSED" if passed else "FAILED"
        print(f" - {name:<40}: {status_str}")

    print("=" * 60)
    if all_passed:
        print("ALL QUALITY GATES PASSED [100% SUCCESS]")
        return 0
    else:
        print("SOME CHECKS FAILED - REVIEW LOGS ABOVE")
        return 1


if __name__ == "__main__":
    sys.exit(main())
