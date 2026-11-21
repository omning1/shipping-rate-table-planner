# Shipping rate table planner

A browser worksheet for building an eBay regional shipping surcharge table from your own discounted postage quotes. Enter a ship-from ZIP, the marginal selling fee on shipping, packing cost, and a package class. Add destination ZIPs with the exact eBay region or state row and the quoted label price. The worksheet suggests a first-item base and regional surcharges, then shows what customers would pay.

The optional current table and trial base let you check a seasonal base change without rewriting the regional rows. Download the worksheet for Seller Hub and the input JSON for your own records. **Load example** shows synthetic numbers.

## Use

Open [the browser planner](https://omning1.github.io/shipping-rate-table-planner/). You can also serve these four files locally with a static web server. For example, run `python3 -m http.server 8732` and open `http://127.0.0.1:8732/`.

Enter one package class for each packed weight ceiling, outer dimensions, and service. Use quotes for the exact package and service you ship. Give each quote a destination ZIP, the eBay table row that covers it, and a label cost. Use tabs to separate fields when a row name contains a comma. The optional fourth field is the historical shipment count for that ZIP. The example shows the input format.

The suggested base covers the larger of the baseline quote average and supplied training label average after fees and packing. Each suggested surcharge targets the weighted 90th percentile quote for its table row. The current-table section shows the lowest base that would cover those sampled row targets with your existing surcharges. The sampled-ZIP section exposes expensive destinations hidden by a row average and estimates the contribution after the fee and packing assumptions for proposed, current, and trial bases. It shows the 25 worst sampled ZIPs; it is not a complete rural ZIP list. Quotes and held-out label receipts are planning evidence. Verify your saved Seller Hub table and buyer prices before assigning a policy across listings.

The fee-adjusted results are an **economic comparison**, not a statement of what eBay permits you to charge as shipping or handling. [eBay's shipping policy](https://www.ebay.com/help/policies/listing-policies/shipping-policy?id=5035) ties those charges to incurred postage and handling costs; its [shipping setup guide](https://www.ebay.com/help/selling/setting-shipping-options/setting-shipping-options?id=4089) describes calculated handling as covering packing and materials. Enter actual package costs and review buyer charges against that policy. If a calculated rate passes through postage but the selling fee leaves a shortfall, account for it in overall item pricing rather than assuming it is an additional handling cost.

## Data and source

The four-file browser app has no account connection or backend. It reads imported JSON in the browser and runs its calculations locally. Downloaded worksheets stay on your device. The example contains invented prices. Do not upload personal order or buyer data to this repository.

[eBay's rate table guide](https://www.ebay.com/help/selling/shipping-items/using-shipping-rate-tables?id=5459) describes the table setup. eBay's [published geographic ZIP list](https://pages.ebay.com/usps_geo_based_pricing/) helps identify its USPS geographic groups. Those ZIP groups and eBay's selectable table regions are different, and the flat-rate editor does not accept a ZIP list. Use calculated shipping when you need an eBay rate that changes with the destination ZIP.

This is an independent seller tool. eBay and USPS do not endorse it.
