require('dotenv').config();
const connectDB = require('./config/database');
const { connectRedis, getRedisClient } = require('./config/redis');
const { processRatingEvent, processRatingDeletion } = require('./services/ratingProcessor');

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');

// Connect to MongoDB
connectDB();

// Connect to Redis and start processing
const startWorker = async () => {
  try {
    await connectRedis();
    const client = getRedisClient();

    console.log('Worker Service started');
    console.log(`Worker concurrency: ${WORKER_CONCURRENCY}`);
    console.log(`Subscribing to Redis channels...`);

    // Subscribe to rating events
    const subscriber = client.duplicate();
    await subscriber.connect();

    // Subscribe to specific channels
    await subscriber.subscribe('ratings:new', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received new rating event:`, data);
        await processRatingEvent(data);
      } catch (error) {
        console.error('Error processing rating event:', error);
        // In production, you might want to send to a dead letter queue
      }
    });

    await subscriber.subscribe('ratings:deleted', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received rating deletion event:`, data);
        await processRatingDeletion(data);
      } catch (error) {
        console.error('Error processing deletion event:', error);
      }
    });

    console.log('Worker is listening for rating events...');
  } catch (error) {
    console.error('Error starting worker:', error);
    process.exit(1);
  }
};

// Start the worker
startWorker();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: shutting down worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: shutting down worker');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

