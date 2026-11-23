function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function money(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}

function quantile(rows, percentile) {
  const sorted = [...rows].sort((a, b) => a.cents - b.cents);
  const threshold = Math.ceil(sorted.reduce((sum, row) => sum + row.weight, 0) * percentile / 100);
  let count = 0;
  return sorted.find(row => (count += row.weight) >= threshold).cents;
}

function average(rows) {
  return rows.length ? rows.reduce((sum, row) => sum + row.cents * row.weight, 0) /
    rows.reduce((sum, row) => sum + row.weight, 0) : null;
}

export function planRates(input) {
  const { originZip, feeBps, incrementCents = 25, classes } = input;
  requireValue(typeof originZip === 'string' && /^\d{5}$/.test(originZip), 'Origin ZIP must contain five digits.');
  requireValue(Number.isInteger(feeBps) && feeBps >= 0 && feeBps < 10_000, 'Fee basis points must be in [0, 10000).');
  requireValue(money(incrementCents) && incrementCents > 0, 'A positive rounding increment is required.');
  requireValue(Array.isArray(classes) && classes.length && new Set(classes.map(c => c.name)).size === classes.length,
    'Package classes must have distinct names.');
  const keepBps = 10_000 - feeBps;
  const gross = (cost, packing) => Math.ceil((cost + packing) * 10_000 / keepBps);
  const round = value => Math.ceil(value / incrementCents) * incrementCents;

  const seenReceipts = new Set();
  return { originZip, feeBps, incrementCents, classes: classes.map(entry => {
    const { name, packingCents, baselineRow, baselineZips, quotes, receiptBaselines = [], holdout = [],
      current = null, candidateBaseCents } = entry;
    requireValue(typeof name === 'string' && name.trim() && money(packingCents), 'A class name and packing cost are required.');
    requireValue(Array.isArray(quotes) && quotes.length > 0 && quotes.length <= 50_000, `${name}: supply current quotes.`);
    const zipSet = new Set();
    const byRegion = new Map();
    for (const { zip, region, cents, weight = 1, geoGroup } of quotes) {
      requireValue(typeof zip === 'string' && /^\d{5}$/.test(zip) && !zipSet.has(zip) &&
        typeof region === 'string' && region.trim() && money(cents) && cents > 0 &&
        Number.isSafeInteger(weight) && weight > 0 && weight <= 100_000 &&
        (geoGroup === undefined || ['B', 'C', 'D', 'unlisted'].includes(geoGroup)),
      `${name}: invalid or duplicate quote.`);
      zipSet.add(zip);
      const regionQuotes = byRegion.get(region) ?? [];
      regionQuotes.push({ zip, cents, weight, geoGroup });
      byRegion.set(region, regionQuotes);
    }
    const baselineRegion = byRegion.get(baselineRow);
    requireValue(baselineRegion, `${name}: baseline row has no quote evidence.`);
    const baseline = baselineZips === undefined
      ? baselineRegion
      : baselineRegion.filter(quote => Array.isArray(baselineZips) && baselineZips.includes(quote.zip));
    requireValue(baseline.length > 0 && (baselineZips === undefined || baseline.length === baselineZips.length),
      `${name}: baseline ZIPs must be distinct quotes inside the baseline row.`);
    const validateReceipts = (rows, seen) => {
      requireValue(Array.isArray(rows), `${name}: receipts must be an array.`);
      for (const receipt of rows) {
        requireValue(typeof receipt.id === 'string' && receipt.id.trim() && !seen.has(receipt.id) &&
          byRegion.has(receipt.region) && money(receipt.cents) && receipt.cents > 0,
        `${name}: invalid, unmatched, or duplicate receipt.`);
        seen.add(receipt.id);
      }
    };
    validateReceipts(receiptBaselines, seenReceipts);
    validateReceipts(holdout, seenReceipts);
    requireValue(receiptBaselines.every(r => r.region === baselineRow &&
      (baselineZips === undefined || baselineZips.includes(r.zip))),
      `${name}: baseline receipts must match the baseline destination.`);
    const baselineQuoteCents = average(baseline);
    const baselineReceiptCents = average(receiptBaselines.map(r => ({ ...r, weight: 1 })));
    const suggestedBaseCents = round(gross(Math.max(baselineQuoteCents, baselineReceiptCents ?? 0), packingCents));
    const currentMode = current?.mode ?? 'surcharge';
    const currentCosts = current === null ? null : currentMode === 'item' ? current.itemCents : current.surchargeCents;
    if (current !== null) {
      requireValue(money(current.baseCents) && (currentMode === 'item' || currentMode === 'surcharge') &&
        currentCosts && typeof currentCosts === 'object' && !Array.isArray(currentCosts) &&
        Object.entries(currentCosts).every(([region, cost]) => byRegion.has(region) && money(cost)) &&
        (currentMode !== 'item' || [...byRegion.keys()].every(region => Object.hasOwn(currentCosts, region))),
      `${name}: invalid current base or ${currentMode === 'item' ? 'fixed Item rates; supply every quoted row' : 'surcharge rows'}.`);
    }
    requireValue(candidateBaseCents === undefined || (current !== null && money(candidateBaseCents)),
      `${name}: a trial base requires valid cents and the current table.`);
    const currentRates = current === null ? null : new Map(Object.entries(currentCosts));
    const currentCharge = (base, region) => currentMode === 'item'
      ? currentRates.get(region) : base + (currentRates.get(region) ?? 0);
    const regions = [...byRegion].map(([region, samples]) => {
      const p90QuoteCents = quantile(samples, 90);
      const target = gross(p90QuoteCents, packingCents);
      const surcharge = round(Math.max(0, target - suggestedBaseCents));
      return { region, quoteCount: samples.length, weightedMeanCents: Math.round(average(samples)), p90QuoteCents, surchargeCents: surcharge,
        maxPremiumAtSuggestedChargeCents: suggestedBaseCents + surcharge - gross(samples.reduce((min, row) => Math.min(min, row.cents), Infinity), packingCents),
        buyerChargeCents: suggestedBaseCents + surcharge,
        changeNeededWithBaseOnly: current === null ? null : currentCharge(suggestedBaseCents, region) < target };
    });
    function backtest(baseCents, rates, mode = 'surcharge') {
      if (!holdout.length) return null;
      const margins = holdout.map(receipt => {
        const charge = mode === 'item' ? rates.get(receipt.region) : baseCents + (rates.get(receipt.region) ?? 0);
        const net = Math.floor(charge * keepBps / 10_000);
        return { margin: net - receipt.cents - packingCents, premium: charge - gross(receipt.cents, packingCents) };
      });
      const totalMarginCents = margins.reduce((sum, row) => sum + row.margin, 0);
      const covered = margins.filter(row => row.margin >= 0).length;
      const premiums = margins.map(row => row.premium).sort((a, b) => a - b);
      const medianPremiumCents = (premiums[Math.floor((premiums.length - 1) / 2)] + premiums[Math.floor(premiums.length / 2)]) / 2;
      return { count: margins.length, covered, totalMarginCents, medianPremiumCents,
        largestShortfallCents: margins.reduce((worst, row) => Math.max(worst, -row.margin), 0),
        meetsThresholds: totalMarginCents >= 0 && covered * 10 >= margins.length * 9 && Math.abs(medianPremiumCents) <= 100 };
    }
    const minimumBaseForQuoteTargetsCents = current === null || currentMode === 'item' ? null : round(Math.max(0, ...regions.map(row =>
      gross(row.p90QuoteCents, packingCents) - (currentRates.get(row.region) ?? 0))));
    const trialRows = candidateBaseCents === undefined ? null : regions.map(row => {
      const existingRateCents = currentRates.get(row.region) ?? 0;
      const buyerChargeCents = currentCharge(candidateBaseCents, row.region);
      return { region: row.region, existingRateCents, buyerChargeCents,
        quoteTargetShortfallCents: Math.max(0, gross(row.p90QuoteCents, packingCents) - buyerChargeCents) };
    });
    const proposedSurcharges = new Map(regions.map(row => [row.region, row.surchargeCents]));
    const exposureRows = quotes.map(({ zip, region, cents, weight = 1, geoGroup }) => {
      const contribution = charge => Math.floor(charge * keepBps / 10_000) - cents - packingCents;
      const proposedCharge = suggestedBaseCents + proposedSurcharges.get(region);
      const currentBuyerCharge = current === null ? null : currentCharge(current.baseCents, region);
      const trialCharge = candidateBaseCents === undefined ? null : currentCharge(candidateBaseCents, region);
      return { zip, region, weight, geoGroup: geoGroup ?? null, labelCents: cents, proposedBuyerChargeCents: proposedCharge,
        proposedContributionCents: contribution(proposedCharge),
        currentBuyerChargeCents: currentBuyerCharge,
        currentContributionCents: currentBuyerCharge === null ? null : contribution(currentBuyerCharge),
        trialBuyerChargeCents: trialCharge,
        trialContributionCents: trialCharge === null ? null : contribution(trialCharge) };
    });
    const geoGroups = ['unlisted', 'B', 'C', 'D'].flatMap(group => {
      const rows = exposureRows.filter(row => row.geoGroup === group);
      if (!rows.length) return [];
      const undercovered = key => rows.filter(row => row[key] < 0).length;
      return [{ group, quoteCount: rows.length, weightedCount: rows.reduce((sum, row) => sum + row.weight, 0),
        weightedMeanLabelCents: Math.round(average(rows.map(row => ({ cents: row.labelCents, weight: row.weight })))),
        undercoveredProposed: undercovered('proposedContributionCents'),
        undercoveredCurrent: current === null ? null : undercovered('currentContributionCents'),
        undercoveredTrial: candidateBaseCents === undefined ? null : undercovered('trialContributionCents'),
        worstCurrentShortfallCents: current === null ? null : Math.max(0, ...rows.map(row => -row.currentContributionCents)) }];
    });
    const sampleExposure = {
      quoteCount: exposureRows.length,
      geoGroups,
      undercoveredProposed: exposureRows.filter(row => row.proposedContributionCents < 0).length,
      undercoveredCurrent: current === null ? null : exposureRows.filter(row => row.currentContributionCents < 0).length,
      undercoveredTrial: candidateBaseCents === undefined ? null : exposureRows.filter(row => row.trialContributionCents < 0).length,
      worst: exposureRows.sort((a, b) => Math.min(a.proposedContributionCents, a.currentContributionCents ?? Infinity,
        a.trialContributionCents ?? Infinity) - Math.min(b.proposedContributionCents, b.currentContributionCents ?? Infinity,
        b.trialContributionCents ?? Infinity)).slice(0, 25),
    };
    return { name, baselineRow, currentMode: current === null ? null : currentMode, baselineQuoteCents: Math.round(baselineQuoteCents),
      baselineReceiptCents: baselineReceiptCents === null ? null : Math.round(baselineReceiptCents),
      suggestedBaseCents, regions, sampleExposure, minimumBaseForQuoteTargetsCents,
      proposedBacktest: backtest(suggestedBaseCents, new Map(regions.map(row => [row.region, row.surchargeCents]))),
      baseOnlyBacktest: current === null ? null : backtest(suggestedBaseCents, currentRates, currentMode),
      currentBacktest: current === null ? null : backtest(current.baseCents, currentRates, currentMode),
      ...(trialRows && { baseChangeTrial: {
        baseCents: candidateBaseCents, differenceCents: candidateBaseCents - current.baseCents,
        baseEditMovesRates: currentMode === 'surcharge',
        regions: trialRows, backtest: backtest(candidateBaseCents, currentRates, currentMode),
      } }) };
  }) };
}

export function renderSellerHubGuide(plan) {
  const dollars = cents => cents < 0 ? `-$${(-cents / 100).toFixed(2)}` : `$${(cents / 100).toFixed(2)}`;
  const label = value => value.replace(/[\r\n\t]+/g, ' ').replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;');
  const lines = ['# eBay shipping rate worksheet', '',
    `Origin ZIP **${plan.originZip}** · Shipping fee assumption **${plan.feeBps / 100}%**`, '',
    'Planning calculations for manual entry. Verify the actual eBay destination rows and buyer prices before applying a policy.', ''];
  for (const c of plan.classes) {
    lines.push(`## ${label(c.name)}`, '',
      `Suggested policy base **${dollars(c.suggestedBaseCents)}**`, '',
      '| eBay destination row | Surcharge to enter | Estimated buyer charge |', '| --- | ---: | ---: |');
    for (const row of c.regions) {
      lines.push(`| ${label(row.region)} | ${dollars(row.surchargeCents)} | ${dollars(row.buyerChargeCents)} |`);
    }
    lines.push('', c.proposedBacktest
      ? `Held-out receipts covered **${c.proposedBacktest.covered}/${c.proposedBacktest.count}**. Screening thresholds ${c.proposedBacktest.meetsThresholds ? 'met' : 'missed'}.`
      : 'No held-out receipts supplied. Coverage remains unverified.', '');
    if (c.currentMode === 'item') lines.push('The existing eBay table uses fixed Item rates. Editing only its policy base leaves these quoted regional buyer charges unchanged. Save a Surcharge-mode table or update the Item rows to change them.', '');
    const exposure = c.sampleExposure;
    if (exposure.geoGroups.length) {
      lines.push('### eBay published Geo group exposure', '',
        '| Geo group | Quoted ZIPs | Mean quoted postage | Proposed shortfalls | Current shortfalls |',
        '| --- | ---: | ---: | ---: | ---: |');
      for (const row of exposure.geoGroups) {
        lines.push(`| ${row.group} | ${row.quoteCount} | ${dollars(row.weightedMeanLabelCents)} | ${row.undercoveredProposed}/${row.quoteCount} | ${row.undercoveredCurrent === null ? '—' : `${row.undercoveredCurrent}/${row.quoteCount}`} |`);
      }
      lines.push('', 'Geo groups describe eBay’s published ZIP reference, not selectable flat-table rows. A group with sampled shortfalls needs more ZIP quotes or calculated shipping before assigning this policy broadly.', '');
    }
    lines.push(`### Most exposed sampled ZIPs (${exposure.worst.length} of ${exposure.quoteCount})`, '',
      `Estimated shortfalls after the fee and packing assumption: proposed ${exposure.undercoveredProposed}/${exposure.quoteCount}` +
      (exposure.undercoveredCurrent === null ? '' : `; current ${exposure.undercoveredCurrent}/${exposure.quoteCount}`) +
      (exposure.undercoveredTrial === null ? '' : `; trial ${exposure.undercoveredTrial}/${exposure.quoteCount}`) + '.', '',
      '| ZIP | Geo group | eBay row | Label quote | Proposed buyer charge | Proposed contribution |' +
      (exposure.undercoveredCurrent === null ? '' : ' Current buyer charge | Current contribution |') +
      (exposure.undercoveredTrial === null ? '' : ' Trial buyer charge | Trial contribution |'),
      '| --- | --- | --- | ---: | ---: | ---: |' +
      (exposure.undercoveredCurrent === null ? '' : ' ---: | ---: |') +
      (exposure.undercoveredTrial === null ? '' : ' ---: | ---: |'));
    for (const row of exposure.worst) {
      lines.push(`| ${row.zip} | ${row.geoGroup ?? 'not checked'} | ${label(row.region)} | ${dollars(row.labelCents)} | ${dollars(row.proposedBuyerChargeCents)} | ${dollars(row.proposedContributionCents)} |` +
        (row.currentContributionCents === null ? '' : ` ${dollars(row.currentBuyerChargeCents)} | ${dollars(row.currentContributionCents)} |`) +
        (row.trialContributionCents === null ? '' : ` ${dollars(row.trialBuyerChargeCents)} | ${dollars(row.trialContributionCents)} |`));
    }
    lines.push('', 'These are sampled postage quotes, not actual paid labels or a complete rural ZIP inventory.', '');
    if (c.minimumBaseForQuoteTargetsCents !== null) {
      lines.push(`Lowest base on the selected rounding increment that covers every quoted row target with existing surcharges **${dollars(c.minimumBaseForQuoteTargetsCents)}**`, '');
    }
    if (c.baseChangeTrial) {
      const t = c.baseChangeTrial;
      lines.push(`### Trial base ${dollars(t.baseCents)} (change of ${dollars(t.differenceCents)})`, '',
        `| eBay destination row | Existing ${c.currentMode === 'item' ? 'fixed Item rate' : 'surcharge'} | Estimated buyer charge | Below quoted target by |`,
        '| --- | ---: | ---: | ---: |');
      for (const row of t.regions) {
        lines.push(`| ${label(row.region)} | ${dollars(row.existingRateCents)} | ${dollars(row.buyerChargeCents)} | ${dollars(row.quoteTargetShortfallCents)} |`);
      }
      lines.push('', t.backtest
        ? `Trial covers **${t.backtest.covered}/${t.backtest.count}** held-out receipts. Screening thresholds ${t.backtest.meetsThresholds ? 'met' : 'missed'}.`
        : 'The trial has no held-out receipt check.', '');
    }
  }
  return lines.join('\n');
}
