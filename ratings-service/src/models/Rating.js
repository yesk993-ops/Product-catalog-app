const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index to prevent duplicate ratings from same user for same product
ratingSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);

