import assert from 'node:assert/strict';
import test from 'node:test';
import { readGeoGroups } from './geo-lookup.mjs';

function fixture(cZip = '12345', cCount = 1) {
  return [['B', '01002', 1], ['C', cZip, cCount], ['D', '92328', 1]].map(([group, zip, count]) => {
    const key = group.toLowerCase();
    return '<label for="tab-geo-' + key + '">Geo ' + group + ' <span>(' + count + ')</span></label>' +
      '<div id="panel-geo-' + key + '"><table><tr><td>' + zip + '</td></tr></table></div>';
  }).join('');
}

test('keeps leading zeroes and validates published ZIP counts and unique membership', () => {
  const { counts, membership } = readGeoGroups(fixture());
  assert.deepEqual(counts, { B: 1, C: 1, D: 1 });
  assert.equal(membership.get('01002'), 'B');
  assert.equal(membership.get('09012'), undefined);
  assert.throws(() => readGeoGroups(fixture('12345', 2)), /Geo C ZIP count/);
  assert.throws(() => readGeoGroups(fixture('01002')), /Duplicate ZIP/);
});
