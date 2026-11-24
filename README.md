# Shipping rate table planner

A browser worksheet for building an eBay regional shipping surcharge table from your own discounted postage quotes. Enter a ship-from ZIP, the marginal selling fee on shipping, packing cost, and a package class. Add destination ZIPs with the exact eBay region or state row and the quoted label price. The worksheet suggests a first-item base and regional surcharges, then shows what customers would pay.

The optional current table and trial base let you check a seasonal base change. Select the eBay table's actual mode: **Surcharge** rows are added to the policy base; **Item** rows are fixed buyer prices and do not rise when only the base changes. Download the worksheet for Seller Hub and the input JSON for your own records. **Load example** shows synthetic numbers.

## Use

Open [the browser planner](https://omning1.github.io/shipping-rate-table-planner/). You can also serve this repository locally with a static web server. For example, run `python3 -m http.server 8732` and open `http://127.0.0.1:8732/`.

For the complete workflow from packed measurements and quotes through eBay's domestic Surcharge editor, buyer checks, and later base edits, follow the [setup guide](SETUP.md). It also explains when eligible books and recordings should use a separate Media Mail policy and why games need Ground Advantage.

Enter one package class for each packed weight ceiling, outer dimensions, and service. Use quotes for the exact package and service you ship. Give each quote a destination ZIP, the eBay table row that covers it, and a label cost. Use tabs to separate fields when a row name contains a comma. The optional fourth field is the historical shipment count for that ZIP. A fifth field can hold eBay's published Geo group: `B`, `C`, `D`, or `unlisted`. The example shows the input format.

Record the date and service used for every quote batch. Refresh quotes after carrier or marketplace price changes, including the end of temporary seasonal pricing. In **Surcharge** mode, editing the first-item base moves every modeled regional buyer charge by the same amount; if postage changes differ by region, recheck the surcharges before reusing the table. In **Item** mode, edit the fixed table rows or move verified listings to a Surcharge-mode table to change regional buyer charges.

The suggested base covers the larger of the baseline quote average and supplied training label average after fees and packing. Each suggested surcharge targets the weighted 90th percentile quote for its table row. For an existing Surcharge table, the current-table section shows the lowest base that would cover sampled row targets with its surcharges. For an existing Item table, enter an absolute price for every quoted row; the trial correctly shows that a base-only edit leaves those prices unchanged. The sampled-ZIP section exposes expensive destinations hidden by a row average and estimates the contribution after the fee and packing assumptions for proposed, current, and trial bases. It shows the 25 worst sampled ZIPs; it is not a complete rural ZIP list. Quotes and held-out label receipts are planning evidence. Verify your saved Seller Hub table and buyer prices before assigning a policy across listings.

The fee-adjusted results are an **economic comparison**, not a statement of what eBay permits you to charge as shipping or handling. [eBay's shipping policy](https://www.ebay.com/help/policies/listing-policies/shipping-policy?id=5035) ties those charges to incurred postage and handling costs; its [shipping setup guide](https://www.ebay.com/help/selling/setting-shipping-options/setting-shipping-options?id=4089) describes calculated handling as covering packing and materials. Enter actual package costs and review buyer charges against that policy. If a calculated rate passes through postage but the selling fee leaves a shortfall, account for it in overall item pricing rather than assuming it is an additional handling cost.

## Check eBay's current Geo ZIP group

With Node.js installed, run `node geo-lookup.mjs 92328 10001 32801` from this repository. The command fetches [eBay's published ZIP reference](https://pages.ebay.com/usps_geo_based_pricing/) once, validates the three published group counts and unique ZIP membership, then reports B, C, D, or `unlisted` for each ZIP you supplied. It keeps leading zeroes and does not send your queried ZIPs to eBay: the matching happens locally after the reference page is downloaded. Run it again when eBay updates the list.

To classify every quote in a saved planner input, run `node geo-annotate.mjs shipping-input.json > geo-input.json`, then open `geo-input.json` in the browser planner. This fetches the same public reference once and adds the current group to each quoted ZIP locally. The output includes the reference retrieval time. The planner then shows shortfalls by Geo group and labels the worst sampled ZIPs. Your input file, ZIPs, label costs, and receipts are not sent with that fetch. Refresh the classification after eBay updates the list.

This helps you find expensive examples to quote and test in the worksheet. It cannot make the flat eBay rate table charge a special amount to one of these ZIP groups; the Seller Hub table editor still selects geographic regions, states, or subdivisions.

## Data and source

The static browser app has no account connection or backend. It reads imported JSON in the browser and runs its calculations locally. Downloaded worksheets stay on your device. The example contains invented prices. Do not upload personal order or buyer data to this repository.

[eBay's rate table guide](https://www.ebay.com/help/selling/shipping-items/using-shipping-rate-tables?id=5459) describes the table setup. eBay's [published geographic ZIP list](https://pages.ebay.com/usps_geo_based_pricing/) helps identify its USPS geographic groups. Those ZIP groups and eBay's selectable table regions are different, and the flat-rate editor does not accept a ZIP list. Use calculated shipping when you need an eBay rate that changes with the destination ZIP.

This is an independent seller tool. eBay and USPS do not endorse it.
