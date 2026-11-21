import { pathToFileURL } from 'node:url';

const referenceUrl = 'https://pages.ebay.com/usps_geo_based_pricing/';
const isZip = zip => typeof zip === 'string' && /^\d{5}$/.test(zip);

export function readGeoGroups(html) {
  const membership = new Map();
  const counts = {};
  for (const group of ['B', 'C', 'D']) {
    const key = group.toLowerCase();
    const count = html.match(new RegExp('for="tab-geo-' + key + '"[^>]*>\\s*Geo ' + group + '\\s*<span[^>]*>\\(([\\d,]+)\\)'))?.[1];
    const table = html.match(new RegExp('id="panel-geo-' + key + '"[^>]*>\\s*<table[^>]*>([\\s\\S]*?)</table>'))?.[1];
    const zips = [...(table ?? '').matchAll(/<td\b[^>]*>\s*(\d{5})\s*<\/td>/g)].map(match => match[1]);
    if (!count || !zips.length || zips.length !== Number(count.replaceAll(',', ''))) {
      throw new Error('Published Geo ' + group + ' ZIP count does not match the table.');
    }
    counts[group] = zips.length;
    for (const zip of zips) {
      if (membership.has(zip)) throw new Error('Duplicate ZIP in the published geographic groups.');
      membership.set(zip, group);
    }
  }
  return { counts, membership };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const zips = process.argv.slice(2);
    if (!zips.length || !zips.every(isZip)) throw new Error('Usage: node geo-lookup.mjs ZIP [ZIP ...]');
    // The request always uses the same URL. ZIP lookups happen locally.
    const response = await fetch(referenceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('eBay ZIP lookup source returned HTTP ' + response.status + '.');
    const { counts, membership } = readGeoGroups(await response.text());
    console.log(JSON.stringify({
      source: referenceUrl,
      retrievedAt: new Date().toISOString(),
      counts,
      lookups: zips.map(zip => ({ zip, group: membership.get(zip) ?? 'unlisted' })),
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
