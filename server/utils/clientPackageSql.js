/**
 * Expresiones SQL reutilizables: `c` = clients, `p` = packages
 * con LEFT JOIN packages p ON c.package_id = p.id
 */

function effMonthly(clientAlias = 'c', pkgAlias = 'p') {
  return `(CASE WHEN ${clientAlias}.custom_package_price IS NOT NULL THEN ${clientAlias}.custom_package_price ELSE COALESCE(${pkgAlias}.price, 0) END)`;
}

function effPkgName(clientAlias = 'c', pkgAlias = 'p') {
  return `(CASE WHEN ${clientAlias}.custom_package_price IS NOT NULL THEN COALESCE(NULLIF(TRIM(${clientAlias}.custom_package_name), ''), 'Personalizado') ELSE ${pkgAlias}.name END)`;
}

function effPkgDesc(clientAlias = 'c', pkgAlias = 'p') {
  return `(CASE WHEN ${clientAlias}.custom_package_price IS NOT NULL THEN NULL ELSE ${pkgAlias}.description END)`;
}

module.exports = {
  effMonthly,
  effPkgName,
  effPkgDesc,
};
