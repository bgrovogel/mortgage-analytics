"""Draws the documentation's diagrams and charts as SVG files in docs/images/.

Every image shares one look (the app's own colours, on a white card that reads in light and dark themes), and
every chart is computed here, in Decimal, from the reference loans in docs/06-mortgage-math.md. The script checks
its numbers against the ones the docs quote before it draws anything, so a chart cannot quietly disagree with
the text beside it.

    python tools/diagrams/make_diagrams.py
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, getcontext
from html import escape
from pathlib import Path

getcontext().prec = 40

OUT = Path(__file__).resolve().parents[2] / "docs" / "images"

# ---------------------------------------------------------------------------------------------------------------
# The app's palette (client/src/styles.scss, light theme)
# ---------------------------------------------------------------------------------------------------------------

INK = "#101828"
INK_2 = "#475467"
INK_3 = "#667085"
BORDER = "#e4e7ec"
BORDER_STRONG = "#d0d5dd"
GRID = "#f2f4f7"
SURFACE = "#ffffff"
SURFACE_2 = "#f8fafc"
ACCENT = "#2563eb"
ACCENT_DARK = "#1d4ed8"
ACCENT_SOFT = "#eef4ff"
ACCENT_BORDER = "#c7d7fe"
POSITIVE = "#067647"
POSITIVE_SOFT = "#ecfdf3"
POSITIVE_BORDER = "#abefc6"
WARNING = "#b54708"
WARNING_TEXT = "#93370d"
WARNING_SOFT = "#fffaeb"
WARNING_BORDER = "#f5b83d"
VIOLET = "#7a5af8"
VIOLET_SOFT = "#f4f3ff"
VIOLET_BORDER = "#d9d6fe"

SANS = "'Segoe UI', Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
MONO = "'Cascadia Code', Consolas, 'SF Mono', Menlo, monospace"

KINDS = {
    "accent": (ACCENT_SOFT, ACCENT_BORDER, ACCENT_DARK),
    "neutral": (SURFACE_2, BORDER_STRONG, INK),
    "positive": (POSITIVE_SOFT, POSITIVE_BORDER, POSITIVE),
    "warning": (WARNING_SOFT, WARNING_BORDER, WARNING_TEXT),
    "violet": (VIOLET_SOFT, VIOLET_BORDER, "#5925dc"),
    "plain": (SURFACE, BORDER_STRONG, INK),
}


def text_width(s: str, size: float, weight: int = 400, mono: bool = False) -> float:
    """A close-enough estimate of rendered width, for laying out boxes and labels."""
    if mono:
        return len(s) * size * 0.6
    w = 0.0
    for ch in s:
        if ch in "il.,:;'|!·()[]/":
            w += 0.3
        elif ch == " ":
            w += 0.28
        elif ch in "mwMW":
            w += 0.86
        elif ch.isupper():
            w += 0.64
        elif ch.isdigit() or ch in "$%":
            w += 0.56
        else:
            w += 0.52
    return w * size * (1.06 if weight >= 600 else 1.0)


class Svg:
    def __init__(self, width: int, height: int, title: str, desc: str):
        self.w, self.h, self.title, self.desc = width, height, title, desc
        self.body: list[str] = []
        self.markers: set[str] = set()

    # -- primitives ---------------------------------------------------------------------------------------------

    def rect(self, x, y, w, h, fill=SURFACE, stroke=BORDER, rx=10, sw=1.0, dash=None, opacity=None):
        extra = f' stroke-dasharray="{dash}"' if dash else ""
        extra += f' fill-opacity="{opacity}"' if opacity is not None else ""
        self.body.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{sw}"{extra}/>'
        )

    def text(self, x, y, s, size=13, weight=400, fill=INK, anchor="start", mono=False, italic=False):
        family = MONO if mono else SANS
        style = ' font-style="italic"' if italic else ""
        self.body.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}"{style}>{escape(s)}</text>'
        )

    def line(self, x1, y1, x2, y2, stroke=BORDER, sw=1.0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.body.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}"{d}/>'
        )

    def path(self, d, stroke="none", fill="none", sw=1.5, dash=None, opacity=None, join="round"):
        extra = f' stroke-dasharray="{dash}"' if dash else ""
        extra += f' fill-opacity="{opacity}"' if opacity is not None else ""
        self.body.append(
            f'<path d="{d}" stroke="{stroke}" fill="{fill}" stroke-width="{sw}" stroke-linejoin="{join}" '
            f'stroke-linecap="round"{extra}/>'
        )

    def circle(self, cx, cy, r, fill=ACCENT, stroke="none", sw=0):
        self.body.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def arrow(self, points, color=INK_3, sw=1.5, dash=None, label=None, label_at=None, label_side="above"):
        """A polyline from the first point to the last, with an arrowhead."""
        key = color.lstrip("#")
        self.markers.add(color)
        d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)
        extra = f' stroke-dasharray="{dash}"' if dash else ""
        self.body.append(
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round"{extra} '
            f'marker-end="url(#arrow-{key})"/>'
        )
        if label:
            (x1, y1), (x2, y2) = label_at or (points[0], points[1])
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            self.pill_label(mx, my - 8 if label_side == "above" else my + 16, label)

    def pill_label(self, cx, cy, s, size=11, fill=INK_2):
        w = text_width(s, size) + 12
        self.rect(cx - w / 2, cy - size - 2, w, size + 8, fill=SURFACE, stroke=SURFACE, rx=4)
        self.text(cx, cy, s, size=size, fill=fill, anchor="middle")

    # -- components ---------------------------------------------------------------------------------------------

    def card(self, heading: str | None = None, sub: str | None = None):
        self.rect(0.5, 0.5, self.w - 1, self.h - 1, fill=SURFACE, stroke=BORDER, rx=16)
        if heading:
            self.text(28, 38, heading, size=17, weight=650, fill=INK)
        if sub:
            self.text(28, 60, sub, size=12.5, fill=INK_2)

    def box(self, x, y, w, h, kind, title, lines=(), mono=None, tag=None, dashed=False, title_size=14):
        fill, stroke, title_color = KINDS[kind]
        self.rect(x, y, w, h, fill=fill, stroke=stroke, rx=12, sw=1.2, dash="5 4" if dashed else None)
        ty = y + 26
        self.text(x + 16, ty, title, size=title_size, weight=650, fill=title_color)
        if tag:
            tw = text_width(tag, 10.5, 600) + 14
            self.rect(x + w - tw - 10, y + 11, tw, 19, fill=SURFACE, stroke=stroke, rx=9.5)
            self.text(x + w - tw / 2 - 10, y + 24.5, tag, size=10.5, weight=600, fill=title_color, anchor="middle")
        for i, s in enumerate(lines):
            self.text(x + 16, ty + 21 + i * 18, s, size=12.5, fill=INK_2)
        if mono:
            self.text(x + 16, y + h - 14, mono, size=11, fill=INK_3, mono=True)

    def badge(self, cx, cy, n, color=ACCENT):
        self.circle(cx, cy, 12, fill=color)
        self.text(cx, cy + 4.5, str(n), size=12, weight=700, fill=SURFACE, anchor="middle")

    def legend(self, x, y, items):
        for color, label, style in items:
            if style == "area":
                self.rect(x, y - 9, 14, 10, fill=color, stroke=color, rx=2, opacity=0.35)
            else:
                self.line(x, y - 4, x + 18, y - 4, stroke=color, sw=2.5, dash="5 4" if style == "dash" else None)
            self.text(x + 24, y, label, size=12, fill=INK_2)
            x += 24 + text_width(label, 12) + 22

    # -- output -------------------------------------------------------------------------------------------------

    def save(self, name: str):
        defs = "".join(
            f'<marker id="arrow-{c.lstrip("#")}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{c}"/></marker>'
            for c in sorted(self.markers)
        )
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" '
            f'height="{self.h}" role="img" aria-labelledby="title desc">\n'
            f"<title id=\"title\">{escape(self.title)}</title>\n<desc id=\"desc\">{escape(self.desc)}</desc>\n"
            f"<!-- Generated by tools/diagrams/make_diagrams.py; edit that script, not this file. -->\n"
            f"<defs>{defs}</defs>\n" + "\n".join(self.body) + "\n</svg>\n"
        )
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / name).write_text(svg, encoding="utf-8", newline="\n")
        print(f"docs/images/{name}")


class Chart:
    """A plot area inside an Svg: linear scales, grid, axes and series."""

    def __init__(self, svg: Svg, x, y, w, h, xmin, xmax, ymin, ymax):
        self.s, self.x, self.y, self.w, self.h = svg, x, y, w, h
        self.xmin, self.xmax, self.ymin, self.ymax = xmin, xmax, ymin, ymax

    def px(self, v):
        return self.x + (float(v) - self.xmin) / (self.xmax - self.xmin) * self.w

    def py(self, v):
        return self.y + self.h - (float(v) - self.ymin) / (self.ymax - self.ymin) * self.h

    def grid(self, yticks, ylabel, xticks, xlabel):
        for v in yticks:
            self.s.line(self.x, self.py(v), self.x + self.w, self.py(v), stroke=GRID if v != self.ymin else BORDER_STRONG)
            self.s.text(self.x - 8, self.py(v) + 4, ylabel(v), size=11, fill=INK_3, anchor="end")
        for v in xticks:
            self.s.line(self.px(v), self.y + self.h, self.px(v), self.y + self.h + 4, stroke=BORDER_STRONG)
            self.s.text(self.px(v), self.y + self.h + 18, xlabel(v), size=11, fill=INK_3, anchor="middle")

    def series(self, pts, color, sw=2.5, dash=None, step=False):
        d, prev = [], None
        for i, (vx, vy) in enumerate(pts):
            X, Y = self.px(vx), self.py(vy)
            if i == 0:
                d.append(f"M {X:.1f} {Y:.1f}")
            elif step:
                d.append(f"H {X:.1f} V {Y:.1f}")
            else:
                d.append(f"L {X:.1f} {Y:.1f}")
            prev = (X, Y)
        self.s.path(" ".join(d), stroke=color, sw=sw, dash=dash)
        return prev

    def area(self, upper, lower, color, opacity=0.18):
        top = " L ".join(f"{self.px(a):.1f} {self.py(b):.1f}" for a, b in upper)
        bottom = " L ".join(f"{self.px(a):.1f} {self.py(b):.1f}" for a, b in reversed(lower))
        self.s.path(f"M {top} L {bottom} Z", fill=color, opacity=opacity)

    def dot(self, vx, vy, color):
        self.s.circle(self.px(vx), self.py(vy), 4.5, fill=SURFACE, stroke=color, sw=2.5)

    def note(self, vx, vy, lines, dx=10, dy=-10, anchor="start", color=INK, bold_first=True):
        X, Y = self.px(vx) + dx, self.py(vy) + dy
        for i, s in enumerate(lines):
            self.s.text(X, Y + i * 16, s, size=12.5 if i == 0 else 11.5, weight=650 if (i == 0 and bold_first) else 400,
                        fill=color if i == 0 else INK_2, anchor=anchor)


# ---------------------------------------------------------------------------------------------------------------
# The money math, in Decimal (the same rules as the engine; see docs/06-mortgage-math.md)
# ---------------------------------------------------------------------------------------------------------------

CENT = Decimal("0.01")


def money(v: Decimal) -> Decimal:
    return v.quantize(CENT, rounding=ROUND_HALF_UP)


def payment(principal: Decimal, annual_rate: Decimal, n: int) -> Decimal:
    if annual_rate == 0:
        return money(principal / n)
    r = annual_rate / 1200
    f = (1 + r) ** n
    return money(principal * r * f / (f - 1))


def amortize(principal, annual_rate, n, extra=Decimal(0), rate_at=None):
    """Rows of (number, interest, principal, extra, closing balance), as AmortizationCalculator builds them."""
    rate = Decimal(annual_rate)
    pay = payment(Decimal(principal), rate, n)
    bal, rows = Decimal(principal), []
    for k in range(1, n + 1):
        if bal <= 0:
            break
        r = Decimal(rate_at(k)) if rate_at else rate
        if r != rate:
            rate, pay = r, payment(bal, r, n - k + 1)
        interest = money(bal * rate / 1200)
        princ = bal if k == n else min(pay - interest, bal)
        bal -= princ
        ext = min(extra, bal)
        bal -= ext
        rows.append((k, interest, princ, ext, bal, pay))
    return rows


def expect(actual, wanted, what):
    if actual != wanted:
        raise SystemExit(f"{what}: computed {actual}, but the docs say {wanted}")


def usd(v, cents=False) -> str:
    v = float(v)
    return f"${v:,.2f}" if cents else f"${v:,.0f}"


def usd_k(v) -> str:
    v = float(v)
    return "$0" if v == 0 else f"${v / 1000:,.0f}k"


# ---------------------------------------------------------------------------------------------------------------
# Diagrams
# ---------------------------------------------------------------------------------------------------------------


def architecture():
    s = Svg(960, 428, "Mortgage Analytics architecture",
            "The Angular app calls one ASP.NET Core process. Inside it, Api calls Application, which calls Domain; "
            "Infrastructure implements Application's repository port and stores data in SQLite, or PostgreSQL. "
            "Dependencies point inward, and Domain depends on nothing.")
    s.card("The shape of the system", "Clean Architecture in four .NET projects, plus the Angular app, shipped as one container")

    s.box(28, 96, 196, 200, "plain", "Browser", ["Angular 22 single-page app", "", "pages · forms", "stores (signals)",
                                                 "API services"], tag="client/")
    s.rect(256, 82, 676, 320, fill=SURFACE_2, stroke=BORDER_STRONG, rx=14, dash="6 5")
    s.text(276, 106, "One ASP.NET Core process", size=12.5, weight=650, fill=INK_2)
    s.text(912, 106, "one port · no CORS", size=11.5, fill=INK_3, anchor="end")

    s.box(276, 124, 196, 132, "neutral", "Api", ["endpoints · filters", "errors · accounts · email", "serves the SPA"],
          mono="Api/")
    s.box(500, 124, 196, 132, "neutral", "Application", ["contracts · validators", "mapping · services",
                                                         "the repository port"], mono="Application/")
    s.box(724, 124, 188, 132, "accent", "Domain", ["the money math", "loans · costs · strategies", "pure C#"],
          tag="no dependencies", mono="Domain/")
    s.box(500, 284, 196, 100, "neutral", "Infrastructure", ["EF Core · migrations", "the repository"],
          mono="Infrastructure/")
    # SQLite as a cylinder
    cx, top, w, hgt = 374, 296, 120, 64
    s.path(f"M {cx - w/2} {top} v {hgt} a {w/2} 9 0 0 0 {w} 0 v {-hgt}", stroke=BORDER_STRONG, fill=SURFACE, sw=1.2)
    s.path(f"M {cx - w/2} {top} a {w/2} 9 0 0 0 {w} 0 a {w/2} 9 0 0 0 {-w} 0", stroke=BORDER_STRONG, fill=SURFACE_2, sw=1.2)
    s.text(cx, top + 36, "SQLite", size=13.5, weight=650, anchor="middle")
    s.text(cx, top + 54, "or PostgreSQL", size=11.5, fill=INK_2, anchor="middle")

    s.arrow([(224, 190), (274, 190)], color=ACCENT, sw=2)
    s.pill_label(249, 176, "HTTP")
    s.arrow([(472, 190), (498, 190)], sw=2)
    s.arrow([(696, 190), (722, 190)], sw=2)
    s.arrow([(598, 284), (598, 258)], sw=2, dash="5 4")
    s.text(608, 274, "implements the port", size=11, fill=INK_2)
    s.arrow([(500, 330), (436, 330)], sw=1.5)

    s.text(28, 330, "Dependencies point inward:", size=12, weight=650, fill=INK)
    s.text(28, 348, "Domain knows nothing about", size=12, fill=INK_2)
    s.text(28, 366, "HTTP or the database.", size=12, fill=INK_2)
    s.save("architecture.svg")


def request_flow():
    s = Svg(960, 470, "One request, end to end",
            "Changing the interest rate: the form checks it, the store waits for a pause and sends it, the API "
            "validates it, the use case maps it, the domain computes the schedules, and the response updates every "
            "view that reads the result signal.")
    s.card("One request, end to end", "A user changes the rate from 6.5% to 7%. Seven steps, each in one place in the code.")

    s.rect(20, 80, 920, 160, fill=SURFACE_2, stroke=BORDER, rx=12)
    s.text(36, 102, "BROWSER  ·  Angular", size=11, weight=700, fill=INK_3)
    s.rect(20, 262, 920, 160, fill=SURFACE_2, stroke=BORDER, rx=12)
    s.text(36, 284, "SERVER  ·  ASP.NET Core", size=11, weight=700, fill=INK_3)

    top = [
        (1, "The form checks it", ["rules table, 0–30%", "builds the request"], "loan-form.component.ts"),
        (2, "The page hands it on", ["a container: form", "to store, no HTTP"], "calculator-page"),
        (3, "The store waits, sends", ["debounce 400 ms", "switchMap cancels old"], "latest-request.ts"),
    ]
    bottom = [
        (4, "The API validates", ["ValidationFilter<T>", "400 if anything is wrong"], "ValidationFilter.cs"),
        (5, "The use case maps", ["request → domain", "objects, guarded"], "AmortizationService.cs"),
        (6, "The domain computes", ["two schedules, the", "costs, the savings"], "LoanComparer.cs"),
    ]
    xs = [40, 268, 496]
    for (n, title, lines, f), x in zip(top, xs):
        s.box(x, 116, 204, 108, "plain", title, lines, mono=f, title_size=13.5)
        s.badge(x + 204 - 18, 116 + 20, n)
    for (n, title, lines, f), x in zip(bottom, [496, 268, 40]):
        s.box(x, 298, 204, 108, "plain", title, lines, mono=f, title_size=13.5)
        s.badge(x + 204 - 18, 298 + 20, n)
    s.box(724, 116, 200, 108, "positive", "The views update", ["signals: Overview,", "Projection, Schedule"],
          mono="OnPush, no polling", title_size=13.5)
    s.badge(724 + 200 - 18, 136, 7, color=POSITIVE)

    for x in (244, 472):
        s.arrow([(x, 170), (x + 22, 170)], sw=2)
    s.arrow([(700, 170), (720, 170), (720, 250), (598, 250), (598, 296)], color=ACCENT, sw=2)
    s.pill_label(660, 255, "POST /api/v1/amortization/calculate", size=10.5, fill=ACCENT_DARK)
    s.arrow([(494, 352), (474, 352)], sw=2)
    s.arrow([(266, 352), (246, 352)], sw=2)
    s.arrow([(142, 406), (142, 440), (900, 440), (900, 226)], color=POSITIVE, sw=2)
    s.pill_label(520, 444, "200 OK · AmortizationResponse → the result signal", size=10.5, fill=POSITIVE)
    s.save("request-flow.svg")


def ci_pipeline():
    s = Svg(960, 470, "The CI pipeline",
            "On every push and pull request, four jobs start at once: backend, frontend, docs and mutation. "
            "The Docker job runs once backend passes; end-to-end tests run once backend and frontend pass.")
    s.card("The CI pipeline", "Six jobs on every push to main and every pull request (.github/workflows/ci.yml)")

    s.rect(28, 238, 120, 56, fill=INK, stroke=INK, rx=28)
    s.text(88, 262, "push or", size=12.5, weight=600, fill=SURFACE, anchor="middle")
    s.text(88, 280, "pull request", size=12.5, weight=600, fill=SURFACE, anchor="middle")

    jobs = [
        (88, "backend", ["build (warnings are errors), audit", "tests, coverage ≥ 85%"]),
        (184, "frontend", ["npm audit · lint · typecheck", "Jest, coverage ≥ 85%"]),
        (280, "docs", ["every test count in the", "README and docs/ matches"]),
        (376, "mutation", ["Stryker.NET on the domain", "mutation score ≥ 95%"]),
    ]
    for y, name, lines in jobs:
        s.box(240, y, 260, 84, "neutral", name, lines, title_size=13.5)
        s.arrow([(148, 266), (196, 266), (196, y + 42), (238, y + 42)], sw=1.5)
    s.box(620, 88, 312, 84, "accent", "docker", ["build and run the image: /health is", "Healthy, the calculator answers"],
          tag="needs backend", title_size=13.5)
    s.box(620, 196, 312, 100, "accent", "e2e", ["Playwright on the production build,", "served by the API, under its CSP,",
                                               "with the axe accessibility scans"], tag="needs backend + frontend",
          title_size=13.5)
    s.arrow([(500, 118), (618, 118)], color=ACCENT, sw=2)
    s.arrow([(500, 150), (560, 150), (560, 246), (618, 246)], color=ACCENT, sw=2)
    s.path("M 500 226 L 560 226", stroke=ACCENT, sw=2)
    s.text(620, 340, "Every job must pass for a green tick.", size=12.5, weight=650, fill=INK)
    s.text(620, 360, "Coverage, mutation and Playwright reports are", size=12, fill=INK_2)
    s.text(620, 378, "uploaded as artifacts.", size=12, fill=INK_2)
    s.save("ci-pipeline.svg")


def tech_stack():
    s = Svg(960, 452, "The tech stack",
            "Frontend: Angular 22, TypeScript 6.0, signals, RxJS 7.8, SVG charts, Instrument Sans. Backend: ASP.NET Core 10 "
            "minimal APIs, FluentValidation 12, Identity, Fido2 4, MailKit 4, Swashbuckle 10. Data: EF Core 10 and SQLite or PostgreSQL. "
            "Quality: NUnit 5, NSubstitute 6, Jest 30, Playwright 1.64, axe-core, Stryker.NET 5.0 and Python "
            "Decimal models. Delivery: Docker, docker compose with Mailpit, GitHub Actions.")
    s.card("The tech stack", "What each layer is built with. Versions as pinned in the repository.")
    rows = [
        ("Frontend", "accent", ["Angular 22", "TypeScript 6.0", "Signals", "RxJS 7.8", "SVG charts", "Instrument Sans", "SCSS"]),
        ("Backend", "neutral", [".NET 10 / C#", "Minimal APIs", "FluentValidation 12", "Identity", "Fido2 4",
                                "MailKit 4", "Swashbuckle 10"]),
        ("Data", "neutral", ["EF Core 10", "SQLite or PostgreSQL", "JSON columns", "Migrations at startup"]),
        ("Quality", "positive", ["NUnit 5", "NSubstitute 6", "Jest 30", "Playwright 1.64", "axe-core", "Stryker.NET 5.0",
                                 "Python models"]),
        ("Delivery", "violet", ["Docker (3 stages)", "docker compose + Mailpit", "GitHub Actions", "dotnet-ef"]),
    ]
    y = 86
    for label, kind, chips in rows:
        fill, stroke, color = KINDS[kind]
        s.rect(28, y, 904, 62, fill=SURFACE_2, stroke=BORDER, rx=12)
        s.rect(28, y, 6, 62, fill=color, stroke=color, rx=3)
        s.text(50, y + 37, label, size=14, weight=650, fill=INK)
        x = 150
        for chip in chips:
            w = text_width(chip, 12.5, 600) + 22
            if x + w > 920:
                raise SystemExit(f"tech-stack: the {label} row does not fit; shorten a chip")
            s.rect(x, y + 16, w, 30, fill=fill, stroke=stroke, rx=15)
            s.text(x + w / 2, y + 36, chip, size=12.5, weight=600, fill=color, anchor="middle")
            x += w + 7
        y += 72
    s.save("tech-stack.svg")


def amortization_engine():
    s = Svg(960, 520, "The amortization engine",
            "AmortizationService depends on ILoanComparer and TimeProvider. LoanComparer depends on "
            "IAmortizationCalculator and applies a HousingCostPlan. The calculator asks an ExtraPaymentPlan for each "
            "month's extra payment; the plan sums any number of IExtraPaymentRule implementations. HousingCostPlan "
            "sums any number of IHousingCost implementations.")
    s.card("The amortization engine", "One section of the code, used to explain all five SOLID principles. "
                                      "Dashed boxes are interfaces.")

    def iface(x, y, w, h, name, lines=(), mono=None):
        s.box(x, y, w, h, "plain", name, lines, mono=mono, dashed=True, tag="interface", title_size=13.5)

    s.box(28, 88, 300, 76, "neutral", "AmortizationService", ["maps a request in, a response out"],
          mono="Application/Services", title_size=13.5)
    iface(370, 88, 250, 76, "ILoanComparer", ["Compare(loan, extras, …)"])
    s.box(662, 88, 270, 76, "neutral", "TimeProvider", ["“today”, injected"], mono="System", title_size=13.5)
    s.box(370, 196, 250, 76, "neutral", "LoanComparer", ["runs the loan twice"], mono="Domain/Amortization",
          title_size=13.5)
    iface(28, 196, 300, 76, "IAmortizationCalculator", ["Generate(loan, extras, recast)"])
    s.box(28, 304, 300, 76, "accent", "AmortizationCalculator", ["one schedule, month by month"],
          mono="Domain/Amortization", title_size=13.5)
    s.box(28, 412, 300, 82, "neutral", "ExtraPaymentPlan", ["AmountFor(n) · LargestSinglePaymentFor(n)"],
          mono="Domain/ExtraPayments", title_size=13.5)
    s.box(662, 196, 270, 76, "neutral", "HousingCostPlan", ["ApplyTo(schedule)"], mono="Domain/HousingCosts",
          title_size=13.5)

    iface(370, 304, 250, 190, "IExtraPaymentRule", ["AmountFor(paymentNumber)"])
    for i, name in enumerate(["MonthlyExtraPayment", "AnnualExtraPayment", "LumpSumExtraPayment"]):
        s.rect(386, 372 + i * 38, 218, 30, fill=SURFACE_2, stroke=BORDER_STRONG, rx=8)
        s.text(398, 392 + i * 38, name, size=12, weight=600, fill=INK)
    iface(662, 304, 270, 190, "IHousingCost", ["Category · AmountFor(period)"])
    for i, (name, what) in enumerate([("ValueBasedTax", "taxes"), ("AnnualFixedCost", "insurance, PID"),
                                      ("MonthlyFixedCost", "HOA dues"), ("MortgageInsurance", "PMI")]):
        s.rect(678, 358 + i * 33, 238, 27, fill=SURFACE_2, stroke=BORDER_STRONG, rx=8)
        s.text(690, 376 + i * 33, name, size=12, weight=600, fill=INK)
        s.text(904, 376 + i * 33, what, size=11, fill=INK_3, anchor="end")

    s.arrow([(328, 126), (368, 126)], sw=1.8)
    s.arrow([(328, 108), (350, 108), (350, 80), (797, 80), (797, 86)], sw=1.8)
    s.arrow([(495, 196), (495, 166)], color=INK_3, sw=1.6, dash="5 4")
    s.arrow([(370, 234), (330, 234)], sw=1.8)
    s.arrow([(620, 234), (660, 234)], sw=1.8)
    s.arrow([(178, 304), (178, 274)], color=INK_3, sw=1.6, dash="5 4")
    s.arrow([(178, 380), (178, 410)], sw=1.8)
    s.arrow([(328, 452), (368, 452)], sw=1.8)
    s.arrow([(797, 272), (797, 302)], sw=1.8)
    s.text(184, 398, "asks for each month's extra", size=11, fill=INK_2)
    s.text(342, 446, "sums", size=11, fill=INK_2, anchor="middle")
    s.text(803, 292, "sums", size=11, fill=INK_2)
    s.text(503, 186, "implements", size=11, fill=INK_2)
    s.text(186, 294, "implements", size=11, fill=INK_2)
    s.save("amortization-engine.svg")


def schema():
    s = Svg(960, 900, "The database schema",
            "SavedCalculations has Id, OwnerId, Name, a Note, four JSON columns (Inputs, OtherHomes, Refinance, Strategy: one kind "
            "per row, and a comparison of homes sets Inputs and OtherHomes), "
            "CreatedAt and UpdatedAt, with an index on OwnerId and UpdatedAt. OwnerId is a foreign key to AspNetUsers.Id "
            "with cascade delete. UserPreferences has OwnerId, KeyFigureOrder and KeyFiguresHidden, one row per user who has arranged "
            "the key figures, also with cascade delete. Passkeys has CredentialId (the key), OwnerId, PublicKey, UserHandle, SignCount, "
            "Name, CreatedAt and LastUsedAt, one row per passkey, with a cascade delete from the user. UserSessions has Id, OwnerId, Device, CreatedAt and LastSeenAt, one row per sign-in with a session cookie, also with a cascade delete. Identity also creates roles, claims, logins and tokens tables, which stay empty here. "
            "__EFMigrationsHistory records the applied migrations.")
    s.card("The database", "One SQLite file: the app's own table, ASP.NET Core Identity's, and EF Core's bookkeeping")

    def table(x, y, w, name, kind, rows, note=None):
        fill, stroke, color = KINDS[kind]
        h = 44 + len(rows) * 26 + (24 if note else 6)
        s.rect(x, y, w, h, fill=SURFACE, stroke=stroke, rx=12, sw=1.2)
        s.rect(x, y, w, 40, fill=fill, stroke=stroke, rx=12, sw=1.2)
        s.rect(x + 1, y + 28, w - 2, 12, fill=fill, stroke=fill, rx=0)
        s.text(x + 16, y + 26, name, size=14, weight=650, fill=color)
        for i, (col, typ, flag) in enumerate(rows):
            ry = y + 64 + i * 26
            if i:
                s.line(x + 12, ry - 18, x + w - 12, ry - 18, stroke=GRID)
            s.text(x + 16, ry, col, size=12.5, weight=600 if flag in ("PK", "FK") else 400, fill=INK, mono=True)
            s.text(x + w - 16, ry, typ, size=11.5, fill=INK_3, anchor="end")
            if flag:
                fw = text_width(flag, 10, 700) + 10
                s.rect(x + w - 16 - text_width(typ, 11.5) - fw - 8, ry - 13, fw, 17, fill=fill, stroke=stroke, rx=8.5)
                s.text(x + w - 16 - text_width(typ, 11.5) - fw / 2 - 8, ry - 1, flag, size=10, weight=700, fill=color,
                       anchor="middle")
        if note:
            s.text(x + 16, y + h - 12, note, size=11, fill=INK_2, italic=True)
        return h

    table(28, 88, 400, "SavedCalculations", "accent", [
        ("Id", "TEXT · GUID v7", "PK"),
        ("OwnerId", "TEXT", "FK"),
        ("Name", "TEXT · ≤ 100", ""),
        ("Note", "TEXT · ≤ 500 · null for none", ""),
        ("Inputs", "TEXT · JSON", ""),
        ("OtherHomes", "TEXT · JSON array", ""),
        ("Refinance", "TEXT · JSON", ""),
        ("Strategy", "TEXT · JSON", ""),
        ("CreatedAt", "INTEGER", ""),
        ("UpdatedAt", "INTEGER", ""),
    ], note="Index (OwnerId, UpdatedAt) · one kind of inputs per row")
    table(532, 88, 400, "AspNetUsers", "neutral", [
        ("Id", "TEXT", "PK"),
        ("Email · NormalizedEmail", "TEXT", ""),
        ("EmailConfirmed", "INTEGER", ""),
        ("PasswordHash", "TEXT", ""),
        ("SecurityStamp", "TEXT", ""),
        ("LockoutEnd · AccessFailedCount", "", ""),
    ], note="… and Identity's other columns, unused here")
    table(532, 336, 400, "UserPreferences", "accent", [
        ("OwnerId", "TEXT", "FK"),
        ("KeyFigureOrder", "TEXT · names, comma-separated", ""),
        ("KeyFiguresHidden", "TEXT · names, comma-separated", ""),
    ], note="One row per user who arranged the key figures")
    table(28, 438, 400, "Passkeys", "accent", [
        ("CredentialId", "BLOB", "PK"),
        ("OwnerId", "TEXT", "FK"),
        ("PublicKey", "BLOB", ""),
        ("UserHandle", "BLOB", ""),
        ("SignCount", "INTEGER", ""),
        ("Name", "TEXT · ≤ 50", ""),
        ("CreatedAt · LastUsedAt", "INTEGER", ""),
    ], note="One row per passkey · no secret: the private key stays on the device")
    s.arrow([(428, 524), (480, 524), (480, 296), (530, 296)], color=ACCENT, sw=2)
    s.text(436, 544, "cascade", size=10.5, weight=600, fill=ACCENT_DARK)
    s.text(436, 558, "delete", size=10.5, weight=600, fill=ACCENT_DARK)
    s.arrow([(732, 336), (732, 316)], color=ACCENT, sw=2)
    s.text(742, 331, "cascade delete", size=10.5, weight=600, fill=ACCENT_DARK)
    s.arrow([(428, 174), (480, 174), (480, 148), (530, 148)], color=ACCENT, sw=2)
    s.text(436, 196, "cascade", size=10.5, weight=600, fill=ACCENT_DARK)
    s.text(436, 210, "delete", size=10.5, weight=600, fill=ACCENT_DARK)

    s.rect(532, 488, 400, 78, fill=SURFACE_2, stroke=BORDER_STRONG, rx=12, dash="5 4")
    s.text(548, 512, "Also created by Identity, empty here", size=12.5, weight=650, fill=INK_2)
    s.text(548, 534, "AspNetRoles · AspNetRoleClaims · AspNetUserRoles", size=11.5, fill=INK_3)
    s.text(548, 552, "AspNetUserClaims · AspNetUserLogins · AspNetUserTokens", size=11.5, fill=INK_3)
    table(532, 590, 400, "UserSessions", "accent", [
        ("Id", "TEXT · GUID", "PK"),
        ("OwnerId", "TEXT", "FK"),
        ("Device", "TEXT · ≤ 100", ""),
        ("CreatedAt · LastSeenAt", "INTEGER", ""),
    ], note="One row per sign-in with a session cookie · the cookie carries the Id")
    s.arrow([(532, 686), (506, 686), (506, 250), (530, 250)], color=ACCENT, sw=2)
    s.text(436, 664, "cascade delete", size=10.5, weight=600, fill=ACCENT_DARK)
    s.rect(28, 816, 904, 64, fill=SURFACE_2, stroke=BORDER, rx=12)
    s.text(44, 840, "__EFMigrationsHistory", size=12.5, weight=650, fill=INK, mono=True)
    s.text(44, 862, "the migrations applied so far, so startup applies only the new ones (and __EFMigrationsLock "
                    "while it does)", size=12, fill=INK_2)
    s.save("schema.svg")


# ---------------------------------------------------------------------------------------------------------------
# Charts, from the reference loans
# ---------------------------------------------------------------------------------------------------------------

P, RATE, N = Decimal(200_000), Decimal(6), 360


def payment_split():
    rows = amortize(P, RATE, N)
    expect(rows[0][5], Decimal("1199.10"), "reference payment")
    expect(sum(r[1] for r in rows), Decimal("231677.04"), "reference total interest")
    expect(rows[0][1], Decimal("1000.00"), "month 1 interest")
    cross = next(r[0] for r in rows if r[2] > r[1])

    s = Svg(960, 380, "Where each payment goes",
            f"On $200,000 at 6% over 30 years, the $1,199.10 payment is $1,000 interest in month 1. Principal "
            f"overtakes interest from payment {cross}, and the last payments are almost all principal.")
    s.card("Where each payment goes", "$200,000 at 6% over 30 years: the same $1,199.10 every month, split differently")
    c = Chart(s, 92, 92, 820, 220, 1, 360, 0, 1250)
    c.grid([0, 250, 500, 750, 1000, 1250], lambda v: usd(v), [1, 60, 120, 180, 240, 300, 360],
           lambda v: "1" if v == 1 else f"{v} (yr {v // 12})")
    interest = [(r[0], r[1]) for r in rows[:-1]]
    total = [(r[0], r[1] + r[2]) for r in rows[:-1]]
    c.area(interest, [(r[0], 0) for r in rows[:-1]], ACCENT, 0.22)
    c.area(total, interest, POSITIVE, 0.20)
    c.series(interest, ACCENT, sw=2.5)
    c.dot(1, rows[0][1], ACCENT)
    c.note(1, rows[0][1], ["Payment 1: $1,000.00 interest,", "$199.10 principal"], dx=14, dy=34, bold_first=False)
    c.dot(cross, rows[cross - 1][1], INK)
    c.note(cross, rows[cross - 1][1], [f"Payment {cross} (year {(cross - 1) // 12 + 1})",
                                       "principal overtakes interest"], dx=12, dy=-40)
    s.legend(92, 356, [(ACCENT, "Interest", "area"), (POSITIVE, "Principal", "area")])
    s.text(912, 356, "payment number", size=11.5, fill=INK_3, anchor="end")
    s.save("chart-payment-split.svg")
    return cross


def extra_payments():
    base = amortize(P, RATE, N)
    fast = amortize(P, RATE, N, extra=Decimal(200))
    expect(len(fast), 252, "payments with $200 extra")
    saved = sum(r[1] for r in base) - sum(r[1] for r in fast)
    expect(saved, Decimal("79800.86"), "interest saved by $200 extra")

    s = Svg(960, 380, "$200 a month extra",
            "The balance of $200,000 at 6% falls to zero at payment 360 as scheduled, and at payment 252 with $200 a "
            "month extra: 108 payments sooner and $79,800.86 less interest.")
    s.card("$200 a month extra", "The balance as scheduled, and with $200 a month on top: paid off 108 payments sooner")
    c = Chart(s, 92, 92, 820, 220, 0, 360, 0, 200_000)
    c.grid([0, 50_000, 100_000, 150_000, 200_000], usd_k, [0, 60, 120, 180, 240, 300, 360],
           lambda v: f"yr {v // 12}")
    bp = [(0, P)] + [(r[0], r[4]) for r in base]
    fp = [(0, P)] + [(r[0], r[4]) for r in fast]
    pad = fp + [(k, 0) for k in range(253, 361)]
    c.area(bp, pad, POSITIVE, 0.16)
    c.series(bp, INK_3, sw=2.5, dash="6 5")
    c.series(fp, ACCENT, sw=2.8)
    c.dot(252, 0, ACCENT)
    c.dot(360, 0, INK_3)
    c.note(252, 0, ["Paid off at payment 252"], dx=-8, dy=-14, anchor="end", color=ACCENT_DARK)
    c.note(360, 0, ["360"], dx=-6, dy=-14, anchor="end", color=INK_2)
    c.note(12, 52_000, ["$79,800.86 less interest", "the shaded gap: interest that is never charged"], dx=0, dy=0,
           color=POSITIVE)
    s.legend(92, 356, [(INK_3, "As scheduled", "dash"), (ACCENT, "With $200 a month extra", "line"),
                       (POSITIVE, "Interest saved", "area")])
    s.save("chart-extra-payments.svg")


def arm_paths():
    def path(resets):
        def rate_at(k):
            r = Decimal(6)
            for at, v in resets:
                if k >= at:
                    r = Decimal(v)
            return r
        return rate_at

    expected = amortize(P, RATE, N, rate_at=path([(85, "7.5")]))
    expect(expected[84][5], Decimal("1365.01"), "7/1 payment after resetting to 7.5%")
    worst = amortize(P, RATE, N, rate_at=path([(85, 11)]))
    expect(worst[84][5], Decimal("1787.42"), "7/1 worst-case peak payment")
    floor = amortize(P, RATE, N, rate_at=path([(85, 4), (97, "2.75")]))
    expect(floor[96][5], Decimal("881.34"), "7/1 payment at the 2.75% margin")

    s = Svg(960, 400, "A 7/1 ARM's rate paths",
            "The reference loan as a 7/1 ARM holds 6% for 84 payments. Expecting 7.5% with 5/2/5 caps, it resets "
            "to 7.5% ($1,365.01). In the worst case it jumps to 11% ($1,787.42). Expecting 2% with 2/2/5 caps and a "
            "2.75% margin, it falls to 4% and then stops at the 2.75% floor ($881.34).")
    s.card("A 7/1 ARM: three ways the rate can go", "The reference loan, fixed at 6% for 84 payments, then resetting "
                                                     "once a year within its caps")
    c = Chart(s, 92, 92, 620, 240, 0, 180, 0, 12)
    c.grid([0, 2, 4, 6, 8, 10, 12], lambda v: f"{v}%", [0, 36, 84, 120, 180], lambda v: f"yr {v // 12}")
    c.s.rect(c.px(0), c.y, c.px(84) - c.px(0), c.h, fill=ACCENT_SOFT, stroke=ACCENT_SOFT, rx=0, opacity=0.6)
    c.s.text(c.px(42), c.y + 18, "fixed for 7 years", size=11.5, weight=600, fill=ACCENT_DARK, anchor="middle")
    c.s.line(c.px(0), c.py(2.75), c.px(180), c.py(2.75), stroke=POSITIVE, sw=1, dash="3 4")
    c.s.text(c.px(3), c.py(2.75) + 15, "the margin: a floor at 2.75%", size=11, fill=POSITIVE)
    c.series([(84, 6), (84, 11), (180, 11)], WARNING, sw=2.6)
    c.series([(84, 6), (84, 7.5), (180, 7.5)], ACCENT, sw=2.6)
    c.series([(84, 6), (84, 4), (96, 4), (96, 2.75), (180, 2.75)], POSITIVE, sw=2.6)
    c.series([(0, 6), (84, 6)], INK, sw=2.6)
    c.s.text(c.px(4), c.py(6) - 8, "6% for payments 1–84", size=11, weight=600, fill=INK)
    tx = 730
    for y, color, title, l1, l2 in [
        (c.py(11), WARNING, "Worst case · 11%", "caps 5/2/5: the first", "reset jumps 5 points · $1,787.42"),
        (c.py(7.5), ACCENT, "Expected 7.5%", "caps 5/2/5", "$1,199.10 → $1,365.01"),
        (c.py(3.4), POSITIVE, "Expected 2%, margin 2.75%", "caps 2/2/5: 4%, then", "stops at 2.75% · $881.34"),
    ]:
        s.text(tx, y - 2, title, size=12.5, weight=650, fill=color)
        s.text(tx, y + 14, l1, size=11, fill=INK_2)
        s.text(tx, y + 28, l2, size=11, fill=INK_2)
    s.text(c.px(180), 370, "payment number (years shown)", size=11.5, fill=INK_3, anchor="end")
    s.save("chart-arm-paths.svg")


def buydown():
    pays = [payment(P, Decimal(4), N), payment(P, Decimal(5), N), payment(P, Decimal(6), N)]
    expect(pays, [Decimal("954.83"), Decimal("1073.64"), Decimal("1199.10")], "2-1 buydown payments")
    subsidy = 12 * (pays[2] - pays[0]) + 12 * (pays[2] - pays[1])
    expect(subsidy, Decimal("4436.76"), "2-1 subsidy")

    s = Svg(960, 360, "A 2-1 buydown",
            "On the reference loan, a 2-1 buydown makes the payment $954.83 in year 1 and $1,073.64 in year 2, then "
            "$1,199.10 from year 3. A subsidy of $4,436.76 covers the difference.")
    s.card("A 2-1 buydown", "Year 1 paid as if at 4%, year 2 at 5%, then the note rate of 6%. A subsidy covers the gap.")
    c = Chart(s, 92, 92, 520, 200, 0, 3, 0, 1300)
    c.grid([0, 400, 800, 1200], lambda v: usd(v), [], str)
    labels = ["Year 1 · 4%", "Year 2 · 5%", "Year 3 on · 6%"]
    for i, p in enumerate(pays):
        x0, x1 = c.px(i + 0.18), c.px(i + 0.82)
        s.rect(x0, c.py(p), x1 - x0, c.py(0) - c.py(p), fill=ACCENT, stroke=ACCENT, rx=4)
        if i < 2:
            s.rect(x0, c.py(pays[2]), x1 - x0, c.py(p) - c.py(pays[2]), fill=WARNING_SOFT, stroke=WARNING_BORDER, rx=4,
                   dash="4 3")
            s.text((x0 + x1) / 2, (c.py(pays[2]) + c.py(p)) / 2 + 4, f"+{usd(pays[2] - p, True)}", size=11.5,
                   weight=650, fill=WARNING_TEXT, anchor="middle")
        s.text((x0 + x1) / 2, c.py(p) + 22, usd(p, True), size=12.5, weight=700, fill=SURFACE, anchor="middle")
        s.text((x0 + x1) / 2, c.py(0) + 20, labels[i], size=12, fill=INK_2, anchor="middle")
    s.box(660, 100, 272, 150, "warning", "The subsidy: $4,436.76", ["12 × $244.27 in year 1", "+ 12 × $125.46 in year 2",
                                                                    "", "Paid by the seller: you pay", "that much less interest."],
          title_size=14)
    s.legend(92, 340, [(ACCENT, "What you pay each month", "area"), (WARNING_BORDER, "Paid by the subsidy", "area")])
    s.save("chart-buydown.svg")


def refinance():
    old = amortize(Decimal(300_000), Decimal(7), 300)
    new = amortize(Decimal(300_000), Decimal(6), 360)
    expect(old[0][5], Decimal("2120.34"), "current payment")
    expect(new[0][5], Decimal("1798.65"), "new payment")
    cost = Decimal(6000)
    cum, even = Decimal(0), None
    for a, b in zip(old, new):
        cum += a[1] - b[1]
        if even is None and cum >= cost:
            even = a[0]
    expect(even, 25, "break-even payment")
    lifetime = sum(r[1] + r[2] for r in old) - (sum(r[1] + r[2] for r in new) + cost)
    expect(lifetime, Decimal("-17415.28"), "refinance lifetime savings")

    s = Svg(960, 410, "The refinance trap",
            "$300,000 left at 7% with 25 years to go, refinanced to 6% for a new 30 years with $6,000 closing costs. "
            "The payment falls by $321.69 and it breaks even at payment 25, but the new loan runs 60 payments longer "
            "and costs $17,415.28 more overall.")
    s.card("The refinance trap", "$300,000 left at 7% (25 years to go) against a new 30-year loan at 6%, "
                                 "$6,000 closing costs")
    c = Chart(s, 92, 92, 600, 230, 0, 360, 0, 300_000)
    c.grid([0, 100_000, 200_000, 300_000], usd_k, [0, 60, 120, 180, 240, 300, 360], lambda v: f"yr {v // 12}")
    op = [(0, Decimal(300_000))] + [(r[0], r[4]) for r in old]
    np_ = [(0, Decimal(300_000))] + [(r[0], r[4]) for r in new]
    c.area(np_[300:], [(k, 0) for k, _ in np_[300:]], WARNING_BORDER, 0.35)
    c.series(op, INK_3, sw=2.5, dash="6 5")
    c.series(np_, ACCENT, sw=2.8)
    c.dot(300, 0, INK_3)
    c.dot(360, 0, ACCENT)
    c.note(318, 190_000, ["+60 payments,", "mostly interest again"], dx=0, dy=0, anchor="middle", color=WARNING_TEXT)
    s.arrow([(c.px(318), c.py(168_000)), (c.px(318), c.py(40_000))], color=WARNING, sw=1.5)

    x = 724
    for i, (title, value, color, sub) in enumerate([
        ("Monthly payment", "−$321.69", POSITIVE, "$2,120.34 → $1,798.65"),
        ("Break-even", "payment 25", INK, "interest saved covers costs"),
        ("Over the life of the loan", "−$17,415.28", WARNING_TEXT, "the refinance costs more"),
    ]):
        y = 96 + i * 78
        s.rect(x, y, 208, 66, fill=WARNING_SOFT if i == 2 else SURFACE_2, stroke=WARNING_BORDER if i == 2 else BORDER,
               rx=10)
        s.text(x + 14, y + 20, title, size=11.5, fill=INK_2)
        s.text(x + 14, y + 42, value, size=17, weight=700, fill=color)
        s.text(x + 14, y + 58, sub, size=11, fill=INK_3)
    s.legend(92, 386, [(INK_3, "Keep today's loan", "dash"), (ACCENT, "Refinance", "line"),
                       (WARNING_BORDER, "The clock restarts", "area")])
    s.save("chart-refinance.svg")


if __name__ == "__main__":
    architecture()
    request_flow()
    ci_pipeline()
    tech_stack()
    amortization_engine()
    schema()
    payment_split()
    extra_payments()
    arm_paths()
    buydown()
    refinance()
