const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  sku: String,
  name: String,
  ean: String,
  price: Number,
  stock: Number,
  source: String,
  updatedAt: Date,
});

module.exports = mongoose.model("Product", productSchema);