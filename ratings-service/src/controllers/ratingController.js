const Rating = require('../models/Rating');
const { publishRatingEvent } = require('../config/redis');
const { validationResult } = require('express-validator');

// @desc    Submit a rating
// @route   POST /api/ratings
// @access  Public
const submitRating = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { productId, userId, rating, comment } = req.body;

    // Check if user already rated this product
    const existingRating = await Rating.findOne({ productId, userId });
    
    let savedRating;
    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating;
      existingRating.comment = comment || existingRating.comment;
      savedRating = await existingRating.save();
    } else {
      // Create new rating
      savedRating = await Rating.create({ productId, userId, rating, comment });
    }

    // Publish event to Redis for worker service to process
    try {
      await publishRatingEvent('ratings:new', {
        productId: savedRating.productId,
        userId: savedRating.userId,
        rating: savedRating.rating,
        ratingId: savedRating._id.toString(),
        timestamp: new Date().toISOString()
      });
    } catch (redisError) {
      console.error('Error publishing to Redis:', redisError);
      // Don't fail the request if Redis fails, but log it
    }

    res.status(201).json({
      success: true,
      data: savedRating,
      message: existingRating ? 'Rating updated successfully' : 'Rating submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this product'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get ratings for a product
// @route   GET /api/ratings/product/:productId
// @access  Public
const getProductRatings = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const ratings = await Rating.find({ productId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ productId });

    // Calculate average rating
    const avgRatingResult = await Rating.aggregate([
      { $match: { productId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const averageRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;
    const ratingsCount = avgRatingResult.length > 0 ? avgRatingResult[0].count : 0;

    res.json({
      success: true,
      data: ratings,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingsCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching product ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get ratings by a user
// @route   GET /api/ratings/user/:userId
// @access  Public
const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const ratings = await Rating.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ userId });

    res.json({
      success: true,
      data: ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete a rating
// @route   DELETE /api/ratings/:id
// @access  Public (in production, should be protected)
const deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findByIdAndDelete(req.params.id);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Publish deletion event
    try {
      await publishRatingEvent('ratings:deleted', {
        productId: rating.productId,
        ratingId: rating._id.toString(),
        timestamp: new Date().toISOString()
      });
    } catch (redisError) {
      console.error('Error publishing deletion to Redis:', redisError);
    }

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  submitRating,
  getProductRatings,
  getUserRatings,
  deleteRating
};

