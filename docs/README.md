# Mortgage Analytics: developer guide

> **How the code is built, why, and how to run and change it.** The [main README](../README.md) is the front page;
> these eleven pages are the guide behind it. Read them in order to be able to explain, or extend, any part of the app.

**Total read time:** about 2¼ hours · **Shortest route to presenting it:** [1 hour](#where-to-start)

---

## The app in one paragraph

![The shape of the system: the Angular app calls Api, which calls Application, which calls Domain; Infrastructure implements Application's port and stores data in SQLite](images/architecture.svg)

A .NET 10 API and an Angular 22 single-page app, shipped as one Docker container. Three calculators (a home purchase
with every ownership cost, refinancing, and paying the mortgage off versus investing) share one loan, typed once.
Accounts let people save calculations and reopen them. The money math lives in a domain project with no
dependencies, uses `decimal` throughout, and is checked against independent Python models to the cent. More than
1,700 tests across five layers run in CI, which also enforces the test standards, an 85% coverage floor and a
mutation-score floor on the domain.

---

## The pages

| # | Page | Read it to know | Time |
|---|---|---|---|
| 0 | [**What it does**](00-features.md) | Every feature and rule, page by page, in plain language | 10 min |
| 1 | [**Tech stack**](01-tech-stack.md) | Every tool and library, its version, where it is used, and why it was picked | 7 min |
| 2 | [**Commands**](02-commands.md) | How to run, test, debug, migrate and ship it: every command, in one place | 7 min |
| 3 | [**Architecture**](03-architecture.md) | The layers, the dependency rule, one request traced from a keystroke to the database and back, and the design principles | 12 min |
| 4 | [**Backend**](04-backend.md) | Domain, Application, Infrastructure and API: the classes that matter, calling the API, and security | 12 min |
| 5 | [**Frontend**](05-frontend.md) | The Angular app: stores, signals, forms, the shared loan, charts, routing and the visual design | 13 min |
| 6 | [**The mortgage math**](06-mortgage-math.md) | The domain itself, with worked numbers: amortization, recasts, PMI, taxes, ARMs, buydowns, refinancing, pay off or invest | 14 min |
| 7 | [**Testing and quality**](07-testing.md) | TDD, the test layers, the rules the build enforces, independent models, coverage, mutation testing, CI | 12 min |
| 8 | [**Interview guide**](08-interview-guide.md) | The pitch, the questions you are likely to get, trade-offs and stories, with answers grounded in this code | 20 min |
| 9 | [**SOLID by example**](09-solid-by-example.md) | All five SOLID principles in one section of the code, the amortization engine, with the real code for each | 15 min |
| 10 | [**Data and storage**](10-data-and-storage.md) | Everything the app keeps and where: the schema, a stored row, every query, accounts, migrations, backups, and the known gaps | 12 min |

---

## Where to start

| If you want to... | Read |
|---|---|
| **Understand what it does** (10 min) | [0. What it does](00-features.md) |
| **Run it and its tests** (10 min) | [2. Commands](02-commands.md) |
| **Find your way around the code** (30 min) | [3. Architecture](03-architecture.md), then [4. Backend](04-backend.md) or [5. Frontend](05-frontend.md) |
| **Check the numbers** | [6. The mortgage math](06-mortgage-math.md) and [7. Testing and quality](07-testing.md) |
| **Know what happens to the data** (12 min) | [10. Data and storage](10-data-and-storage.md) |
| **Prepare to present it** (1 hour) | [3. Architecture, "One request, end to end"](03-architecture.md#one-request-end-to-end) (15 min), [6. The mortgage math](06-mortgage-math.md) (15 min), [8. Interview guide](08-interview-guide.md) (20 min, out loud), [9. SOLID by example](09-solid-by-example.md) (15 min), then run it once with [2. Commands](02-commands.md) (10 min) |

Every class and public member has a doc comment (the build fails without one), so the code explains itself once you
know where to look.

The independent models and the checks that keep these pages honest are in [`tools/`](../tools): each folder has its
own README. The diagrams and charts in these pages are drawn by [`tools/diagrams`](../tools/diagrams/README.md), which
computes every chart from the reference loans and fails if a number disagrees with the text.
