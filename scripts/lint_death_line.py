import sys
import os
import re

"""
Sovereign Death Line Linter (SDLL)
Enforces architectural boundaries in codexAIecom.
"""

FORBIDDEN_KEYWORDS = [
    "prisma", "db", "requests", "httpx", "aiohttp",
    "boto3", "google.cloud", "stripe"
]

COGNITION_PATH = "apps/agent-py/src"

# Files explicitly exempted from Death Line checks.
# Entry points are allowed to import execution-layer dependencies because they
# wire together the graph runtime and are not reasoning nodes themselves.
SKIP_FILES: set[str] = {"main.py"}

# Patterns that indicate ASIN/SKU/ERP Code used as entity key (warning, non-blocking)
ENTITY_KEY_WARNING_PATTERNS = [
    # dict key patterns: {"ASIN": ..., 'SKU': ...} or key="ASIN"
    r'["\']ASIN["\'][\s]*:',
    r'["\']asin["\'][\s]*:',
    r'["\']SKU["\'][\s]*:',
    r'["\']sku["\'][\s]*:',
    r'["\']ERP_?[Cc]ode["\'][\s]*:',
    # f-string key: f"...:{product.asin}" or f"arm:{listing.externalListingId}"
    r'f["\'][^"\']*:\{[^}]*\.asin\}',
    r'f["\'][^"\']*:\{[^}]*\.externalListingId\}',
    r'f["\'][^"\']*:\{[^}]*\.erpCode\}',
]


def check_file(filepath):
    errors = []
    warnings = []
    with open(filepath, 'r') as f:
        content = f.read()

        # Rule 1: Forbidden Imports
        for keyword in FORBIDDEN_KEYWORDS:
            if re.search(fr"import\s+.*{keyword}|from\s+{keyword}", content):
                errors.append(f"Forbidden execution-layer import found: '{keyword}'")

        # Rule 2: Missing Purity Check
        is_node_file = "/nodes/" in filepath or "_node" in filepath
        is_utility = any(part in filepath for part in ["_shared.py", "__init__.py", "load_performance", "observation_set"])
        if is_node_file and not is_utility and "verify_brain_purity()" not in content:
            if "StateGraph" not in content:
                errors.append("Reasoning node detected but 'verify_brain_purity()' call is missing.")

        # Rule 3 (Warning): ASIN/SKU/ERP Code used as entity hash key
        for pattern in ENTITY_KEY_WARNING_PATTERNS:
            if re.search(pattern, content):
                warnings.append(
                    f"Potential ASIN/SKU/ERP Code used as entity key (pattern: {pattern}). "
                    "Use buildEntityHash('product'|'listing'|'campaign', globalId) instead. "
                    "See AI_CODING_RULES.md §16."
                )
                break  # one warning per file is enough

    return errors, warnings


def main():
    total_errors = 0
    total_warnings = 0
    for root, _, files in os.walk(COGNITION_PATH):
        for file in files:
            if file.endswith(".py") and file not in SKIP_FILES:
                rel_path = os.path.join(root, file)
                file_errors, file_warnings = check_file(rel_path)
                if file_errors:
                    print(f"\033[91m[FAILURE]\033[0m {rel_path}:")
                    for err in file_errors:
                        print(f"  - {err}")
                    total_errors += len(file_errors)
                if file_warnings:
                    print(f"\033[93m[WARNING]\033[0m {rel_path}:")
                    for warn in file_warnings:
                        print(f"  - {warn}")
                    total_warnings += len(file_warnings)

    if total_warnings > 0:
        print(f"\nArchitecture Warnings (non-blocking): {total_warnings}")

    if total_errors > 0:
        print(f"\nTotal Architecture Violations: {total_errors}")
        sys.exit(1)
    else:
        print("\033[92m[SUCCESS]\033[0m Architecture Death Line is secure.")
        sys.exit(0)


if __name__ == "__main__":
    main()
