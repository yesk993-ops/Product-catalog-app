const mongoose = require('mongoose');
const Product = require('../models/Product');

const defaultProducts = [
  {
    name: "Wireless Bluetooth Headphones",
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life. Perfect for music lovers and professionals.",
    price: 199.99,
    category: "Electronics",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
    averageRating: 0,
    ratingsCount: 0
  },
  {
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking watch with heart rate monitor, GPS, and 7-day battery life. Track your workouts and health metrics.",
    price: 299.99,
    category: "Electronics",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
    averageRating: 0,
    ratingsCount: 0
  },
  {
    name: "Ergonomic Office Chair",
    description: "Comfortable ergonomic office chair with lumbar support, adjustable height, and 360-degree swivel. Perfect for long work sessions.",
    price: 349.99,
    category: "Furniture",
    imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500",
    averageRating: 0,
    ratingsCount: 0
  },
  {
    name: "Stainless Steel Water Bottle",
    description: "Insulated stainless steel water bottle that keeps drinks cold for 24 hours or hot for 12 hours. BPA-free and eco-friendly.",
    price: 29.99,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500",
    averageRating: 0,
    ratingsCount: 0
  },
  {
    name: "Mechanical Gaming Keyboard",
    description: "RGB backlit mechanical keyboard with Cherry MX switches. Perfect for gaming and typing with customizable keys and lighting.",
    price: 149.99,
    category: "Electronics",
    imageUrl: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500",
    averageRating: 0,
    ratingsCount: 0
  }
];

const seedProducts = async () => {
  try {
    // Wait for MongoDB connection to be ready
    let retries = 10;
    while (mongoose.connection.readyState !== 1 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries--;
    }

    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected yet, skipping seed (will retry on next startup)');
      return;
    }

    // Ensure default products exist (upsert by name)
    let seededCount = 0;
    const seededProducts = [];

    for (const productData of defaultProducts) {
      const existingProduct = await Product.findOne({ name: productData.name });
      
      if (!existingProduct) {
        const product = await Product.create(productData);
        seededProducts.push(product);
        seededCount++;
      }
    }

    if (seededCount > 0) {
      console.log(`✅ Successfully seeded ${seededCount} new default products:`);
      seededProducts.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - $${product.price}`);
      });
    } else {
      console.log(`✅ All ${defaultProducts.length} default products already exist in database.`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding products:', error);
    // Don't exit process if called from server.js
    if (require.main === module) {
      process.exit(1);
    }
  }
};

// Run seeding if called directly (for manual seeding)
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/database');
  
  connectDB().then(() => {
    setTimeout(() => {
      seedProducts().then(() => {
        process.exit(0);
      }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    }, 1000);
  });
}

module.exports = seedProducts;

