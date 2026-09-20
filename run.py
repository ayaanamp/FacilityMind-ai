"""Unified Multi-Process Launcher for FacilityMind AI.

Runs both FastAPI backend and Vite frontend simultaneously in a single terminal.
Usage:
    python run.py
"""

import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def get_python_executable():
    """Detect the virtualenv Python or fallback to current Python."""
    venv_py_win = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    venv_py_unix = BACKEND_DIR / ".venv" / "bin" / "python"

    if venv_py_win.exists():
        return str(venv_py_win)
    elif venv_py_unix.exists():
        return str(venv_py_unix)
    return sys.executable


def get_npm_executable():
    """Detect npm command name for OS."""
    return "npm.cmd" if sys.platform == "win32" else "npm"


def stream_logs(process, prefix, color_code):
    """Stream subprocess stdout and stderr with distinct prefixes and colors."""
    reset_code = "\033[0m"
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            print(f"{color_code}[{prefix}]{reset_code} {line.rstrip()}", flush=True)
    except Exception:
        pass


def main():
    py_exec = get_python_executable()
    npm_exec = get_npm_executable()

    print("=" * 75)
    print("  🚀 FACILITYMIND AI — UNIFIED DUAL RUNTIME LAUNCHER")
    print("=" * 75)
    print(f"  • Root Directory : {ROOT_DIR}")
    print(f"  • Python Engine  : {py_exec}")
    print(f"  • Node/NPM       : {npm_exec}")
    print("=" * 75)
    print("  Starting Backend and Frontend in parallel...")
    print("  Press Ctrl+C at any time to shut down both servers.\n")

    # 1. Backend process (FastAPI / Uvicorn)
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = str(ROOT_DIR)

    backend_cmd = [
        py_exec,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload",
    ]

    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=backend_env,
    )

    # 2. Frontend process (Vite Dev Server)
    frontend_cmd = [npm_exec, "run", "dev"]

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    # Launch streaming threads
    # Cyan for backend, Green for frontend
    backend_thread = threading.Thread(
        target=stream_logs,
        args=(backend_proc, "BACKEND :8000", "\033[36m"),
        daemon=True,
    )
    frontend_thread = threading.Thread(
        target=stream_logs,
        args=(frontend_proc, "FRONTEND:5173", "\033[32m"),
        daemon=True,
    )

    backend_thread.start()
    frontend_thread.start()

    print("\n✅ Subsystems Dispatched:")
    print("   🌐 User / Student Portal : http://localhost:5173")
    print("   🛡️  Admin Command Center  : http://localhost:5173 (Admin Sign In)")
    print("   🔌 REST API Swagger Docs : http://localhost:8000/api/v1/docs\n")

    # Automatically launch web browser
    def auto_open_browser():
        time.sleep(2.5)
        try:
            import webbrowser

            webbrowser.open("http://localhost:5173")
        except Exception:
            pass

    threading.Thread(target=auto_open_browser, daemon=True).start()

    def shutdown(signum=None, frame=None):
        print("\n\n🛑 Shutting down FacilityMind AI servers...")
        for name, proc in [("Frontend", frontend_proc), ("Backend", backend_proc)]:
            try:
                if sys.platform == "win32":
                    subprocess.call(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                else:
                    proc.terminate()
            except Exception:
                pass
        print("✅ All processes stopped cleanly. Goodbye!\n")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    # Keep main thread alive
    try:
        while True:
            # Check if any process terminated unexpectedly
            b_ret = backend_proc.poll()
            f_ret = frontend_proc.poll()

            if b_ret is not None:
                print(f"\n❌ Backend process exited with code {b_ret}")
                shutdown()
            if f_ret is not None:
                print(f"\n❌ Frontend process exited with code {f_ret}")
                shutdown()

            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
