import { Client } from 'pg';
import Redis from 'ioredis';

// Initialize PostgreSQL client
const pgClient = new Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
});

console.log("ENV: " + process.env.REDIS_HOST);

console.log("PG_DATABASE: " + process.env.PG_DATABASE);
// Connect to PostgreSQL and Redis during cold start
let isInitialized = false;

const initialize = async () => {
  if (!isInitialized) {
    try {
      await pgClient.connect();
      console.log('PostgreSQL connected.');
      console.log('Starting Redis subscription...');
      await redis.subscribe('test-channel');
      console.log('Subscribed to Redis channel: test-channel');
      isInitialized = true;
    } catch (error) {
      console.error('Initialization error:', error);
      throw new Error('Failed to initialize resources.');
    }
  }
};

// Lambda handler
export const subscribeMessages = async (event: any) => {
  await initialize();
  console.log('Lambda invoked. Processing event...');
  try {
    redis.on('message', async (channel, message) => {
      console.log(`Received message from ${channel}: ${message}`);
      try {
        const query = 'INSERT INTO messages (channel, message) VALUES ($1, $2)';
        const values = [channel, message];
        await pgClient.query(query, values);
        console.log('Message saved to PostgreSQL:', message);
      } catch (dbError) {
        console.error('Error saving message to PostgreSQL:', dbError);
      }
    });
  } catch (handlerError) {
    console.error('Error in Lambda handler:', handlerError);
    throw handlerError;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Lambda executed successfully.' }),
  };
};

// Cleanup resources when Lambda execution ends
export const cleanup = async () => {
  console.log('Cleaning up resources...');
  await redis.quit();
  await pgClient.end();
  console.log('Resources cleaned up.');
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
