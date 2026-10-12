# Mortgage Analytics: developer guide

The [main README](../README.md) is the front page: what the app does, how to run it, and where to look. These pages
are the guide behind it: how the code is built, why, and how to run and change it. Read them in order to be able to
explain, or extend, any part of the app.

## The app in one paragraph

A .NET 10 API and an Angular 22 single-page app, shipped as one Docker container. Three calculators (a home purchase
with every ownership cost, refinancing, and paying the mortgage off versus investing) share one loan, typed once.
Accounts let people save calculations and reopen them. The money math lives in a domain project with no
dependencies, uses `decimal` throughout, and is checked against independent Python models to the cent. More than
1,300 tests across five layers run in CI, which also enforces the test standards, an 85% coverage floor and a
mutation-score floor on the domain.

## The pages

| # | Page | Read it to know |
|---|---|---|
| 0 | [What it does](00-features.md) | Every feature and rule, page by page, in plain language |
| 1 | [Tech stack](01-tech-stack.md) | Every tool and library, its version, where it is used, and why it was picked |
| 2 | [Commands](02-commands.md) | How to run, test, debug, migrate and ship it: every command, in one place |
| 3 | [Architecture](03-architecture.md) | The layers, the dependency rule, one request traced from a keystroke to the database and back, and the design principles |
| 4 | [Backend](04-backend.md) | Domain, Application, Infrastructure and API: the classes that matter, calling the API, and security |
| 5 | [Frontend](05-frontend.md) | The Angular app: stores, signals, forms, the shared loan, charts, routing and the visual design |
| 6 | [The mortgage math](06-mortgage-math.md) | The domain itself, with worked numbers: amortization, recasts, PMI, taxes, ARMs, buydowns, refinancing, pay off or invest |
| 7 | [Testing and quality](07-testing.md) | TDD, the test layers, the rules the build enforces, independent models, coverage, mutation testing, CI |
| 8 | [Interview guide](08-interview-guide.md) | The pitch, the questions you are likely to get, trade-offs and stories, with answers grounded in this code |

## Where to start

| If you want to... | Read |
|---|---|
| **Understand what it does** (10 min) | [0. What it does](00-features.md) |
| **Run it and its tests** (10 min) | [2. Commands](02-commands.md) |
| **Find your way around the code** (30 min) | [3. Architecture](03-architecture.md), then [4. Backend](04-backend.md) or [5. Frontend](05-frontend.md) |
| **Check the numbers** | [6. The mortgage math](06-mortgage-math.md) and [7. Testing and quality](07-testing.md) |
| **Prepare to present it** (1 hour) | [3. Architecture, "One request, end to end"](03-architecture.md#one-request-end-to-end) (15 min), [6. The mortgage math](06-mortgage-math.md) (15 min), [8. Interview guide](08-interview-guide.md) (20 min, out loud), then run it once with [2. Commands](02-commands.md) (10 min) |

Every class and public member has a doc comment (the build fails without one), so the code explains itself once you
know where to look.

The independent models and the checks that keep these pages honest are in [`tools/`](../tools): each folder has its
own README.
