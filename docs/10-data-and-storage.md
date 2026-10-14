# 10. Data and storage

> **Everything the app keeps, where it keeps it, and how.** One SQLite database holds the accounts and the saved
> calculations; two folders beside it hold the keys that sign sessions and, locally, the emails. The same model runs
> on PostgreSQL, with the keys in the database, for several instances of the app. This page covers the schema, a
> stored row, every query the app makes, the migrations, PostgreSQL, how to inspect, back up and reset the data, and
> what is not there yet.

**Read time:** 12 min · **Best for:** "what happens to my data?" questions · **Code:** `src/MortgageAnalytics.Infrastructure/`,
`src/MortgageAnalytics.Application/SavedCalculations/`

**On this page:** [What is stored](#what-is-stored) · [Where it lives](#where-it-lives) · [The schema](#the-schema) ·
[A saved calculation, as stored](#a-saved-calculation-as-stored) · [Every query the app makes](#every-query-the-app-makes) ·
[Accounts](#accounts) · [Migrations](#migrations) · [PostgreSQL and several instances](#postgresql-and-several-instances) ·
[How it is tested](#how-it-is-tested) ·
[Inspect, back up, reset](#inspect-back-up-reset) · [What is not there yet](#what-is-not-there-yet)

---

## What is stored

| What | Where | Written when |
|---|---|---|
| **Accounts:** email, password hash, whether the email is confirmed, lockout state | `AspNetUsers` table | Sign-up, email confirmation, sign-in (failed attempts), password reset; deleted with the account |
| **Saved calculations:** a name and the **inputs** of a calculation, up to four homes compared, a refinance or a pay-off-or-invest comparison | `SavedCalculations` table | Save, rename or replace, delete |
| **Which migrations have run** | `__EFMigrationsHistory` table | App startup, when a new migration ships |
| **Signing keys** for the session cookie and the codes in emailed links | `keys/` folder, XML files; or the `DataProtectionKeys` table, when several instances share them | First startup, then when a key nears expiry |
| **Emails** (only when no mail server is configured) | `outbox/` folder, one JSON file per email; `/dev/mailbox` lists the newest 100 | Sign-up, resend, forgot password |
| **Backups** of the database | `backups/` folder beside it, `calculations-<UTC time>.db` | At startup and then daily; the newest 7 are kept |

**Results are never stored.** A saved calculation keeps only what was typed; opening it sends those inputs to the
API again. So a reopened save always shows numbers from today's engine: if a rule is fixed, old saves show the fixed
numbers.

Nothing else is kept on the server: no analytics, and request logs go to the console (one JSON line per API request,
without its query string), never to the database. The calculators store nothing
for a visitor who is not signed in: a page keeps its inputs in memory until the tab closes. The one thing the browser
keeps is which columns the schedule shows (`localStorage`, key `schedule-columns`).

---

## Where it lives

| How it runs | Database | Signing keys · emails |
|---|---|---|
| **Local development** (`dotnet run`) | `src/MortgageAnalytics.Api/calculations.db` | `App_Data/keys/` · `App_Data/outbox/` (read at `/dev/mailbox`), both in `src/MortgageAnalytics.Api/` |
| **Docker** (`docker compose up`) | `/data/calculations.db`, on the `mortgage-analytics_calculations` volume | `/data/keys/` on the same volume · emails go to Mailpit, nothing is written |
| **Playwright** (`npm run e2e`) | `mortgage-analytics-e2e.db` in the system temp folder | as in local development |
| **API integration tests** | a new temporary file per run | a new temporary folder per run · emails recorded by a substitute transport |
| **Repository tests** | SQLite in memory, built by the real migrations | none |

All of these are ignored by git (`*.db`, `*.db-shm`, `*.db-wal`, `App_Data/`). The settings that move them are in
[Commands, "Configuration you might set"](02-commands.md#configuration-you-might-set).

**Why three files:** EF Core opens SQLite in **WAL mode** (write-ahead logging), so beside `calculations.db` there is
a `-wal` file holding recent writes and a `-shm` index for it. Readers never block the writer. While the app runs, the
three files are one database: copy them together, or stop the app first (see [Inspect, back up, reset](#inspect-back-up-reset)).

---

## The schema

![The database: SavedCalculations (Id, OwnerId, Name, the four JSON columns Inputs, OtherHomes, Refinance and Strategy, CreatedAt and UpdatedAt, indexed on OwnerId and UpdatedAt) references AspNetUsers through OwnerId with cascade delete; Identity's roles, claims, logins and tokens tables are created but empty; __EFMigrationsHistory records the migrations](images/schema.svg)

**`SavedCalculations`**, the app's own table, defined in `CalculationsDbContext.OnModelCreating`:

| Column | Type | Rule |
|---|---|---|
| `Id` | TEXT (a GUID) | Primary key. A **version 7** GUID, which starts with the time, so new rows land at the end of the index instead of at random places |
| `OwnerId` | TEXT, required | The user's id from `AspNetUsers`. A foreign key with **cascade delete** |
| `Name` | TEXT, required, at most 100 | Trimmed before it is stored; the limit is the validator's `MaxNameLength`, so the two cannot disagree |
| `Inputs` | TEXT (JSON), or null | An `AmortizationRequest`: the calculator's inputs (Home A, when homes are compared) |
| `OtherHomes` | TEXT (JSON array), or null | One to three more `AmortizationRequest`s: Homes B to D, set only beside `Inputs` |
| `Refinance` | TEXT (JSON), or null | A `RefinanceRequest` |
| `Strategy` | TEXT (JSON), or null | A `StrategyRequest` |
| `CreatedAt`, `UpdatedAt` | INTEGER | Server time (the injected `TimeProvider`), stored as a sortable 64-bit number because SQLite cannot sort `DateTimeOffset` |

One kind of inputs is set per row, and which says what kind of save it is (`SavedCalculation.Kind` is computed from
it, not stored): `Inputs` alone is a purchase, `Inputs` and `OtherHomes` homes compared, `Refinance` or
`Strategy` a comparison of its own. One index, on **(OwnerId, UpdatedAt)**, matches the one list query every History page
makes.

**ASP.NET Core Identity's tables** come from `IdentityDbContext`. The app uses `AspNetUsers` (email, normalized email
for lookups, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, and the lockout columns `LockoutEnd` and
`AccessFailedCount`). The other six (`AspNetRoles`, `AspNetRoleClaims`, `AspNetUserRoles`, `AspNetUserClaims`,
`AspNetUserLogins`, `AspNetUserTokens`) are created with them and stay empty: there are no roles, external logins or
stored tokens.

---

## A saved calculation, as stored

The JSON columns hold the **API contract**, in the same shape the API accepts (camelCase, enums as strings), so a row
reads like the request that created it and can be sent straight back:

A real row's `Inputs` (a purchase with $200 a month extra and separate Texas taxes):

```json
{
  "homePrice": 410000,
  "downPayment": 18750,
  "annualInterestRate": 6.5,
  "termInMonths": 360,
  "firstPaymentDate": "2026-11-01",
  "strategy": "ShortenTerm",
  "recast": null,
  "extraPayments": {
    "monthlyAmount": 200,
    "monthlyStartingPaymentNumber": 1,
    "annual": null,
    "lumpSums": []
  },
  "housingCosts": {
    "schoolTaxRate": 1,
    "localTaxRate": 1.1,
    "mudTaxRate": 0.85,
    "isHomestead": true,
    "schoolHomesteadExemption": 140000,
    "localHomesteadExemptionPercent": 0,
    "homesteadAssessmentCap": 10,
    "over65OrDisabled": null,
    "homeValueGrowthRate": 4,
    "insuranceIncreaseRate": 5,
    "hoaIncreaseRate": 3,
    "pid": null,
    "annualHomeownersInsurance": 2400,
    "monthlyHoaDues": 50,
    "pmiRate": 0.5,
    "pmiCancellation": "BorrowerRequested"
  },
  "formatVersion": 1
}
```

**Why JSON, not columns:** a save is always read and written whole, never searched by a field inside it, so forty-odd
columns (or tables for lump sums) would add joins and migrations for nothing. New request fields need no schema
change. EF Core converts with `System.Text.Json` through a `ValueConverter`, and a `ValueComparer` compares the JSON,
so replacing the inputs with an equal copy is not seen as a change.

**The catch, and its guards:** an old save loads into today's contract, so a *renamed* or *removed* field would
silently lose its value. Two things stop that:

- **A format version** (`StoredJson`): every save is written with `formatVersion` (today `1`; saves from before it
  existed have none and count as 1). A breaking change raises `StoredJson.CurrentVersion` and adds one upgrade, a
  small edit to the JSON, from the previous version; each save is upgraded step by step as it loads. A missing step
  stops the app at startup, and a save from a *newer* version is refused rather than read with values missing.
- **`StoredFormatTests`** load a save of each kind in today's format, with every option set
  (`tests/MortgageAnalytics.Infrastructure.Tests/StoredFormats/*.json`), and fail naming any value that does not come
  back. Adding a field passes; renaming one fails, which is the signal to keep the old name or add an upgrade.

---

## Every query the app makes

`SavedCalculationRepository` is the only code that touches `SavedCalculations`, and every query includes the owner:

| API call | What the repository does | SQL, in effect |
|---|---|---|
| `GET /api/v1/calculations?search=` | List, newest change first, optionally by name | `SELECT … WHERE OwnerId = @me [AND Name LIKE '%term%' ESCAPE '\'] ORDER BY UpdatedAt DESC` |
| `GET /api/v1/calculations/{id}` | Find one | `SELECT … WHERE Id = @id AND OwnerId = @me` |
| `POST /api/v1/calculations` | Add | `INSERT` with a new v7 id, `CreatedAt = UpdatedAt = now` |
| `PUT /api/v1/calculations/{id}` | Find it (as above), then change the name and inputs | `UPDATE … SET Name, Inputs, OtherHomes, Refinance, Strategy, UpdatedAt` for the changed columns |
| `DELETE /api/v1/calculations/{id}` | Delete in one statement, without loading it | `DELETE … WHERE Id = @id AND OwnerId = @me` (`ExecuteDeleteAsync`) |

- **Ownership is in the query**, not checked afterwards: another user's id simply finds nothing, which the API returns
  as a **404**, never a 403, so it never confirms that the id exists.
- **The owner comes from the session**, never from the request body.
- **Search is literal and ignores case:** SQLite's `LIKE` ignores case, and `%`, `_` and `\` in the search are
  escaped, so "50%" finds names containing "50%", not everything.
- **One `DbContext` per HTTP request** (scoped), as EF Core intends: it is not thread-safe, and its change tracking
  is what lets `PUT` write only what changed.

Identity runs its own queries against `AspNetUsers` (find by normalized email, update the lockout count, delete the
user, and so on), and now one per signed-in request: the session check looks the user up by id.

---

## Accounts

What Identity stores and enforces, as configured in `AccountEndpoints.AddAccounts`:

| Rule | Setting |
|---|---|
| **Password** | At least 8 characters; no required mix of cases, digits or symbols (length matters more than mix). Stored only as Identity's salted hash (PBKDF2) |
| **Email confirmation** | Required before the first sign-in (`RequireConfirmedEmail`) |
| **Lockout** | Identity's defaults: after **5** wrong passwords in a row the account is locked for **5 minutes**, and even the right password is refused (`LockedOut`). A successful sign-in resets the count. `AccountApiTests` pin the limit from both sides |
| **Emailed codes** | Confirmation and reset codes are signed with the Data Protection keys, single-purpose, and expire after Identity's default of a day |
| **Session** | A cookie named `mortgage-analytics.session`: HttpOnly, SameSite=Strict, valid 14 days and renewed while in use (sliding). Every request rechecks it against the user, so a deleted account or a reset password ends the other sessions at once |
| **Changing the password** | `POST /api/v1/account/password` with the current and new passwords. A wrong current one changes nothing and counts toward lockout. The new password changes the security stamp, so the account's other sessions end at once, and this one is signed in again |
| **Deleting the account** | `DELETE /api/v1/account` with the password in the body. A wrong password deletes nothing and counts toward lockout, so a stolen session cannot guess it here. Identity deletes the user, the database cascades to their saves, and the session ends. In the app: **Your account** (`/account`) |
| **Attempt limit** | Account POSTs are limited per client address (`RateLimiting:AccountPermitsPerMinute`: 10 in production, 1,000 in Development so the browser tests can sign up many users) |

**The signing keys matter as much as the database.** They live on disk (`DataProtection:KeysDirectory`), and in Docker
on the same volume as the database; or, with `DataProtection:Store = Database`, in the database itself
([PostgreSQL and several instances](#postgresql-and-several-instances)). Lose them and every session ends and every emailed link stops working; the
accounts themselves are unaffected.

Security as a whole (headers, the CSP, open redirects): [Backend, "Security"](04-backend.md#security).

---

## Migrations

The schema is versioned by EF Core migrations in `src/MortgageAnalytics.Infrastructure/Migrations/` (SQLite's; PostgreSQL's
are in `Migrations/Postgres/`), and the API
**applies any it has not had at startup** (`MigrateDatabaseAsync`, called in `Program.cs` before it takes requests).
There is no manual `database update` step, locally or in Docker. While it migrates, EF Core holds
`__EFMigrationsLock`, so two instances starting together cannot both apply the same migration.

| Migration | What it changed |
|---|---|
| `InitialCreate` | `SavedCalculations` with `Id`, `Name`, `Inputs`, the times, and an index on `UpdatedAt` |
| `AddRefinanceComparisons` | `Inputs` became nullable; added `Refinance` |
| `AddUserAccounts` | Identity's tables; `OwnerId` with its foreign key and cascade; the index became (OwnerId, UpdatedAt). **It deletes every existing save first** (`DELETE FROM SavedCalculations`): saves made before accounts had no owner, and could not be given one |
| `AddStrategyComparisons` | Added `Strategy` |
| `AddDataProtectionKeys` | `DataProtectionKeys`, for signing keys kept in the database |
| `AddHomeComparisons` | Added `SecondHome` (on PostgreSQL, `PostgresAddHomeComparisons`) |
| `CompareUpToFourHomes` | Renamed `SecondHome` to `OtherHomes`, and **moved the data** with SQL added by hand: each saved second home becomes a list of one (`'[' \|\| OtherHomes \|\| ']'`). Down, the first of the list becomes the second home again, and a third or fourth home is lost. `HomeComparisonMigrationTests` checks both ways on SQLite, and a Postgres test on PostgreSQL |

To add one: [Commands, "Change the database"](02-commands.md#change-the-database). Two tests keep this honest:
`TheMigrations_MatchTheModel` fails if the model has changes no migration covers, and every repository test runs on a
database built by the real migrations, not by `EnsureCreated`.

---

## PostgreSQL and several instances

SQLite is one file and one writer at a time, which is right for the demo and wrong for an app that runs as several
instances behind a load balancer. Two settings change both:

| Setting | Default | Other value |
|---|---|---|
| `Database:Provider` | `Sqlite` | `Postgres`, with `ConnectionStrings:Calculations` as `Host=...;Database=...;Username=...;Password=...` |
| `DataProtection:Store` | `FileSystem` (`DataProtection:KeysDirectory`) | `Database`: the keys go in the `DataProtectionKeys` table, which every instance reads |

**One model, two contexts.** `CalculationsDbContext` holds the model and is what the rest of the app asks for.
`SqliteCalculationsDbContext` and `PostgresCalculationsDbContext` derive from it, one per provider, because a migration
is written for one provider: SQLite's column types and `Autoincrement` are not PostgreSQL's. `AddInfrastructure`
registers whichever the setting names. Nothing outside Infrastructure changes: the repository, Identity's stores and
the health check all ask for `CalculationsDbContext`. Each column keeps its type's meaning: the JSON columns are `text`
on both (the app never queries inside them, so `jsonb` would buy nothing), and the times stay 64-bit numbers.

**Search** uses `ILIKE` on PostgreSQL, because its `LIKE` compares case, where SQLite's does not. A test proves it.

**Why the keys move too.** Each instance signs session cookies and emailed links with its Data Protection keys. With
the keys on each instance's own disk, a session started on one instance is unreadable on the next one the load
balancer picks, so the user is signed out at random. In the shared database every instance has every key. An API test
runs two instances on one database and proves both sides: shared keys keep the session; each instance's own folder
loses it.

**Try it:** `docker compose --profile cluster up --build`, then http://localhost:8090. That starts PostgreSQL 17, two
instances of the app (`app-1`, `app-2`) and Caddy taking turns between them (`caddy/Cluster.Caddyfile`); each
response names its instance in `X-Served-By`. Sign up, confirm from Mailpit and sign in: the requests alternate
between the two, and the session holds on both. Both instances migrate the database at startup, and EF Core's
migration lock lets only one apply them.

**Expected in the logs** of a brand-new PostgreSQL database: one `Failed executing DbCommand` error, EF Core reading a
migrations history table that does not exist yet, before it creates it; and a warning that the keys are stored
unencrypted, as they are on disk. A production deployment would encrypt them at rest
(`ProtectKeysWithCertificate`, or a cloud key vault).

**Backups** are PostgreSQL's own (`pg_dump`, or the host's snapshots): the app's daily copy is of a SQLite file, so
`AddDatabaseBackups` turns itself off on PostgreSQL.

**Adding a migration** now means one per provider: [Commands, "Change the database"](02-commands.md#change-the-database).
`ThePostgresMigrations_MatchTheModel` fails, like SQLite's test, when PostgreSQL's are behind the model.

---

## How it is tested

| Test | Proves |
|---|---|
| `SavedCalculationRepositoryTests` | Each kind round-trips with every input; each owner sees only their own; newest first; search ignores case and takes `%` and `_` literally; update writes; delete reports whether anything was there; deleting a user deletes their saves and no one else's; the migrations match the model |
| `StoredFormatTests` | A save of each kind in today's JSON still loads, with every value |
| `DatabaseProviderTests` | SQLite is the default; `Postgres` picks the PostgreSQL context and its migrations, which match the model; the keys table works; backups are off on PostgreSQL |
| `PostgresTests` | On a real PostgreSQL 17 in a container (Testcontainers): the migrations build the schema, a save round-trips, each owner sees only their own, deleting a user cascades, search ignores case, and a saved second home moves into the list of other homes and back. Run locally, as they need Docker: `dotnet test --filter TestCategory=Postgres` |
| `DatabaseHealthCheckTests` | `/health` is Healthy for the database the app created, and Unhealthy when the database is missing (a broken Docker volume shows up there) |
| API integration tests | Through HTTP: 201 with `Location`, 401 when signed out, another user's item is a 404, sign-up, confirmation and reset through the captured emails, lockout at its limit (four wrong passwords still sign in with the right one; five lock the account), and deleting an account: it needs the password, takes the saves, frees the email and ends every session |
| Playwright History tests | Saving each kind, finding it by name, reopening it with every value, renaming and deleting, in a real browser |

---

## Inspect, back up, reset

**Look inside.** Any SQLite tool opens the file (DB Browser for SQLite, or a SQLite extension in VS Code). Python needs
nothing extra:

```bash
python -c "import sqlite3; db = sqlite3.connect('file:src/MortgageAnalytics.Api/calculations.db?mode=ro', uri=True); print(db.execute('select Name, length(Inputs), length(Refinance), length(Strategy) from SavedCalculations order by UpdatedAt desc limit 5').fetchall())"
```

Opened read-only (`mode=ro`), it is safe while the API runs.

**Automatic backups.** The app copies the database itself (`Infrastructure/Backups`): at startup, then every hour it
checks, and takes a copy once the last is a day old, so restarts don't pile copies up. The copy is SQLite's
`VACUUM INTO`, one consistent snapshot taken while the app keeps serving, which opens on its own. The newest 7 are kept.

| Setting | Default | |
|---|---|---|
| `Backups:Enabled` | `true` | `false` leaves backups to the platform (a managed volume's snapshots) |
| `Backups:Directory` | `backups/` beside the database | In Docker, `/data/backups`, on the volume |
| `Backups:IntervalHours` | `24` | The least time between two copies |
| `Backups:Keep` | `7` | Older copies are deleted |

They sit on the same volume as the database, so they cover a bad migration, a corrupted file or a deleted account,
not the loss of the volume itself: copy them off the machine for that.

```bash
docker compose exec app ls /data/backups                         # the copies
docker compose cp app:/data/backups ./backups                    # off the machine
```

To restore one, stop the app, put the copy in place of the database, delete the old `-wal` and `-shm`, give the file
back to the app's user (`docker compose cp` writes it as root, and SQLite would open it read-only), and start again:

```bash
docker compose stop app
docker compose cp ./backups/calculations-20261012T164229Z.db app:/data/calculations.db
docker compose run --rm --no-deps --user root --entrypoint sh app -c "rm -f /data/calculations.db-wal /data/calculations.db-shm && chown app:app /data/calculations.db"
docker compose start app
```

(Tried end to end: an account created after the copy is gone once it is restored. In Git Bash on Windows, set
`MSYS_NO_PATHCONV=1` first, or it rewrites the `/data` paths.)

**Back up by hand.** Locally, SQLite's own backup copies a consistent snapshot even while the app writes:

```bash
python -c "import sqlite3; sqlite3.connect('src/MortgageAnalytics.Api/calculations.db').backup(sqlite3.connect('backup.db'))"
```

From Docker, stop the app so SQLite folds the `-wal` file into the database, copy it out, and start it again. Keep
the keys with it, or restored users will have to sign in again:

```bash
docker compose stop app
docker compose cp app:/data/calculations.db ./backup/
docker compose cp app:/data/keys ./backup/keys
docker compose start app
```

**Reset.** Locally: stop the API and delete `src/MortgageAnalytics.Api/calculations.db` and its `-wal` and `-shm`
files; the next start creates an empty one. In Docker: `docker compose down -v` deletes the volume (database and keys).
The dev database collects the accounts that test runs sign up, so an occasional reset keeps it small.

---

## What is not there yet

Found while writing this page; each is a known gap, not a hidden one. (Seven more were found here too and are
closed: an untested cascade, an untested lockout, no way to delete an account, then no screen for it, a session
cookie that was never `Secure` behind an HTTPS proxy, no automatic backups, saved JSON with no version, and one
writer at a time, now PostgreSQL.)

| Gap | Today | What would close it |
|---|---|---|
| **Keys stored unencrypted** | On disk or in the database, readable by anyone who can read either | `ProtectKeysWithCertificate`, or a cloud key vault |
| **No data copy from SQLite to PostgreSQL** | A new PostgreSQL database starts empty | A one-off copy, table by table, in foreign-key order |

---

← Previous: [9. SOLID by example](09-solid-by-example.md) · [Guide contents](README.md)
