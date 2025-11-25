const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;

    redisClient = redis.createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

const publishRatingEvent = async (channel, data) => {
  try {
    const client = getRedisClient();
    await client.publish(channel, JSON.stringify(data));
    console.log(`Published rating event to channel ${channel}:`, data);
  } catch (error) {
    console.error('Error publishing to Redis:', error);
    throw error;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  publishRatingEvent
};

