import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'admin@123';

const validatetoken = async (req, res, next) => {
  try {
    const token = req.headers['x-access-token'] || req.body.token || req.query.token;
    if (!token) {
      return res.status(403).send('A token is required for authentication');
    }
    jwt.verify(token, ACCESS_SECRET, (err, data) => {
      if (err) {
        return res.status(401).send('Invalid Token');
      }
      if (req.body) {
        req.body.userId = data.CRN;
        req.body.userName = data.name;
      }
      req.user = {
        userId: data.CRN,
        userName: data.name,
        tenantId: data.tenantId || null
      };
      return next();
    });
  } catch (error) {
    // Access Denied
    return res.status(401).send(error);
  }
};

export default validatetoken;
