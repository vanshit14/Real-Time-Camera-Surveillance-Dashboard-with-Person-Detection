from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.document import Document as DocumentType
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(parent: DocumentType):
    for child in parent.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def escape_cell(text: str) -> str:
    return " ".join(text.split()).replace("|", "\\|")


def paragraph_to_markdown(paragraph: Paragraph) -> list[str]:
    text = paragraph.text.strip()
    if not text:
        return []

    style = paragraph.style.name if paragraph.style is not None else ""
    if style.startswith("Heading 1") or style == "Title":
        return [f"# {text}", ""]
    if style.startswith("Heading 2"):
        return [f"## {text}", ""]
    if style.startswith("Heading 3"):
        return [f"### {text}", ""]
    if style in {"List Bullet", "List Paragraph"}:
        return [f"- {text}"]
    if style == "List Number":
        return [f"1. {text}"]
    if style == "Code":
        return ["```text", text, "```", ""]
    return [text, ""]


def table_to_markdown(table: Table) -> list[str]:
    rows = [[escape_cell(cell.text) for cell in row.cells] for row in table.rows]
    if not rows:
        return []

    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    header = normalized[0]
    output = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for row in normalized[1:]:
        output.append("| " + " | ".join(row) + " |")
    output.append("")
    return output


def convert(docx_path: Path, md_path: Path) -> None:
    doc = Document(docx_path)
    lines: list[str] = []
    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            lines.extend(paragraph_to_markdown(block))
        else:
            lines.extend(table_to_markdown(block))

    md_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: docx_to_markdown.py input.docx output.md", file=sys.stderr)
        return 2

    convert(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
