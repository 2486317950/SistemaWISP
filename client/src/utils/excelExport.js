import * as XLSX from 'xlsx';

/**
 * Exporta datos a Excel
 * @param {Array} data - Array de objetos a exportar
 * @param {String} filename - Nombre del archivo (sin extensión)
 * @param {String} sheetName - Nombre de la hoja
 * @param {Object} toast - Opcional: { error } para mostrar errores por toast
 */
export const exportToExcel = (data, filename = 'export', sheetName = 'Datos', toast) => {
  try {
    // Crear un nuevo workbook
    const wb = XLSX.utils.book_new();
    
    // Convertir datos a worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Escribir archivo
    XLSX.writeFile(wb, `${filename}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    const msg = 'Error al exportar a Excel: ' + error.message;
    if (toast && typeof toast.error === 'function') toast.error(msg);
    else alert(msg);
    return false;
  }
};

/**
 * Exporta múltiples hojas a Excel
 * @param {Object} sheets - Objeto con {nombreHoja: datos}
 * @param {String} filename - Nombre del archivo
 * @param {Object} toast - Opcional: { error } para mostrar errores por toast
 */
export const exportMultipleSheets = (sheets, filename = 'export', toast) => {
  try {
    const wb = XLSX.utils.book_new();
    
    Object.keys(sheets).forEach(sheetName => {
      const ws = XLSX.utils.json_to_sheet(sheets[sheetName]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error al exportar múltiples hojas:', error);
    const msg = 'Error al exportar a Excel: ' + error.message;
    if (toast && typeof toast.error === 'function') toast.error(msg);
    else alert(msg);
    return false;
  }
};

/**
 * Exporta a CSV
 * @param {Array} data - Array de objetos
 * @param {String} filename - Nombre del archivo
 * @param {Object} toast - Opcional: { error, warning } para mostrar mensajes por toast
 */
export const exportToCSV = (data, filename = 'export', toast) => {
  try {
    if (!data || data.length === 0) {
      const msg = 'No hay datos para exportar';
      if (toast && typeof toast.warning === 'function') toast.warning(msg);
      else alert(msg);
      return false;
    }
    
    // Obtener headers
    const headers = Object.keys(data[0]);
    
    // Crear CSV
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escapar comillas y envolver en comillas si contiene comas
        if (value === null || value === undefined) return '';
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      });
      csv += values.join(',') + '\n';
    });
    
    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error al exportar a CSV:', error);
    const msg = 'Error al exportar a CSV: ' + error.message;
    if (toast && typeof toast.error === 'function') toast.error(msg);
    else alert(msg);
    return false;
  }
};

/**
 * Formatea datos para exportación (convierte fechas, números, etc.)
 */
export const formatDataForExport = (data) => {
  return data.map(row => {
    const formatted = { ...row };
    Object.keys(formatted).forEach(key => {
      // Formatear fechas
      if (formatted[key] && typeof formatted[key] === 'string' && formatted[key].match(/^\d{4}-\d{2}-\d{2}/)) {
        try {
          const date = new Date(formatted[key]);
          formatted[key] = date.toLocaleDateString('es-MX');
        } catch (e) {
          // Mantener original si no es fecha válida
        }
      }
      // Formatear números
      if (typeof formatted[key] === 'number') {
        formatted[key] = formatted[key].toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    });
    return formatted;
  });
};











