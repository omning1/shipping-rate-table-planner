import assert from 'node:assert/strict';
import { planRates, renderSellerHubGuide } from './calculator.mjs';

const source = {
  originZip: '32810', feeBps: 1270,
  classes: [{
    name: '8 oz mailer', packingCents: 25, baselineRow: 'Florida',
    quotes: [
      { zip: '32801', region: 'Florida', cents: 573, geoGroup: 'unlisted' },
      { zip: '92328', region: 'California', cents: 895, geoGroup: 'D' },
    ],
    holdout: [{ id: 'label-1', zip: '92328', region: 'California', cents: 895 }],
    candidateBaseCents: 700,
  }],
};

const fixed = planRates({ ...source, classes: [{ ...source.classes[0],
  current: { mode: 'item', baseCents: 595, itemCents: { Florida: 595, California: 1000 } },
}] }).classes[0];
assert.equal(fixed.currentMode, 'item');
assert.equal(fixed.minimumBaseForQuoteTargetsCents, null);
assert.equal(fixed.baseChangeTrial.baseEditMovesRates, false);
assert.equal(fixed.baseChangeTrial.regions.find(r => r.region === 'Florida').buyerChargeCents, 595);
assert.equal(fixed.baseChangeTrial.regions.find(r => r.region === 'California').buyerChargeCents, 1000);
assert.equal(fixed.currentBacktest.totalMarginCents, fixed.baseChangeTrial.backtest.totalMarginCents);
assert.equal(fixed.sampleExposure.worst.find(r => r.zip === '92328').trialBuyerChargeCents, 1000);
assert.match(renderSellerHubGuide({ originZip: '32810', feeBps: 1270, classes: [fixed] }),
  /Editing only its policy base leaves these quoted regional buyer charges unchanged/);

const surcharge = planRates({ ...source, classes: [{ ...source.classes[0],
  current: { mode: 'surcharge', baseCents: 595, surchargeCents: { Florida: 0, California: 405 } },
}] }).classes[0];
assert.equal(surcharge.baseChangeTrial.baseEditMovesRates, true);
assert.equal(surcharge.baseChangeTrial.regions.find(r => r.region === 'Florida').buyerChargeCents, 700);
assert.equal(surcharge.baseChangeTrial.regions.find(r => r.region === 'California').buyerChargeCents, 1105);
assert.deepEqual(surcharge.sampleExposure.geoGroups.map(row => [row.group, row.quoteCount, row.undercoveredCurrent]),
  [['unlisted', 1, 1], ['D', 1, 1]]);
assert.equal(surcharge.sampleExposure.geoGroups.find(row => row.group === 'D').worstCurrentShortfallCents, 47);
assert.match(renderSellerHubGuide({ originZip: '32810', feeBps: 1270, classes: [surcharge] }),
  /Geo group exposure[\s\S]*\| D \| 1 \|/);

assert.throws(() => planRates({ ...source, classes: [{ ...source.classes[0],
  current: { mode: 'item', baseCents: 595, itemCents: { Florida: 595 } },
}] }), /supply every quoted row/);
assert.throws(() => planRates({ ...source, classes: [{ ...source.classes[0],
  quotes: [{ zip: '32801', region: 'Florida', cents: 573, geoGroup: 'Z' }],
}] }), /invalid or duplicate quote/);

console.log('Item and Surcharge modes, Geo group exposure, and input validation passed.');
