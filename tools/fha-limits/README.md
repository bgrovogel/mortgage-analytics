# FHA limits

Builds the app's FHA county loan limits, `src/MortgageAnalytics.Application/Data/fha-loan-limits.json`, from HUD's own
file.

## Why

FHA insures at most a set amount in each county: the national floor in most ($541,287 for a one-unit home in 2026),
up to the ceiling in the most expensive ($1,249,125), more in Alaska, Hawaii and the territories. HUD publishes them
every December. The app checks an FHA loan against its county's limit, so it ships the whole table, and this tool is
the whole yearly update.

## Run it

```bash
curl -O https://apps.hud.gov/pub/chums/cy2026-forward-limits.txt
curl -O https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt
python tools/fha-limits/build_fha_limits.py cy2026-forward-limits.txt national_county2020.txt
python -m unittest discover tools/fha-limits      # its own tests
```

It prints the count and the range, `3235 counties in 56 states and territories, $541,287 to $1,299,500`.

## How it works

1. **HUD's file** ([CHUMS file layouts](https://apps.hud.gov/pub/chums/file_layouts.html)) is fixed-width text: two
   header records (the ceiling, then the floor), then one record per county with its state and county codes, the
   area's median price, and the limits for one to four units. The app uses the one-unit limit.
2. **County names** are cut to 15 characters in HUD's file ("WILLIAMSON COUN"), so the full names come from the
   Census Bureau's county list, joined on the state and county FIPS codes. Connecticut's nine planning regions, county
   equivalents since 2022, are newer than that list and are named in the tool. Any other county without a name stops
   the build.
3. **The output** is JSON with one county per line, so a new year's diff reads county by county.

## Files

| File | Purpose |
|---|---|
| `build_fha_limits.py` | The parser, the join and the writer (standard library only) |
| `test_build_fha_limits.py` | Its tests, on real records from the 2026 file |

[All tools](../README.md)
