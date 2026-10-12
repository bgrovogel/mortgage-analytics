"""
Builds the app's FHA county loan limits from HUD's own file.

HUD publishes each year's FHA forward mortgage limits for every county as a fixed-width text file
(https://apps.hud.gov/pub/chums/cy2026-forward-limits.txt, listed on https://apps.hud.gov/pub/chums/file_layouts.html).
Its county names are cut to 15 characters ("WILLIAMSON COUN"), so the full names come from the Census Bureau's county
list (https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt), joined on the state and county
FIPS codes. Connecticut's nine planning regions, county equivalents since 2022, are newer than that list and are named
here.

    python tools/fha-limits/build_fha_limits.py cy2026-forward-limits.txt national_county2020.txt

writes src/MortgageAnalytics.Application/Data/fha-loan-limits.json: the year, HUD's floor and ceiling, each state's
name, and each county's one-unit limit, by its five-digit FIPS code.
"""
import json
import pathlib
import sys

OUTPUT = pathlib.Path(__file__).resolve().parents[2] / 'src' / 'MortgageAnalytics.Application' / 'Data' / 'fha-loan-limits.json'

# Connecticut's planning regions (Census county equivalents since June 2022), which the 2020 county list predates.
CONNECTICUT_REGIONS = {
    '110': 'Capitol Planning Region', '120': 'Greater Bridgeport Planning Region',
    '130': 'Lower Connecticut River Valley Planning Region', '140': 'Naugatuck Valley Planning Region',
    '150': 'Northeastern Connecticut Planning Region', '160': 'Northwest Hills Planning Region',
    '170': 'South Central Connecticut Planning Region', '180': 'Southeastern Connecticut Planning Region',
    '190': 'Western Connecticut Planning Region',
}

# Words kept lower case when HUD's upper-case state names are title-cased ("District of Columbia").
SMALL_WORDS = {'of', 'the', 'and'}


def parse_record(line):
    """One county record of HUD's fixed-width file: the state and county codes, the state's name and the limits."""
    return {
        'state': line[101:103],
        'county': line[103:106],
        'stateName': line[106:132].strip(),
        'oneUnit': int(line[73:80]),
    }


def parse_header(line):
    """HUD's first two records: the national ceiling, then the floor, each with its one-unit limit first."""
    return int(line[73:80])


def title(name):
    words = name.lower().split()
    return ' '.join(w if i and w in SMALL_WORDS else w.capitalize() for i, w in enumerate(words))


def build(hud_lines, census_lines, year):
    """The limits file's content, from HUD's lines and the Census list's."""
    names = {}
    header = census_lines[0].split('|')
    for line in census_lines[1:]:
        fields = dict(zip(header, line.split('|')))
        names[(fields['STATE'], fields['COUNTYFP'])] = (fields['STATEFP'], fields['COUNTYNAME'])

    ceiling, floor = parse_header(hud_lines[0]), parse_header(hud_lines[1])
    states, counties = {}, []
    connecticut = next(fp for (st, _), (fp, _) in names.items() if st == 'CT')
    for line in hud_lines[2:]:
        if len(line) < 140:
            continue
        record = parse_record(line)
        key = (record['state'], record['county'])
        if key in names:
            state_fips, county_name = names[key]
        elif record['state'] == 'CT' and record['county'] in CONNECTICUT_REGIONS:
            state_fips, county_name = connecticut, CONNECTICUT_REGIONS[record['county']]
        else:
            raise ValueError(f'No name for {key}: add it, as Connecticut\'s regions are added')
        states[record['state']] = title(record['stateName'])
        counties.append({'fips': state_fips + record['county'], 'state': record['state'], 'name': county_name, 'limit': record['oneUnit']})

    counties.sort(key=lambda c: c['fips'])
    return {
        'year': year,
        'source': f'HUD CY{year} FHA forward mortgage limits (apps.hud.gov/pub/chums/cy{year}-forward-limits.txt), one-unit',
        'floor': floor,
        'ceiling': ceiling,
        'states': dict(sorted(states.items())),
        'counties': counties,
    }


def to_json(data):
    """The file's text: the header fields one per line, then one county per line, so a new year's diff reads by county."""
    head = json.dumps({k: v for k, v in data.items() if k != 'counties'}, indent=2)
    counties = ',\n'.join('    ' + json.dumps(c, separators=(', ', ': ')) for c in data['counties'])
    return head[:-2] + ',\n  "counties": [\n' + counties + '\n  ]\n}\n'


def main(hud_path, census_path):
    hud_lines = pathlib.Path(hud_path).read_text(encoding='latin-1').splitlines()
    census_lines = pathlib.Path(census_path).read_text(encoding='utf-8').splitlines()
    year = int(next(part for part in pathlib.Path(hud_path).stem.split('-') if part.startswith('cy'))[2:])
    data = build(hud_lines, census_lines, year)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(to_json(data), encoding='utf-8')
    print(f"{len(data['counties'])} counties in {len(data['states'])} states and territories, "
          f"${data['floor']:,} to ${max(c['limit'] for c in data['counties']):,}; written to {OUTPUT}")


if __name__ == '__main__':
    main(*sys.argv[1:3])
