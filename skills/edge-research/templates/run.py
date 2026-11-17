"""
run.py — runs/<name>/run.py

Optional clean-environment launcher for harness.py. Some agent runtimes
leak PYTHONPATH / VIRTUAL_ENV / PYTHONHOME into child processes, which can
make `python` resolve to a mismatched stdlib (for example
`AssertionError: SRE module mismatch` on `import re`). This wrapper clears
those variables and re-runs harness.py with a known interpreter so results
are reproducible.

Interpreter choice: set EDGE_RESEARCH_PYTHON to an absolute interpreter
path; otherwise the interpreter running this script is used.

Usage (arguments are passed through to harness.py unchanged):
    python run.py --candidate <path> --preflight <preflight.md> \\
                  --experiment <name> --description <text> [...]
"""
import os
import subprocess
import sys

# Clear variables that can hijack the Python interpreter.
for var in ("PYTHONPATH", "VIRTUAL_ENV", "PYTHONHOME"):
    os.environ.pop(var, None)
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"

# Run from this folder so harness.py's relative lookups (evals/, results.tsv) resolve.
here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)

PY = os.environ.get("EDGE_RESEARCH_PYTHON") or sys.executable
if not os.path.exists(PY):
    PY = sys.executable

cmd = [PY, "harness.py"] + sys.argv[1:]
result = subprocess.run(cmd, env=os.environ)
sys.exit(result.returncode)
