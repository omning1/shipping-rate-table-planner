import { planRates, renderSellerHubGuide } from './calculator.mjs';

const byId = id => document.getElementById(id);
const form = byId('planner');
const packages = byId('packages');
const template = byId('package-template');
const results = byId('results');
const output = byId('plan-output');
const problem = byId('calculation-error');
const importError = byId('import-error');
const importedReceipts = new WeakMap();
let latest;

const dollars = cents => cents < 0 ? '-$' + (-cents / 100).toFixed(2) : '$' + (cents / 100).toFixed(2);
const field = (scope, name) => scope.querySelector('[name="' + name + '"]');

function cents(value, label) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(label + ' needs an amount with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function parseLines(value, label, parse) {
  return value.trim().split(/\r?\n/).flatMap((line, i) => {
    if (!line.trim()) return [];
    const delimiter = line.includes('\t') ? '\t' : ',';
    return [parse(line.split(delimiter).map(cell => cell.trim()), label + ', line ' + (i + 1))];
  });
}

function invalidate() {
  latest = undefined;
  results.hidden = true;
  problem.textContent = '';
}

function updateRemoveButtons() {
  packages.querySelectorAll('.remove').forEach(button => {
    button.disabled = packages.children.length === 1;
  });
}

function addPackage(entry = {}) {
  const section = template.content.firstElementChild.cloneNode(true);
  const put = (name, value) => { field(section, name).value = value ?? ''; };
  put('className', entry.name);
  put('packing', (entry.packingCents ?? 25) / 100);
  put('baseline', entry.baselineRow);
  put('baselineZips', entry.baselineZips?.join(', '));
  put('quotes', entry.quotes?.map(({ zip, region, cents: cost, weight }) =>
    [zip, region, (cost / 100).toFixed(2), ...(weight === undefined ? [] : [weight])].join('\t')).join('\n'));
  if (entry.current) {
    put('currentBase', entry.current.baseCents / 100);
    put('trialBase', entry.candidateBaseCents === undefined ? '' : entry.candidateBaseCents / 100);
    put('surcharges', Object.entries(entry.current.surchargeCents).map(([region, cost]) =>
      [region, (cost / 100).toFixed(2)].join('\t')).join('\n'));
    section.querySelector('details').open = true;
  }
  if (entry.receiptBaselines?.length || entry.holdout?.length) {
    importedReceipts.set(section, { receiptBaselines: entry.receiptBaselines, holdout: entry.holdout });
    const notice = section.querySelector('.receipt-info');
    notice.hidden = false;
    notice.textContent = 'Imported label evidence is included. Use a new package class if you change the packed size or service.';
  }
  section.querySelector('.remove').addEventListener('click', () => {
    section.remove();
    updateRemoveButtons();
    invalidate();
    byId('add').focus();
  });
  packages.append(section);
  updateRemoveButtons();
  return section;
}

function readPackage(section) {
  const read = name => field(section, name).value.trim();
  const name = read('className');
  const quotes = parseLines(read('quotes'), name, (cells, description) => {
    if (cells.length < 3 || cells.length > 4) throw new Error(description + ' needs ZIP, row and postage.');
    const [zip, region, cost, weight] = cells;
    return { zip, region, cents: cents(cost, description), ...(weight && { weight: Number(weight) }) };
  });
  const baselineZips = read('baselineZips').split(/[\s,]+/).filter(Boolean);
  const current = read('currentBase');
  const trial = read('trialBase');
  const surchargeText = read('surcharges');
  const entry = {
    name, packingCents: cents(read('packing'), name + ' packing'),
    baselineRow: read('baseline'), quotes, ...importedReceipts.get(section),
  };
  if (baselineZips.length) entry.baselineZips = baselineZips;
  if (!current && (surchargeText || trial)) throw new Error(name + ' needs a current base to compare the existing table.');
  if (current) {
    const pairs = parseLines(surchargeText, name + ' surcharges', (cells, description) => {
      if (cells.length !== 2) throw new Error(description + ' needs the eBay row and surcharge.');
      return [cells[0], cents(cells[1], description)];
    });
    if (new Set(pairs.map(([region]) => region)).size !== pairs.length) {
      throw new Error(name + ' has duplicate surcharge rows.');
    }
    entry.current = { baseCents: cents(current, 'Current base'), surchargeCents: Object.fromEntries(pairs) };
  }
  if (trial) entry.candidateBaseCents = cents(trial, 'Trial base');
  return entry;
}

function readInput() {
  return {
    originZip: field(form, 'origin').value.trim(),
    feeBps: cents(field(form, 'fee').value, 'eBay fee'),
    incrementCents: cents(field(form, 'increment').value, 'Rounding increment'),
    classes: Array.from(packages.children, readPackage),
  };
}

function loadInput(input) {
  planRates(input);
  field(form, 'origin').value = input.originZip;
  field(form, 'fee').value = input.feeBps / 100;
  field(form, 'increment').value = (input.incrementCents ?? 25) / 100;
  packages.replaceChildren();
  input.classes.forEach(addPackage);
  invalidate();
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function table(labels, rows) {
  const wrapper = element('div');
  wrapper.className = 'table-wrap';
  const content = element('table');
  const heading = content.createTHead().insertRow();
  for (const label of labels) {
    const cell = element('th', label);
    cell.scope = 'col';
    heading.append(cell);
  }
  const body = content.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const [index, value] of values.entries()) {
      const cell = element(index === 0 ? 'th' : 'td', value);
      if (index === 0) cell.scope = 'row';
      row.append(cell);
    }
  }
  wrapper.append(content);
  return wrapper;
}

function showPlan(plan) {
  output.replaceChildren();
  for (const group of plan.classes) {
    const section = element('div');
    section.className = 'result-class';
    section.append(element('h3', group.name), element('p', 'Suggested base ' + dollars(group.suggestedBaseCents)));
    section.append(table(['eBay row', 'Quotes', 'Average label', 'Surcharge', 'Buyer pays'], group.regions.map(row => [
      row.region, row.quoteCount, dollars(row.weightedMeanCents), dollars(row.surchargeCents), dollars(row.buyerChargeCents),
    ])));
    const tested = group.proposedBacktest;
    section.append(element('p', tested
      ? 'Proposed rates cover ' + tested.covered + '/' + tested.count + ' held-out labels.'
      : 'Coverage is based on quotes. Add actual label evidence with the input JSON to check real costs.'));
    const exposure = group.sampleExposure;
    section.append(element('h4', 'Most exposed sampled ZIPs'),
      element('p', 'Estimated shortfalls after fees and packing: proposed ' + exposure.undercoveredProposed + '/' + exposure.quoteCount +
        (exposure.undercoveredCurrent === null ? '' : ', current ' + exposure.undercoveredCurrent + '/' + exposure.quoteCount) +
        (exposure.undercoveredTrial === null ? '' : ', trial ' + exposure.undercoveredTrial + '/' + exposure.quoteCount) +
        '. Showing the 25 worst sampled ZIPs at most. Quotes are not paid labels or a complete rural ZIP inventory.'));
    const quoteHeaders = ['ZIP', 'eBay row', 'Label quote', 'Proposed buyer pays', 'Proposed after costs'];
    if (exposure.undercoveredCurrent !== null) quoteHeaders.push('Current buyer pays', 'Current after costs');
    if (exposure.undercoveredTrial !== null) quoteHeaders.push('Trial buyer pays', 'Trial after costs');
    section.append(table(quoteHeaders, exposure.worst.map(row => {
      const cells = [row.zip, row.region, dollars(row.labelCents), dollars(row.proposedBuyerChargeCents),
        dollars(row.proposedContributionCents)];
      if (row.currentContributionCents !== null) cells.push(dollars(row.currentBuyerChargeCents), dollars(row.currentContributionCents));
      if (row.trialContributionCents !== null) cells.push(dollars(row.trialBuyerChargeCents), dollars(row.trialContributionCents));
      return cells;
    })));
    if (group.minimumBaseForQuoteTargetsCents !== null) {
      section.append(element('p', 'Base needed to reach all sampled 90th-percentile targets with existing surcharges ' +
        dollars(group.minimumBaseForQuoteTargetsCents)));
    }
    const trial = group.baseChangeTrial;
    if (trial) {
      section.append(element('h4', 'Trial base ' + dollars(trial.baseCents)),
        table(['eBay row', 'Current surcharge', 'Buyer pays', 'Below target by'], trial.regions.map(row => [
          row.region, dollars(row.surchargeCents), dollars(row.buyerChargeCents), dollars(row.quoteTargetShortfallCents),
        ])));
    }
    output.append(section);
  }
  results.hidden = false;
  results.tabIndex = -1;
  results.focus();
}

function save(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = element('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

form.addEventListener('input', invalidate);
form.addEventListener('submit', event => {
  event.preventDefault();
  invalidate();
  try {
    const input = readInput();
    const plan = planRates(input);
    latest = { input, plan };
    showPlan(plan);
  } catch (error) {
    problem.textContent = error.message;
  }
});
byId('add').addEventListener('click', () => {
  invalidate();
  field(addPackage(), 'className').focus();
});
byId('import').addEventListener('change', async event => {
  importError.textContent = '';
  const [file] = event.target.files;
  if (!file) return;
  try {
    loadInput(JSON.parse(await file.text()));
  } catch (error) {
    importError.textContent = 'Could not open input: ' + error.message;
  } finally {
    event.target.value = '';
  }
});
byId('example').addEventListener('click', () => {
  importError.textContent = '';
  loadInput({
    originZip: '44114', feeBps: 1300,
    classes: [{
      name: 'Example 1 lb · 8 × 6 × 4 in box', packingCents: 25, baselineRow: 'Ohio',
      quotes: [
        { zip: '44114', region: 'Ohio', cents: 600, weight: 8 },
        { zip: '43215', region: 'Ohio', cents: 610, weight: 2 },
        { zip: '90012', region: 'California', cents: 800, weight: 9 },
        { zip: '92328', region: 'California', cents: 1100, weight: 1 },
      ],
      current: { baseCents: 700, surchargeCents: { California: 100 } },
      candidateBaseCents: 750,
    }],
  });
  field(form, 'origin').focus();
});
byId('save-input').addEventListener('click', () => {
  if (latest) save('shipping-input.json', JSON.stringify(latest.input, null, 2), 'application/json');
});
byId('save-plan').addEventListener('click', () => {
  if (latest) save('seller-hub-shipping-worksheet.md', renderSellerHubGuide(latest.plan), 'text/markdown');
});
addPackage();
