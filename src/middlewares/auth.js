import jwt from 'jsonwebtoken';
import { decode } from 'punycode';

const validatetoken = async (req, res, next) => {
  try {
    const token = req.headers['x-access-token'] || req.body.token || req.query.token;
    if (!token) {
      return res.status(403).send('A token is required for authentication');
    }
    const decoded = jwt.verify(token, 'admin@123', (err, data) => {
      if (err) {
        return res.status(401).send('Invalid Token');
      } else {
        if (req.body) {
          req.body.userId = data.CRN;
          req.body.userName = data.name;
        }
        req.user = {
          userId: data.CRN,
          userName: data.name
        };
        return next();
      }
    });
  } catch (error) {
    // Access Denied
    return res.status(401).send(error);
  }
};

export default validatetoken;
