import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const getS3Client = () => {
  return new S3Client({
    region: (process.env.AWS_REGION || '').trim(),
    credentials: {
      accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim()
    }
  });
};

export const uploadFileToS3 = async (file, folderPath) => {
  if (!file) return null;
  const s3 = getS3Client();
  const fileStream = fs.createReadStream(file.path);
  const key = `${process.env.AWS_S3_Z7I_BUCKET}/${folderPath}/${Date.now()}_${file.originalname}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_Z7I_BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: file.mimetype
  });
  try {
    await s3Client.send(command);
    fs.unlinkSync(file.path);
    const bucketUrl = `https://${process.env.AWS_S3_Z7I_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    return `${bucketUrl}/${key}`;
  } catch (error) {
    throw new Error('Failed to upload attachment to S3');
  }
};

export const generatePresignedUrl = async (fileName, fileType) => {
  const s3 = getS3Client();
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
    throw new Error('Failed to generate presigned URL');
  }
};

export async function downloadFileFrmS3(url) {
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: url.bucket, Key: url.key });
  const data = await s3.send(cmd);
  return data;
}

export async function parseS3Url(fullUrl) {
  if (!fullUrl) return null;
  const u = new URL(fullUrl);
  const vh = u.hostname.match(/^([^.]+)\.s3[.-][^.]+\.amazonaws\.com$/i);
  if (vh) {
    return { bucket: vh[1], key: decodeURIComponent(u.pathname.replace(/^\/+/, '')) };
  }
  if (/^s3[.-][^.]+\.amazonaws\.com$/i.test(u.hostname)) {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const bucket = parts.shift();
      const key = decodeURIComponent(parts.join('/'));
      return { bucket, key };
    }
  }
  return null;
}

export const uploadPublicEmailImageToS3 = async (file, tenantId) => {
  if (!file) return null;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Only PNG, JPG, JPEG and WEBP images are allowed');
  }
  const bucket = process.env.AWS_S3_Z7I_EMAIL_BUCKET;
  const region = process.env.AWS_REGION || 'ap-south-1';
  if (!bucket) {
    throw new Error('AWS_S3_Z7I_EMAIL_BUCKET is not configured');
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  const baseName = path
    .basename(file.originalname || 'email-image', ext)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  const random = crypto.randomBytes(8).toString('hex');
  const fileName = `${baseName}-${Date.now()}-${random}${ext}`;
  const key = `email-assets/${tenantId}/${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });
  await s3Client.send(command);
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};
