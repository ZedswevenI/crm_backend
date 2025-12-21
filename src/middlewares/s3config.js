import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-south-1';

const s3Client = new S3Client({
  region
});

export default s3Client;
