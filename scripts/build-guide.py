#!/usr/bin/env python3
"""Rebuild the six-page v2 handoff PDF from reviewed release facts.

Install: python3 -m pip install -r docs/requirements-guide.txt
Build:   python3 scripts/build-guide.py --docker-smoke passed
The PDF records verification evidence; this script does not execute those tests.
Use --docker-smoke passed only after recording a successful fresh-stack smoke.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Flowable, Image, PageBreak, Paragraph, SimpleDocTemplate,
    Spacer, Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
REPO = "https://github.com/atifmahmoodai/axiom-enterprise-ai-template"
BRANCH = REPO + "/tree/feature/axiom-intelligence-os"
BG = colors.HexColor("#080C10")
SURFACE = colors.HexColor("#141C24")
TEXT = colors.HexColor("#EDF3F6")
MUTED = colors.HexColor("#B2C0CC")
MINT = colors.HexColor("#7EE2C5")
BLUE = colors.HexColor("#9CAFFF")
LINE = colors.HexColor("#32404D")
AMBER = colors.HexColor("#F2CB8D")
WIDTH, HEIGHT = A4
CONTENT = WIDTH - 84


def fonts():
    directory = Path("/usr/share/fonts/truetype/dejavu")
    if (directory / "DejaVuSans.ttf").exists():
        for name, file in [
            ("Axiom", "DejaVuSans.ttf"),
            ("AxiomBold", "DejaVuSans-Bold.ttf"),
            ("AxiomMono", "DejaVuSansMono.ttf"),
        ]:
            pdfmetrics.registerFont(TTFont(name, directory / file))
        pdfmetrics.registerFontFamily("Axiom", normal="Axiom", bold="AxiomBold")
        return "Axiom", "AxiomBold", "AxiomMono"
    return "Helvetica", "Helvetica-Bold", "Courier"


REGULAR, BOLD, MONO = fonts()
STYLES = {
    "body": ParagraphStyle("body", fontName=REGULAR, fontSize=10.2, leading=15,
                           textColor=TEXT, spaceAfter=10),
    "muted": ParagraphStyle("muted", fontName=REGULAR, fontSize=9.2, leading=13.5,
                            textColor=MUTED, spaceAfter=9),
    "eyebrow": ParagraphStyle("eyebrow", fontName=BOLD, fontSize=8.5, leading=12,
                              textColor=MINT, spaceAfter=12, tracking=1.3),
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=34, leading=39,
                            textColor=TEXT, spaceAfter=17),
    "h1": ParagraphStyle("h1", fontName=BOLD, fontSize=25, leading=30,
                         textColor=TEXT, spaceAfter=15),
    "h2": ParagraphStyle("h2", fontName=BOLD, fontSize=12, leading=17,
                         textColor=MINT, spaceBefore=10, spaceAfter=7),
    "table": ParagraphStyle("table", fontName=REGULAR, fontSize=9.1, leading=13,
                            textColor=TEXT),
    "label": ParagraphStyle("label", fontName=BOLD, fontSize=9.1, leading=13,
                            textColor=MINT),
    "code": ParagraphStyle("code", fontName=MONO, fontSize=8.4, leading=13,
                           textColor=TEXT, backColor=SURFACE, borderPadding=11,
                           spaceBefore=16, spaceAfter=18),
}


def p(text, style="body"):
    return Paragraph(text, STYLES[style])


def heading(number, title, subtitle):
    return [p(f"INTELLIGENCE OS  /  {number}", "eyebrow"), p(title, "h1"), p(subtitle, "muted")]


def table(rows, widths=(144, CONTENT - 144)):
    result = Table(
        [[p(a, "label"), p(b, "table")] for a, b in rows],
        colWidths=list(widths), hAlign="LEFT", spaceAfter=8,
    )
    result.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("LINEBELOW", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return result


def code(lines):
    return p("<br/>".join(escape(line).replace(" ", "&#160;") for line in lines), "code")


class Architecture(Flowable):
    def __init__(self):
        super().__init__()
        self.width, self.height = CONTENT, 173

    def draw(self):
        c = self.canv

        def box(x, y, w, title, detail):
            c.setFillColor(SURFACE)
            c.setStrokeColor(LINE)
            c.roundRect(x, y, w, 47, 6, fill=1, stroke=1)
            c.setFillColor(MINT)
            c.setFont(BOLD, 9)
            c.drawString(x + 10, y + 30, title)
            c.setFillColor(MUTED)
            c.setFont(REGULAR, 7.7)
            c.drawString(x + 10, y + 14, detail)

        def arrow(x1, y, x2):
            c.setStrokeColor(MINT)
            c.setLineWidth(1)
            c.line(x1, y, x2, y)
            c.line(x2 - 4, y + 3, x2, y)
            c.line(x2 - 4, y - 3, x2, y)

        box(0, 120, 130, "Browser", "Session + scoped UI")
        box(151, 120, 178, "Next.js server / APIs", "OIDC + membership checks")
        box(350, 120, CONTENT - 350, "PostgreSQL", "Forced RLS + versions")
        arrow(131, 144, 149)
        arrow(330, 144, 348)
        box(0, 58, 130, "Durable queue", "pg-boss internal jobs")
        box(151, 58, 178, "Worker + fixed Python", "Bounded parsing + statistics")
        box(350, 58, CONTENT - 350, "Artifacts", "Tenant-scoped files")
        arrow(131, 82, 149)
        arrow(330, 82, 348)
        c.setFillColor(MUTED)
        c.setFont(REGULAR, 8)
        c.drawString(0, 25, "Server-only providers: OpenAI planning / MSAL + Power BI token issuance")
        c.drawString(0, 9, "Provisioning identity is separate from the web, worker and analytical DB roles.")


def build(output: Path, screenshot: Path, docker_smoke: str):
    story = []
    story += [p("AXIOM  /  ENGINEERING + PRODUCT HANDOFF", "eyebrow"),
              p("Intelligence OS", "title"),
              p("A working analytics workspace.<br/>Every answer has a source.", "body"),
              p("Edition 2.0 · 23 October 2026 · Feature branch review package", "muted"),
              Spacer(1, 12)]
    pixel_width, pixel_height = ImageReader(str(screenshot)).getSize()
    image = Image(str(screenshot), width=CONTENT,
                  height=CONTENT * pixel_height / pixel_width)
    story += [image, Spacer(1, 16),
              table([
                  ("249,150 facts", "Three organizations, 36 months, seeded anomalies and independent calculation truth."),
                  ("32 benchmark cases", "Executed deterministic baseline. An incomplete weighted score is shown honestly; it is not a live LLM ranking."),
              ]), Spacer(1, 10),
              p("Next.js 15 · React 19 · TypeScript · PostgreSQL · Python · Power BI Embedded", "muted"),
              PageBreak()]

    story += heading("01", "Architecture that can be inspected", "The application preserves the original Axiom template and adds a persistent server-backed analytics workspace.")
    story += [Architecture(), Spacer(1, 10)]
    story += [p("The security boundary is on the server", "h2"),
              p("Authenticated requests resolve real workspace membership. PostgreSQL uses a non-owner runtime role, forced row-level security and transaction-local user/workspace context. A client workspace selector cannot grant access."),
              table([
                  ("Queries", "Catalog plans become parameterized SQL. An AST validator rejects writes, unsafe functions, extra statements and unapproved relations. Analytical execution uses a read-only role."),
                  ("Imports + jobs", "Generated storage identifiers, bounded parsing, immutable versions and a durable queue. Job execution rechecks membership and supports cancellation."),
                  ("Provider secrets", "OpenAI and Microsoft credentials stay server-side. Only a scoped, short-lived Power BI embed configuration reaches the browser."),
                  ("Exports", "CSV requests reauthorize the user and audit snapshot metadata. Power BI artifacts require their creator and an unchanged server-derived report/RLS identity scope."),
              ]),
              p("Deployment boundary", "h2"),
              p("Docker runs web and worker as non-root processes alongside PostgreSQL and optional local Keycloak. Shared-volume artifacts make this a single-host reference deployment; scale-out needs an object-store adapter, production identity and operational backups.", "muted"),
              PageBreak()]

    story += heading("02", "One workspace, connected journeys", "Use the persistent shell and command palette to move from a metric to its evidence, then save a reproducible view.")
    story += [table([
        ("Executive overview", "Filter dates, plan and region; compare periods; inspect definitions; switch between chart and table; save views and export the displayed snapshot."),
        ("Data workbench", "Import CSV, XLSX, JSON or Parquet. Inspect schema and quality issues, preview corrections, then publish a new immutable version."),
        ("AI Analyst", "Ask a question against an authorized source. Inspect calculated facts, query, filters, version and limitations. Follow-ups preserve context; ambiguous requests trigger clarification."),
        ("Analysis Lab", "Cohorts, observed funnels, contribution, robust anomaly detection, forecast backtests/intervals, comparisons and editable scenarios use deterministic calculations."),
        ("Catalog + lineage", "Trace metric definitions and dataset transformations to analyses and dashboards. Inspect exact versions and explicit unavailable dependencies."),
        ("Evaluation center", "Run known-answer cases and inspect correctness, provenance, safety, uncertainty and resource evidence. Compare stored model/prompt runs without fabricating missing scores."),
        ("Power BI + governance", "Open approved reports, inspect refresh status and export options; review saved work, jobs, audit events and analyst/viewer/admin/owner roles."),
    ])]
    story += [p("Suggested first session", "h2"),
              p("Filter the Executive overview → inspect a definition → import a small CSV → preview and publish a correction → ask for an aggregate → inspect its query and source version → save the analysis → run the evaluation baseline."),
              p("The interface distinguishes missing, zero, partial and stale results. Automated checks cover keyboard navigation and representative responsive layouts; manual accessibility review remains necessary.", "muted"),
              PageBreak()]

    story += heading("03", "Demo and connected data", "Mode selection is explicit. A failed live service never silently becomes a successful sample response.")
    story += [table([
        ("Demo", "Seeded SaaS facts and a labeled deterministic question planner. Database permissions, jobs, ingestion and numerical calculations are real. Power BI is a local preview."),
        ("Connected", "Verified identity and configured providers. Operational dashboards use a reviewed canonical snapshot; uploaded datasets remain a separate analysis source. Missing configuration produces a clear error."),
    ]), p("Publish a canonical operational snapshot", "h2"),
              code(["npm run facts:import -- WORKSPACE_ID VERIFIED_ACTOR_ID", "  /secure/path/snapshot.json"]),
              p("The command is one line; the wrap above is for readability. Run it in an isolated operator environment with the migration credential. The actor must already be an administrator or owner of the target workspace."),
              table([
                  ("Four fact grains", "Invoices: amount_cents. Infrastructure: cost_cents. Usage: integer tokens. Subscriptions: one customer snapshot per month, on the final UTC calendar day."),
                  ("Explicit contracts", "USD integer cents, UTC dates and token units. Fixed plan/region mappings; no implicit FX or unit conversion. Include explicit zero-MRR snapshots for known churn."),
                  ("Versions + freshness", "Sorted normalized content creates a SHA-256 version. Publication and activation are atomic; old versions remain available. Upstream refresh time and interval determine stale status."),
                  ("Bounds", "Canonical JSON: 50 MiB / 250,000 facts. Uploaded tables: 50 MiB file limit and decoded row/column limits. Query time, result size and subprocess resources are bounded."),
              ]),
              p("Vendor extraction and business mapping remain your upstream pipeline's responsibility. Source coverage is declared and reviewed by the operator; schema validation cannot establish upstream completeness. See docs/DATA-SOURCES.md for a complete JSON example and recovery steps.", "muted"),
              PageBreak()]

    story += heading("04", "Connect Power BI deliberately", "App-owns-data integration is implemented with the Microsoft SDK and server-issued embed tokens. Live Microsoft verification still needs your tenant and capacity.")
    story += [table([
        ("1 · Provision identity", "Register an Entra application/service principal. Restrict the Power BI tenant setting to an approved security group and grant the required workspace/profile access."),
        ("2 · Assign capacity", "Use eligible production A/F capacity or a supported existing EM/P arrangement. PPU alone is insufficient for production app-owns-data embedding and exportToFile."),
        ("3 · Build the model", "Use the four fact tables and Date/Customer/Plan/Region dimensions. Configure single-direction dimension-to-fact relationships, explicit DAX measures and a verified dynamic RLS role."),
        ("4 · Map each tenant", "Use a separate Power BI workspace/profile per Axiom organization. Install approved report/model IDs and application-user effective identities with the operator mapping command."),
        ("5 · Validate access", "Test restricted and unrestricted identities, cross-tenant denial, revoked access, token renewal, report errors, filter synchronization and inactive-tab recovery."),
    ]),
              code(["npm run powerbi:export -- atlas", "npm run powerbi:configure -- atlas .runtime/atlas-powerbi.json"]),
              p("What is supplied", "h2"),
              p("A server adapter, SDK viewer, page/bookmark/filter controls, renewal, queued exports and refresh submission/history; sample table exporter, relationship instructions and DAX catalog. No generated or validated PBIX/PBIP artifact is claimed."),
              p("What remains live-only", "h2"),
              p("Actual Microsoft authentication, capacity eligibility, semantic-model RLS, embed interactions, export contents and refresh completion remain unverified. Refresh submission is not completion. Check gateway credentials, tenant settings and licensing before enabling those actions.", "muted"),
              p("Detailed setup and current official Microsoft reference links: docs/POWER-BI.md. Never use Publish to web for private business data.", "muted"),
              PageBreak()]

    smoke = ("Fresh reference-stack runtime smoke also passed."
             if docker_smoke == "passed"
             else "Pending: fresh reference-stack runtime smoke is not yet verified.")
    story += heading("05", "Run it. Verify it. Connect it.", "Local reference evidence recorded on 23 October 2026. The repository documentation remains the detailed engineering source of truth.")
    story += [code(["npm ci", "npm run setup", "docker compose up --build -d"]),
              p("Open http://localhost:3000/login/. Setup generates ignored local credentials. Initialization applies migrations and seeds the reference workspaces. Local demo sign-in and Keycloak start-dev are development facilities.", "body"),
              table([
                  ("Domain + parsers", "23 unit tests passed; 8 Python analytical tests passed."),
                  ("Persistent integration", "21 integration tests passed, including the 32-case deterministic benchmark baseline. Missing model-cost evidence keeps the weighted benchmark score incomplete."),
                  ("Browser journeys", "5 production-browser tests passed. Eight workspace routes had no detected axe A/AA violations; tested widths were 320, 1440 and 3840 CSS pixels."),
                  ("Build + packaging", "Typecheck, production build and Docker image builds passed. " + smoke),
                  ("External services", "Local Keycloak OIDC was exercised. Live OpenAI model evaluation and live Power BI checks remain unverified without configured services."),
              ]),
              p("Reproduce the checks", "h2"),
              code(["npm run typecheck && npm test", ".venv/bin/python python/test_analytics.py", "npm run test:integration", "npm run build && npm run start", "# Another terminal; worker + database must also run:", "npm run test:e2e"]),
              p("These results do not establish WCAG certification, production capacity or sub-500 ms loading. See docs/VALIDATION.md, docs/PERFORMANCE.md and docs/FEATURE-STATUS.md for exact scope and remaining work.", "muted"),
              p(f'<link href="{BRANCH}" color="#7EE2C5">Open the feature branch and full engineering handoff</link>', "muted")]

    def page_background(c, doc):
        c.saveState()
        c.setFillColor(BG)
        c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
        c.setStrokeColor(MINT)
        c.setLineWidth(2)
        c.line(42, HEIGHT - 29, 84, HEIGHT - 29)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(42, 39, WIDTH - 42, 39)
        c.setFillColor(MUTED)
        c.setFont(REGULAR, 7.4)
        c.drawString(42, 25, "AXIOM INTELLIGENCE OS  /  V2 ENGINEERING HANDOFF")
        c.drawRightString(WIDTH - 42, 25, f"23 OCT 2026   /   {doc.page}")
        c.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=42, rightMargin=42,
                            topMargin=49, bottomMargin=53,
                            title="Axiom Intelligence OS — Product and Engineering Guide v2",
                            author="Axiom Intelligence OS", subject="Reviewable architecture, setup and verification handoff")
    def stable_canvas(*args, **kwargs):
        kwargs["invariant"] = 1
        return canvas.Canvas(*args, **kwargs)

    doc.build(story, onFirstPage=page_background, onLaterPages=page_background,
              canvasmaker=stable_canvas)
    print(f"Wrote {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "docs/axiom-intelligence-os-guide.pdf")
    parser.add_argument("--screenshot", type=Path, default=ROOT / "docs/assets/intelligence-os.png")
    parser.add_argument("--docker-smoke", choices=["pending", "passed"], default="pending")
    arguments = parser.parse_args()
    build(arguments.output.resolve(), arguments.screenshot.resolve(), arguments.docker_smoke)
