const express = require('express');
const router = express.Router();
const {
  submitRating,
  getProductRatings,
  getUserRatings,
  deleteRating
} = require('../controllers/ratingController');
const { body } = require('express-validator');

// Validation middleware
const ratingValidation = [
  body('productId').trim().notEmpty().withMessage('Product ID is required'),
  body('userId').trim().notEmpty().withMessage('User ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
];

// Routes
router.post('/', ratingValidation, submitRating);
router.get('/product/:productId', getProductRatings);
router.get('/user/:userId', getUserRatings);
router.delete('/:id', deleteRating);

module.exports = router;

