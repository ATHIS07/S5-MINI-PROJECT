/**
 * CloudPulse Runtime Configuration Example
 * 
 * Copy this file to `config.js` or set these values in Settings → API Configuration
 * in the CloudPulse user interface.
 */

window.CLOUDPULSE_CONFIG = {
  // Base URL of your AWS API Gateway Stage or custom REST server
  // Deployed AWS Backend (Mumbai ap-south-1)
  BASE_URL: "https://zpbpv26plb.execute-api.ap-south-1.amazonaws.com/prod",

  // Authentication Mode: "none" | "bearer" | "cognito" | "apikey"
  AUTH_MODE: "none",

  // Public API Key (only if your API Gateway Usage Plan enforces x-api-key)
  API_KEY: "",

  // Amazon Cognito User Pool configuration
  COGNITO: {
    USER_POOL_ID: "",
    CLIENT_ID: "", // Public client ID (non-secret)
    REGION: "ap-south-1"
  },

  // Health probe endpoint path
  HEALTH_ENDPOINT: "/tasks",

  // Request timeout in milliseconds
  TIMEOUT_MS: 10000
};
