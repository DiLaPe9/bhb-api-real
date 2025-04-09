const axios = require("axios");
const xml2js = require("xml2js");
const Product = require("./productModel");

const ASBIS_PRODUCTS_URL = "https://services.it4profit.com/product/bg/714/ProductList.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";
const ASBIS_PRICE_URL = "https://services.it4profit.com/product/bg/714/PriceAvail.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";

async function fetchXml(url, name) {
  console.log(`⏳ Fetching ${name}...`);
  const { data } = await axios.get(url);
  console.log(`✅ ${name} fetched (${data.length} bytes)`);
  return await xml2js.parseStringPromise(data, { explicitArray: false });
}

function mapAsbisData(productList, priceList) {
  const prices = {};
  const priceItems = priceList?.PriceAvailability?.Product || [];
  console.log(`✅ Prices loaded (${priceItems.length} entries)`);

  for (const row of priceItems) {
    prices[row.ProductCode] = {
      stock: parseInt(row.StockQty || 0),
      price: parseFloat(row.EndUserPrice || 0),
    };
  }

  const items = [];
  const productItems = productList?.ProductList?.Product || [];
  console.log(`✅ ProductList loaded (${productItems.length} products)`);

  for (const p of productItems) {
    const priceData = prices[p.ProductCode] || {};
    items.push({
      sku: p.ProductCode,
      name: p.ProdDescr,
      ean: p.EANCode || "",
      stock: priceData.stock || 0,
      price: priceData.price || 0,
      source: "asbis",
      updatedAt: new Date(),
    });
  }

  return items;
}

async function syncAsbisProducts() {
  try {
    const productList = await fetchXml(ASBIS_PRODUCTS_URL, "ProductList.xml");
    const priceList = await fetchXml(ASBIS_PRICE_URL, "PriceAvail.xml");

    console.log("⏳ Merging product + price data...");
    const merged = mapAsbisData(productList, priceList);

    console.log("⏳ Writing to MongoDB...");
    await Product.deleteMany({ source: "asbis" });
    await Product.insertMany(merged);

    console.log(`✅ Sync complete (${merged.length} items saved)`);
    return merged;
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    return [];
  }
}

module.exports = { syncAsbisProducts };