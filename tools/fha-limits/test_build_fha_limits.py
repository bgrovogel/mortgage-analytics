import unittest

import json

from build_fha_limits import build, parse_record, to_json

# Two real records from HUD's CY2026 file, and its two header records (the ceiling, then the floor).
CEILING = ' ' * 60 + 'ZZ203S       1249125159937519332002402625'
FLOOR = ' ' * 60 + '203B S       0541287069305008377001041125'


def record(area, limits, state, county, state_name, county_name):
    """A county record laid out as HUD's file is: the area, the program and the limits, the codes, then the names."""
    return area.ljust(60) + limits + state + county + state_name.ljust(26) + county_name.ljust(15) + '        20260101'


BEXAR = record('4170000000SAN ANTONIO-NEW BRAUNFELS, TX', '203B H04690000557750071400008631001072600', 'TX', '029', 'TEXAS', 'BEXAR COUNTY')
CAPITOL = record('2556000000HARTFORD-WEST HARTFORD-EAST HARTFORD, CT', '203B S03300000541287069305008377001041125', 'CT', '110', 'CONNECTICUT', 'CAPITOL PLANNIN')
CENSUS = ['STATE|STATEFP|COUNTYFP|COUNTYNS|COUNTYNAME|CLASSFP|FUNCSTAT',
          'TX|48|029|01383800|Bexar County|H1|A',
          'CT|09|001|00212794|Fairfield County|H4|N']


class BuildFhaLimitsTests(unittest.TestCase):
    def test_a_record_gives_its_state_county_and_one_unit_limit(self):
        record = parse_record(BEXAR)
        self.assertEqual((record['state'], record['county'], record['stateName'], record['oneUnit']), ('TX', '029', 'TEXAS', 557750))

    def test_counties_get_their_full_census_names_and_five_digit_fips_codes(self):
        data = build([CEILING, FLOOR, BEXAR], CENSUS, 2026)
        self.assertEqual(data['counties'], [{'fips': '48029', 'state': 'TX', 'name': 'Bexar County', 'limit': 557750}])
        self.assertEqual((data['floor'], data['ceiling'], data['states']), (541287, 1249125, {'TX': 'Texas'}))

    def test_connecticut_planning_regions_are_named_here(self):
        data = build([CEILING, FLOOR, CAPITOL], CENSUS, 2026)
        self.assertEqual(data['counties'][0], {'fips': '09110', 'state': 'CT', 'name': 'Capitol Planning Region', 'limit': 541287})

    def test_the_file_is_json_with_one_county_per_line(self):
        data = build([CEILING, FLOOR, BEXAR, CAPITOL], CENSUS, 2026)
        text = to_json(data)
        self.assertEqual(json.loads(text), data)
        self.assertIn('    {"fips": "48029", "state": "TX", "name": "Bexar County", "limit": 557750}', text)

    def test_a_county_with_no_name_stops_the_build(self):
        unknown = BEXAR.replace('TX029', 'TX999')
        with self.assertRaisesRegex(ValueError, 'No name'):
            build([CEILING, FLOOR, unknown], CENSUS, 2026)


if __name__ == '__main__':
    unittest.main()
