import dotenv from 'dotenv';
dotenv.config();

const extApiAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-api-key header'
    });
  }

  if (!process.env.EXT_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'External API key not configured on server'
    });
  }

  if (apiKey !== process.env.EXT_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  next();
};

export default extApiAuth;
