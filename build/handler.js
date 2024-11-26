"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = exports.subscribeMessages = void 0;
const pg_1 = require("pg");
const ioredis_1 = __importDefault(require("ioredis"));
// Initialize PostgreSQL client
const pgClient = new pg_1.Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
});
// Initialize Redis client
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
});
console.log("ENV: " + process.env.REDIS_HOST);
console.log("PG_DATABASE: " + process.env.PG_DATABASE);
// Connect to PostgreSQL and Redis during cold start
let isInitialized = false;
const initialize = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!isInitialized) {
        try {
            yield pgClient.connect();
            console.log('PostgreSQL connected.');
            console.log('Starting Redis subscription...');
            yield redis.subscribe('test-channel');
            console.log('Subscribed to Redis channel: test-channel');
            isInitialized = true;
        }
        catch (error) {
            console.error('Initialization error:', error);
            throw new Error('Failed to initialize resources.');
        }
    }
});
// Lambda handler
const subscribeMessages = (event) => __awaiter(void 0, void 0, void 0, function* () {
    yield initialize();
    console.log('Lambda invoked. Processing event...');
    try {
        redis.on('message', (channel, message) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`Received message from ${channel}: ${message}`);
            try {
                const query = 'INSERT INTO messages (channel, message) VALUES ($1, $2)';
                const values = [channel, message];
                yield pgClient.query(query, values);
                console.log('Message saved to PostgreSQL:', message);
            }
            catch (dbError) {
                console.error('Error saving message to PostgreSQL:', dbError);
            }
        }));
    }
    catch (handlerError) {
        console.error('Error in Lambda handler:', handlerError);
        throw handlerError;
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Lambda executed successfully.' }),
    };
});
exports.subscribeMessages = subscribeMessages;
// Cleanup resources when Lambda execution ends
const cleanup = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Cleaning up resources...');
    yield redis.quit();
    yield pgClient.end();
    console.log('Resources cleaned up.');
});
exports.cleanup = cleanup;
process.on('SIGINT', exports.cleanup);
process.on('SIGTERM', exports.cleanup);
