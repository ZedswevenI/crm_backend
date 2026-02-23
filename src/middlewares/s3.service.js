import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export const uploadFileToS3 = async (file) => {
  if (!file) return null;
  const fileStream = fs.createReadStream(file.path);
  const key = `${process.env.AWS_S3_Z7I_BUCKET}/tasks/${Date.now()}_${file.originalname}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: file.mimetype
  });
  try {
    await s3Client.send(command);
    fs.unlinkSync(file.path);
    const bucketUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    return `${bucketUrl}/${key}`;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error('Failed to upload attachment to S3');
  }
};

export const generatePresignedUrl = async (fileName, fileType) => {
  const key = `tasks/${Date.now()}_${fileName}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    ContentType: fileType
  });
  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const finalFileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { signedUrl, finalFileUrl };
  } catch (error) {
    console.error('Presigned URL Error:', error);
    throw new Error('Failed to generate presigned URL');
  }
};
