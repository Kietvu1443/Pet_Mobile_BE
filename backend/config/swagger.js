const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const swaggerSpec = YAML.load(path.join(__dirname, '../swagger.yaml'));

module.exports = { swaggerUi, swaggerSpec };
