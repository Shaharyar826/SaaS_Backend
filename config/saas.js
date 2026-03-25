// SaaS domain configuration
const SAAS_CONFIG = {
  // Main SaaS domain - can be configured via environment variable
  SAAS_DOMAIN: process.env.SAAS_DOMAIN || 'eduflow.com',
  
  // Email domain format: {subdomain}.{SAAS_DOMAIN}
  getEmailDomain: (subdomain) => `${subdomain}.${SAAS_CONFIG.SAAS_DOMAIN}`,
  
  // Generate email with SaaS domain
  generateEmail: (prefix, firstName, lastName, subdomain) => {
    const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${prefix}${cleanFirstName}${cleanLastName}@${subdomain}.${SAAS_CONFIG.SAAS_DOMAIN}`;
  }
};

module.exports = SAAS_CONFIG;