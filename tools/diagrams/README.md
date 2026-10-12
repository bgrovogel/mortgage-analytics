# Diagrams

Draws the documentation's diagrams and charts as SVG files in `docs/images/`, in the app's own colours, on a white
card that reads in light and dark themes.

## Why

The docs are read in VS Code's Markdown preview as well as on GitHub, and VS Code's preview draws neither Mermaid
nor GitHub's other extras; it does show images. Drawing the pictures from one script keeps them in one style. Every
chart is computed from the reference loans rather than drawn by hand, so a chart cannot disagree with the numbers in
the text beside it.

## Run it

```bash
python tools/diagrams/make_diagrams.py    # rewrites every SVG in docs/images/
```

Run it after changing a diagram here, or a rule the charts show. Edit the script, not the SVG files.

## What it checks

Before it draws a chart, it computes the numbers in `Decimal` (the same rules as the engine: interest rounded to the
cent each month, the final payment takes the remaining balance) and stops if any differs from
[The mortgage math](../../docs/06-mortgage-math.md):

- the reference loan's payment ($1,199.10) and total interest ($231,677.04);
- $200 a month extra: 252 payments and $79,800.86 less interest;
- the 7/1 ARM's payments: $1,365.01, the worst case's $1,787.42, and $881.34 at the margin;
- the 2-1 buydown's payments and its $4,436.76 subsidy;
- the refinance: $2,120.34 and $1,798.65 a month, break-even at payment 25, and $17,415.28 more overall.

It also stops if a row of the tech-stack picture would run past the card's edge.

## Files

| File | Purpose |
|---|---|
| `make_diagrams.py` | The palette, a small drawing kit (boxes, arrows, charts), every picture, and the checks (standard library only) |

| Picture | Used in |
|---|---|
| `architecture.svg` | README, the guide index, Architecture, the interview guide |
| `request-flow.svg` | Architecture: one request, end to end |
| `tech-stack.svg` | Tech stack |
| `ci-pipeline.svg` | Testing and quality |
| `amortization-engine.svg` | Backend, SOLID by example |
| `chart-*.svg` | The mortgage math |

[All tools](../README.md)
