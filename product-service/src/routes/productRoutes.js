const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductRating
} = require('../controllers/productController');
const { body } = require('express-validator');

// Validation middleware
const productValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('imageUrl').optional().isURL().withMessage('Image URL must be valid')
];

// Routes
router.get('/', getProducts);
router.get('/search', getProducts); // Alias for search functionality
router.get('/:id', getProduct);
router.post('/', productValidation, createProduct);
router.put('/:id', productValidation, updateProduct);
router.delete('/:id', deleteProduct);

// Internal route for worker service to update ratings
router.put('/:id/rating', updateProductRating);

module.exports = router;

