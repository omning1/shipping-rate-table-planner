import { readFile } from 'node:fs/promises';
import { readGeoGroups } from './geo-lookup.mjs';
import { planRates } from './calculator.mjs';

const referenceUrl = 'https://pages.ebay.com/usps_geo_based_pricing/';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node geo-annotate.mjs shipping-input.json > geo-input.json');
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  planRates(input);
  // Only the fixed public reference URL is fetched; input ZIPs stay on this computer.
  const response = await fetch(referenceUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('eBay ZIP reference returned HTTP ' + response.status + '.');
  const { counts, membership } = readGeoGroups(await response.text());
  const enriched = {
    ...input,
    geoReference: { source: referenceUrl, retrievedAt: new Date().toISOString(), counts },
    classes: input.classes.map(entry => ({ ...entry,
      quotes: entry.quotes.map(quote => ({ ...quote, geoGroup: membership.get(quote.zip) ?? 'unlisted' })),
    })),
  };
  planRates(enriched);
  process.stdout.write(JSON.stringify(enriched, null, 2) + '\n');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
