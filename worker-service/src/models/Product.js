const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  imageUrl: String,
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: Date,
  updatedAt: Date
});

module.exports = mongoose.model('Product', productSchema);

