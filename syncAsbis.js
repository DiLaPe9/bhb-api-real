const axios = require("axios");
const xml2js = require("xml2js");
const Product = require("./productModel");

const ASBIS_PRODUCTS_URL = "https://services.it4profit.com/product/bg/714/ProductList.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";
const ASBIS_PRICE_URL = "https://services.it4profit.com/product/bg/714/PriceAvail.xml?USERNAME=dipetrov&PASSWORD=Asbisb@nk";

async function fetchXml(url) {
  const { data } = await axios.get(url);
  return await xml2js.parseStringPromise(data, { explicitArray: false });
}

function mapAsbisData(productList, priceList) {
  const prices = {};
  for (const row of priceList?.PriceAvailability?.Product || []) {
    prices[row.ProductCode] = {
      stock: parseInt(row.StockQty || 0),
      price: parseFloat(row.EndUserPrice || 0),
    };
  }

  const items = [];
  for (const p of productList?.ProductList?.Product || []) {
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
  const productList = await fetchXml(ASBIS_PRODUCTS_URL);
  const priceList = await fetchXml(ASBIS_PRICE_URL);
  const merged = mapAsbisData(productList, priceList);
  await Product.deleteMany({ source: "asbis" });
  await Product.insertMany(merged);
  return merged;
}

module.exports = { syncAsbisProducts };