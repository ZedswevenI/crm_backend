import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../helpers/logger.js';

dotenv.config();

const MONGO_URI = `mongodb+srv://${process.env.DBUSER}:${process.env.PASSWORD}@${process.env.HOST}/${process.env.DATABASE}`;
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info(`Database Connected Successfully!!`);
  } catch (err) {
    logger.error(`Database Connected  error:", ${err}`);
    process.exit(1);
  }
};

export default connectDB;
