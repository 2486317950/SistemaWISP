/**
 * Configuración del EdgeRouter ER-X-SFP
 * 
 * NOTA: Esta configuración está comentada porque aún no se implementa
 * la conexión real al EdgeRouter. Cuando esté listo, descomentar y
 * configurar las variables de entorno correspondientes.
 */

// TODO: FUTURO - Descomentar y configurar cuando se implemente la conexión real
/*
module.exports = {
  // Dirección IP del EdgeRouter en la red local
  host: process.env.EDGEROUTER_HOST || '192.168.1.1',
  
  // Credenciales SSH
  username: process.env.EDGEROUTER_USER || 'admin',
  password: process.env.EDGEROUTER_PASS || '',
  sshPort: process.env.EDGEROUTER_SSH_PORT || 22,
  
  // Usar API REST en lugar de SSH (si está habilitada en el EdgeRouter)
  useApi: process.env.EDGEROUTER_USE_API === 'true',
  apiPort: process.env.EDGEROUTER_API_PORT || 443,
  apiKey: process.env.EDGEROUTER_API_KEY || '',
  
  // Timeout para comandos (en milisegundos)
  timeout: parseInt(process.env.EDGEROUTER_TIMEOUT || '10000'),
  
  // Configuración de firewall groups
  firewallGroups: {
    suspended: process.env.EDGEROUTER_FW_SUSPENDED_GROUP || 'CLIENT_SUSPENDED',
    active: process.env.EDGEROUTER_FW_ACTIVE_GROUP || 'CLIENT_ACTIVE'
  },
  
  // Configuración de QoS (Quality of Service) - para control de velocidad futuro
  qosEnabled: process.env.EDGEROUTER_QOS_ENABLED === 'true',
  qosInterface: process.env.EDGEROUTER_QOS_INTERFACE || 'eth0'
};
*/

// Por ahora, retornar configuración mock/vacía
module.exports = {
  // Modo mock activado
  mockMode: true,
  
  // Valores de ejemplo (no se usan en modo mock)
  host: '192.168.1.1',
  username: 'admin',
  sshPort: 22,
  useApi: false,
  timeout: 10000
};


















