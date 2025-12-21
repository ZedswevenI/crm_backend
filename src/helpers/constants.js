export default Object.freeze({
  //  HTTPS CODES
  HTTPS_SUCCESS: 200, // SUCCESS
  HTTPS_CREATED: 201, // Not Found
  HTTPS_NO_CONTENT: 204, // empty response in data
  HTTPS_BAD_REQUEST: 400, // BAD REQUEST
  HTTPS_UNAUTHORISED: 401, // Unauthorized
  HTTPS_FORBIDDEN: 403, // FORBIDDEN
  HTTPS_NOT_FOUND: 404, // Not Found
  HTTPS_CONFLICT: 409, // Conflict
  HTTPS_EXPIRED: 410, // Expired
  HTTPS_INTERNAL_ERROR: 500, // INTERNAL ERROR
  HTTPS_SERVICE_UNAVAILABLE: 503, // Service Unavailable

  // AJV Schema Names

  // other Constants
  DEFAULTLANGUAGE: 'en',
  WAREHOUSE: 'warehouse',
  USERS: 'users',
  PRODUCTS: 'products',
  DISPATCH: 'dispatch'
});
