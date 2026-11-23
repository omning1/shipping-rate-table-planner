# Set up an eBay shipping rate table from your own costs

This guide works with the [Shipping Rate Table Planner](https://omning1.github.io/shipping-rate-table-planner/). The planner runs in your browser, uses your own postage quotes, and produces a worksheet for eBay's editor. It does not connect to your eBay account or change a listing.

## 1. Define one packed package class

Use a **fully packed** weight ceiling, outer length × width × height, and one shipping service. Include the mailer or box, tape, padding, and inserts. Make another class when a parcel can cross a weight or dimension price boundary. Record your actual average packing-material cost for that class. Keep unusual shapes separate.

If you plan to use eBay's **calculated** shipping instead, eBay uses the listing's package weight, dimensions, buyer location, and selected service to calculate what the buyer sees. Accurate package details still matter. [eBay's shipping-calculator instructions](https://www.ebay.com/help/shipping-items/selling/using-shipping-calculator/setting-shipping-options?id=4178) describe this flow.

## 2. Collect comparable postage quotes

In [eBay's shipping calculator](https://www.ebay.com/shp/calc/rates), enter your ship-from ZIP and the exact packed class. Choose the same service for every route, and record the **discounted label price** you expect to buy, not the retail comparison price. Record the quote date. Use a mix of destinations you actually ship to, plus expensive test ZIPs within the same state or region. Include Florida or another nearby baseline, other continental regions, Alaska, Hawaii, Puerto Rico, and an APO/FPO destination when you serve them. Those lanes can behave differently.

For each destination, enter the exact row name you can select in your eBay rate table. **USPS zones, eBay table regions, and eBay's Geo B/C/D ZIP groups are different classifications.** You can use `node geo-lookup.mjs ZIP...` or `node geo-annotate.mjs input.json > annotated.json` to label public test ZIPs against [eBay's current Geo list](https://pages.ebay.com/usps_geo_based_pricing/) locally. A Geo label helps test expensive ZIPs; eBay's flat domestic table does not provide a ZIP or Geo-group row in the seller editor.

Keep historical purchased-label costs separate from new quotes. Use comparable labels with credible packed profiles to check your assumptions. A deliberately selected set of difficult ZIPs reveals downside exposure but is not your expected future loss rate.

## 3. Build and review the proposed table

Open the [planner](https://omning1.github.io/shipping-rate-table-planner/), enter your origin ZIP, estimated marginal eBay fee on buyer shipping, rounding increment, package class, packing cost, baseline row, and quotes. Add optional shipment counts when you know your actual destination mix. **Load example** demonstrates the format using invented data.

The planner suggests a first-item base and each regional surcharge. Review the displayed **buyer total** and sampled-ZIP shortfalls, not just the suggested amounts. A single state amount may overcharge a common ZIP while losing money on a rural ZIP in that state. If the spread is too wide, test **calculated shipping** for that package class instead of forcing one flat row to cover every address.

The planner's fee-adjusted figures are economic comparisons. [eBay's shipping policy](https://www.ebay.com/help/policies/listing-policies/shipping-policy?id=5035) says shipping and handling charges must relate to shipping and handling costs actually incurred. Account for any selling-fee gap in overall item pricing rather than treating the fee as an invented packing expense. Confirm your category's fee and your real packing costs before setting a live buyer charge.

## 4. Create the domestic Surcharge table in eBay

Open eBay's [shipping rate table setup](https://www.ebay.com/help/selling/shipping-items/using-postage-rate-tables?id=5459) from Seller Hub, shipping preferences, or business policies. Create a **domestic** table and select **Surcharge** as its rate basis. Give it a name that identifies the packed class. In the service row you will use on the shipping policy, add the exact regions and surcharge amounts from your reviewed worksheet, then save and read the rows back.

Surcharge means **buyer charge = shipping policy's first-item base + the saved regional surcharge**. eBay says a blank regional cost falls back to the policy's standard flat rate. Enter every region for which you intend a different buyer amount; do not assume a blank means free shipping. eBay also says a table's rate basis cannot be changed later. An older **Item** table contains fixed regional buyer prices; create a new Surcharge table if you need the base-edit behavior described here. [eBay's rate-table guide](https://www.ebay.com/help/selling/shipping-items/using-postage-rate-tables?id=5459) describes all three rate bases and the editor rules.

## 5. Attach a flat shipping policy and test one listing

Create or edit an eBay business shipping policy with **Flat** domestic cost type. Select the same primary shipping service as the table row, enter the first-item base, choose the new domestic rate table, and save. Set the **each-identical-item** amount deliberately; a first-item table does not prove combined-cart pricing. [eBay's rate-table guide](https://www.ebay.com/help/selling/shipping-items/using-postage-rate-tables?id=5459) says the table is applied to every listing using that policy, so use a new policy or a small verified listing cohort before changing an existing policy with many assignments.

With a listing that actually uses the policy, check buyer-visible shipping to representative ZIPs in every table region, a costly ZIP within a common state, and each noncontiguous lane you serve. Confirm the item price and other listing terms remain as intended. A saved table alone proves its entries, not the final buyer quote on a listing. If eBay rejects a listing revision because of an unrelated item-specific or offer-setting error, resolve that separately instead of silently changing other listing fields during a shipping-only rollout.

If the same-state rural and common ZIPs cannot share a fair flat price, use a measured package and [calculated shipping](https://www.ebay.com/help/shipping-items/selling/using-shipping-calculator/setting-shipping-options?id=4178), then inspect its buyer quote. A published Geo B/C/D ZIP list cannot be pasted into a native flat table as individual surcharge destinations.

## 6. Edit the base during the year

In the planner's **Compare an existing table or seasonal base** section, choose the real mode of your eBay table, enter its current base and rows, then try a new base. In **Surcharge** mode, the modeled regional buyer charges move with the base. In **Item** mode, the fixed rows stay fixed. If postage changes more in some regions than others, review the rows as well as the base.

When you save a live base or table change in eBay, read it back and repeat buyer-visible ZIP checks. [eBay says](https://www.ebay.com/help/selling/shipping-items/using-postage-rate-tables?id=5459) rate-table edits appear on associated listings, so one edit can affect many buyers. Requote after carrier or marketplace rate changes and compare later purchased-label receipts with the planned package class.

## Your data

The planner uses imported JSON locally in your browser and has no account connection or backend. The public example is synthetic. Keep buyer addresses, order exports, account details, and private label receipts out of public GitHub issues and commits. The CLI Geo tools fetch eBay's public reference and classify the ZIPs in your local input without sending those ZIPs in the fetch request.
