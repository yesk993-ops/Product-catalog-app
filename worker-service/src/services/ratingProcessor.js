const Product = require('../models/Product');
const axios = require('axios');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:5000';

/**
 * Process a new rating event
 * Calculates the new average rating and updates the product
 */
const processRatingEvent = async (ratingData) => {
  try {
    const { productId, rating } = ratingData;
    
    console.log(`Processing rating for product ${productId}: ${rating}`);

    // Fetch all ratings for this product from ratings service
    // For simplicity, we'll calculate from the product's current state
    // In a real scenario, you might want to fetch all ratings from ratings service
    
    // Get current product
    const product = await Product.findById(productId);
    
    if (!product) {
      console.error(`Product ${productId} not found`);
      return;
    }

    // Calculate new average rating
    const currentTotal = product.averageRating * product.ratingsCount;
    const newRatingsCount = product.ratingsCount + 1;
    const newAverageRating = (currentTotal + rating) / newRatingsCount;

    // Update product via Product Service API
    try {
      await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${productId}/rating`, {
        averageRating: Math.round(newAverageRating * 10) / 10, // Round to 1 decimal
        ratingsCount: newRatingsCount
      });
      
      console.log(`Updated product ${productId}: avgRating=${newAverageRating.toFixed(1)}, count=${newRatingsCount}`);
    } catch (apiError) {
      console.error(`Error updating product via API: ${apiError.message}`);
      
      // Fallback: Update directly in database
      product.averageRating = Math.round(newAverageRating * 10) / 10;
      product.ratingsCount = newRatingsCount;
      product.updatedAt = new Date();
      await product.save();
      console.log(`Updated product ${productId} directly in database`);
    }
  } catch (error) {
    console.error('Error processing rating event:', error);
    throw error;
  }
};

/**
 * Process a rating deletion event
 * Recalculates average rating after a rating is deleted
 */
const processRatingDeletion = async (deletionData) => {
  try {
    const { productId } = deletionData;
    
    console.log(`Processing rating deletion for product ${productId}`);

    // In a real scenario, fetch all remaining ratings and recalculate
    // For now, we'll just log it
    console.log(`Rating deleted for product ${productId} - recalculation needed`);
    
    // You could fetch all ratings from ratings service and recalculate here
  } catch (error) {
    console.error('Error processing rating deletion:', error);
    throw error;
  }
};

module.exports = {
  processRatingEvent,
  processRatingDeletion
};

