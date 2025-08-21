import mongoose from 'mongoose';

export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: 'vohala_social' });
  console.log('[mongo] connected');
}
