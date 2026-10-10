"""
Root launcher for AI Funny Face Commentator.
Runs the main application located inside the AI-Funny-Face package.
"""

import os
import sys

# Add AI-Funny-Face to path
pkg_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AI-Funny-Face")
if os.path.isdir(pkg_dir):
    sys.path.insert(0, pkg_dir)
    os.chdir(pkg_dir)

try:
    from main import main
    if __name__ == "__main__":
        main()
except ImportError as e:
    print(f"Failed to start AI Funny Face Commentator: {e}")
    sys.exit(1)
