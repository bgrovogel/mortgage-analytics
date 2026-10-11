# Mortgage Analytics: developer guide

The [main README](../README.md) is the product page: what the app calculates, the API, and the design decisions
in brief. These pages are the guide behind it: how the code is built, why, and how to run and change it. They
are written so you can read them start to finish and then explain, or extend, any part of the app.

| # | Page | Read it to know |
|---|---|---|
| 1 | [Tech stack](01-tech-stack.md) | Every tool and library, its version, where it is used, and why it was picked |
| 2 | [Commands](02-commands.md) | How to run, test, debug, migrate and ship it: every command, in one place |
| 3 | [Architecture](03-architecture.md) | The layers, the dependency rule, and one request traced from a keystroke to the database and back |
| 4 | [Backend](04-backend.md) | Domain, Application, Infrastructure and API: the classes that matter and the patterns they use |
| 5 | [Frontend](05-frontend.md) | The Angular app: stores, signals, forms, the shared loan, charts, routing |
| 6 | [The mortgage math](06-mortgage-math.md) | The domain itself: amortization, recasts, PMI, taxes, ARMs, buydowns, refinancing, pay off or invest |
| 7 | [Testing and quality](07-testing.md) | TDD, the test layers, the rules the build enforces, independent models, CI |
| 8 | [Interview guide](08-interview-guide.md) | The pitch, the questions you are likely to get, and answers grounded in this code |

## A one-hour reading route

1. **[Architecture](03-architecture.md), "One request, end to end"** (15 min). Once you can follow a keystroke to
   the domain and back, every other page is detail.
2. **[The mortgage math](06-mortgage-math.md)** (15 min). Interviewers ask about the domain as much as the code.
3. **[Interview guide](08-interview-guide.md)** (20 min). Say the answers out loud.
4. **[Commands](02-commands.md)** (10 min). Run the app and the tests once yourself before the interview.

Then open the files the pages name. Every class and public member has a doc comment (the build fails without
one), so the code explains itself from there.

## The app in one paragraph

A .NET 10 API and an Angular 22 single-page app, shipped as one Docker container. Three calculators (a home
purchase with every ownership cost, refinancing, and paying the mortgage off versus investing) share one loan,
typed once. Accounts let people save calculations and reopen them. The money math lives in a domain project with
no dependencies, uses `decimal` throughout, and is checked against independent Python models to the cent. More
than 1,300 tests across five layers run in CI, which also enforces the test standards and an 85% coverage floor.
