"""Expose repository documents in MkDocs without duplicating source files."""

from pathlib import Path
import re

from mkdocs.structure.files import File


PAGES = {
    "README.md": "project-readme.md",
    "CONTRIBUTING.md": "contributing.md",
    "CODE_OF_CONDUCTS.md": "code-of-conduct.md",
    "LICENSE.md": "license.md",
    "CHANGELOG.md": "changelog.md",
    "SECURITY.md": "security.md",
}


def on_files(files, config):
    root = Path(config.config_file_path).parent

    def rewrite_link(match):
        target = match.group(1)
        if target.startswith("docs/"):
            target = target[len("docs/"):]
        else:
            name, separator, anchor = target.partition("#")
            target = PAGES.get(name, name) + separator + anchor
        return "](" + target + ")"

    for source, destination in PAGES.items():
        content = (root / source).read_text(encoding="utf-8-sig")
        content = re.sub(r"\]\(([^)]+)\)", rewrite_link, content)
        files.append(File.generated(config, destination, content=content))
    return files
