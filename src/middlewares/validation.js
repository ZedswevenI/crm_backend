import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import constants from '../helpers/constants.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: true
});

const schemasDirectory = path.join(__dirname, '..', 'schema');
const schemaFiles = fs.readdirSync(schemasDirectory);

schemaFiles.forEach((schemaFile) => {
  const schemaPath = path.join(schemasDirectory, schemaFile);
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);
  ajv.addSchema(schema, schemaFile);
});

function validateSchema(schema) {
  return (req, res, next) => {
    const { query, body } = req;
    const combinedParams = { ...query, ...body };
    const validate = ajv.getSchema(schema) || ajv.compile(schema);
    if (!validate) {
      throw new Error(`No validation found for schema "${schema}"`);
    }
    const valid = validate(combinedParams);
    if (!valid) {
      console.log('validate.errors', validate.errors);
      const errors = validate.errors.map((error) => ({
        field: error.instancePath ? error.instancePath.replace('/', '') : error.params.missingProperty,
        error: error.keyword === 'required' ? `${error.instancePath ? error.instancePath.replace('/', '') : error.params.missingProperty} is missing` : `check data of ${error.instancePath ? error.instancePath.replace('/', '') : error.params.missingProperty}`
      }));

      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'Please check the request.',
        errors
      });
    }
    next();
  };
}

export default validateSchema;
