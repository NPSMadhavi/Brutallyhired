#!/usr/bin/env python3
"""Cross-platform external connection monitor (Windows, Linux, macOS).

Modular runner wrapping the port_monitor package.
"""

import sys
import os

# Ensure package is resolvable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from port_monitor.cli import run_cli

if __name__ == "__main__":
    run_cli()
