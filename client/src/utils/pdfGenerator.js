import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Información de la empresa para el pie de página
const COMPANY_INFO = {
  name: 'Sistema ISP CDCom',
  phone: '',
  email: '',
  address: '',
  website: ''
};

// Función auxiliar para agregar pie de página con información de la empresa
const addCompanyFooter = (doc, pageWidth, currentPage, totalPages) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 10;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  // Construir texto del pie de página
  let footerText = COMPANY_INFO.name;
  
  if (COMPANY_INFO.phone) {
    footerText += ` | Tel: ${COMPANY_INFO.phone}`;
  }
  if (COMPANY_INFO.email) {
    footerText += ` | Email: ${COMPANY_INFO.email}`;
  }
  if (COMPANY_INFO.address) {
    footerText += ` | ${COMPANY_INFO.address}`;
  }
  if (COMPANY_INFO.website) {
    footerText += ` | ${COMPANY_INFO.website}`;
  }
  
  footerText += ` | Página ${currentPage} de ${totalPages}`;
  
  doc.text(
    footerText,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
};

/**
 * Abre el PDF en una nueva pestaña (evita bloqueos por iframe/blob).
 * Si el navegador bloquea la ventana, descarga el archivo.
 */
function openPdfInNewTab(doc, fileName) {
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const opened = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  if (opened) {
    opened.focus();
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  } else {
    doc.save(fileName);
    URL.revokeObjectURL(pdfUrl);
  }
}

/**
 * Genera un PDF de pagaré para un crédito con los datos del cliente
 */
export const generateCreditPagarePDF = (credit) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  let y = margin;

  const cliente = credit.display_name || credit.client_name || 'Sin especificar';
  const domicilio = credit.client_address || credit.installation_address || credit.address || 'Sin especificar';
  const monto = parseFloat(credit.total_amount || 0);
  const montoLetras = numToWords(monto);
  const tipoCredito = credit.credit_type === 'instalacion' ? 'Instalación de servicio' : 'Mensualidad';
  const fechaCreacion = credit.created_at ? new Date(credit.created_at) : new Date();
  const fechaStr = fechaCreacion.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  // Título
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PAGARÉ', pageWidth / 2, y, { align: 'center' });
  y += 18;

  // Cuerpo del pagaré
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const cuerpo = [
    `Por medio del presente documento de pago, yo ${cliente}, con domicilio en ${domicilio}, me comprometo a pagar incondicionalmente a la orden de ${COMPANY_INFO.name} la cantidad de:`,
    '',
    `*** ${montoLetras} ***`,
    '',
    `($${monto.toFixed(2)} MXN)`,
    '',
    `Por concepto de: ${tipoCredito}${credit.notes ? ' - ' + credit.notes : ''}.`,
    '',
    `Fecha de emisión: ${fechaStr}.`,
    '',
    `Monto total del crédito: $${monto.toFixed(2)} MXN`,
    `Monto pendiente: $${parseFloat(credit.remaining_amount || 0).toFixed(2)} MXN`,
    '',
    'El deudor se obliga a realizar los pagos en las fechas acordadas. En caso de incumplimiento, se aplicarán los intereses y cargos conforme a lo establecido.',
    '',
    '_________________________',
    'Firma del deudor'
  ];

  cuerpo.forEach((linea) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    if (linea.startsWith('***')) {
      doc.setFont('helvetica', 'bold');
      doc.text(linea.replace(/\*\*\*/g, '').trim(), margin, y);
      doc.setFont('helvetica', 'normal');
      y += 8;
    } else if (linea === '_________________________' || linea === 'Firma del deudor') {
      doc.text(linea, margin, y);
      y += 7;
    } else if (linea !== '') {
      const lines = doc.splitTextToSize(linea, pageWidth - 2 * margin);
      lines.forEach((l) => {
        doc.text(l, margin, y);
        y += 6;
      });
      y += 2;
    } else {
      y += 4;
    }
  });

  addCompanyFooter(doc, pageWidth, 1, 1);
  const filename = `Pagare_Credito_${credit.id}_${cliente.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
};

// Convertir número a palabras (español, simplificado)
function numToWords(num) {
  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  const entero = Math.floor(num);
  const decimal = Math.round((num - entero) * 100);

  if (entero === 0) return 'cero pesos';
  if (entero >= 1000000) return `${num.toFixed(2)} (monto en números)`;

  let result = '';
  let n = entero;

  if (n >= 1000) {
    const miles = Math.floor(n / 1000);
    if (miles === 1) result += 'mil ';
    else if (miles < 10) result += unidades[miles] + ' mil ';
    else result += numToWords(miles) + ' mil ';
    n %= 1000;
  }

  if (n >= 100) {
    if (n === 100) result += 'cien ';
    else result += centenas[Math.floor(n / 100)] + ' ';
    n %= 100;
  }

  if (n >= 20) {
    result += decenas[Math.floor(n / 10)] + (n % 10 ? ' y ' + unidades[n % 10] : '') + ' ';
  } else if (n >= 10) {
    result += especiales[n - 10] + ' ';
  } else if (n > 0) {
    result += unidades[n] + ' ';
  }

  result = result.trim() + ' pesos';
  if (decimal > 0) result += ` ${decimal}/100 M.N.`;
  return result;
}

export const generateClientPDF = (client) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Información del Cliente', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Información personal
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Información Personal', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  if (client.client_number) {
    doc.text(`Número de Cliente: ${client.client_number}`, margin, yPosition);
    yPosition += 7;
  }
  doc.text(`Nombre: ${client.name}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Domicilio: ${client.address}`, margin, yPosition);
  yPosition += 7;
  
  if (client.phone) {
    doc.text(`Teléfono: ${client.phone}`, margin, yPosition);
    yPosition += 7;
  }
  
  if (client.email) {
    doc.text(`Email: ${client.email}`, margin, yPosition);
    yPosition += 7;
  }
  
  if (client.network_type) {
    doc.text(`Tipo de Red: ${client.network_type}`, margin, yPosition);
    yPosition += 7;
  }
  
  if (client.package_name) {
    doc.text(`Paquete: ${client.package_name} - ${client.speed} - $${client.package_price}`, margin, yPosition);
    yPosition += 7;
  }
  
  if (client.notes) {
    doc.text(`Anotaciones: ${client.notes}`, margin, yPosition);
    yPosition += 7;
  }

  yPosition += 5;

  // Historial de Pagos
  if (client.payments && client.payments.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Historial de Pagos', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Monto', margin + 50, yPosition);
    doc.text('Recibo', margin + 90, yPosition);
    doc.text('Notas', margin + 140, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    client.payments.forEach((payment) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      const date = format(new Date(payment.payment_date), 'dd/MM/yyyy');
      doc.text(date, margin, yPosition);
      doc.text(`$${payment.amount}`, margin + 50, yPosition);
      doc.text(payment.receipt_number || '-', margin + 90, yPosition);
      doc.text(payment.notes || '-', margin + 140, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Instalaciones
  if (client.installations && client.installations.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Instalaciones', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Tipo', margin + 50, yPosition);
    doc.text('Estado', margin + 100, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    client.installations.forEach((installation) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      const date = format(new Date(installation.installation_date), 'dd/MM/yyyy');
      doc.text(date, margin, yPosition);
      doc.text(installation.installation_type, margin + 50, yPosition);
      doc.text(installation.status, margin + 100, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Folios
  if (client.folios && client.folios.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Folios de Reparación', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Folio', margin, yPosition);
    doc.text('Fecha', margin + 50, yPosition);
    doc.text('Problema', margin + 90, yPosition);
    doc.text('Estado', margin + 150, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    client.folios.forEach((folio) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      const date = format(new Date(folio.visit_date), 'dd/MM/yyyy');
      doc.text(folio.folio_number, margin, yPosition);
      doc.text(date, margin + 50, yPosition);
      doc.text(folio.problem_description || '-', margin + 90, yPosition);
      doc.text(folio.status, margin + 150, yPosition);
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Guardar PDF
  doc.save(`Cliente_${client.name.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const generateMonthlyPaymentsPDF = (monthData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resumen de Pagos - ${monthData.monthName}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Estadísticas del mes
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Mes', margin, yPosition);
  yPosition += 10;

  // Calcular monto total de meses gratis
  const freeMonthsAmount = monthData.payments
    ? monthData.payments
        .filter(p => p.is_free_month === true || p.is_free_month === 1 || p.is_free_month === '1')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    : 0;
  
  // Calcular total neto (total - meses gratis)
  const netAmount = monthData.totalAmount - freeMonthsAmount;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Pagos: ${monthData.totalPayments}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Monto Total Bruto: $${monthData.totalAmount.toFixed(2)}`, margin, yPosition);
  yPosition += 7;
  if (monthData.installationPayments > 0 && monthData.installationAmount > 0) {
    doc.text(`Pagos por Instalación: $${monthData.installationAmount.toFixed(2)}`, margin, yPosition);
    yPosition += 7;
  }
  
  // Siempre mostrar meses gratis (incluso si es 0)
  const freeMonthsCount = monthData.freeMonths || 0;
  doc.text(`Meses Gratis: ${freeMonthsCount}`, margin, yPosition);
  yPosition += 7;
  
  // Mostrar monto de meses gratis de manera destacada
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0); // Rojo para destacar
  doc.text(`TOTAL VALOR MESES GRATIS: $${freeMonthsAmount.toFixed(2)}`, margin, yPosition);
  doc.setTextColor(0, 0, 0); // Volver a negro
  doc.setFont('helvetica', 'normal');
  yPosition += 7;
  yPosition += 3;
  
  // Total Neto (destacado)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
  doc.text(`TOTAL NETO (Bruto - Meses Gratis): $${netAmount.toFixed(2)}`, margin, yPosition);
  yPosition += 12;

  // Tabla de pagos
  if (monthData.payments && monthData.payments.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Pagos', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Tipo', margin + 28, yPosition);
    doc.text('Cliente', margin + 50, yPosition);
    doc.text('Monto', margin + 100, yPosition);
    doc.text('Recibo', margin + 130, yPosition);
    doc.text('Notas', margin + 160, yPosition);
    yPosition += 7;

    // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
  yPosition += 3;

    doc.setFont('helvetica', 'normal');
    monthData.payments.forEach((payment) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
        // Encabezados en nueva página
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Tipo', margin + 28, yPosition);
        doc.text('Cliente', margin + 50, yPosition);
        doc.text('Monto', margin + 100, yPosition);
        doc.text('Recibo', margin + 130, yPosition);
        doc.text('Notas', margin + 160, yPosition);
        yPosition += 7;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 3;
      }
      
      const paymentDate = payment.date || payment.payment_date;
      const date = format(new Date(paymentDate), 'dd/MM/yyyy');
      const isInstallation = payment.revenue_type === 'installation';
      const type = isInstallation ? 'Inst' : 'Pago';
      const clientName = (payment.client_name || '').substring(0, 18);
      const amount = `$${parseFloat(payment.amount).toFixed(2)}`;
      const receipt = (payment.receipt_number || '-').substring(0, 15);
      let notes = payment.notes || '-';
      if (isInstallation && payment.installation_type) {
        notes = `${payment.installation_type}${notes !== '-' ? ' - ' + notes : ''}`;
      }
      notes = notes.substring(0, 20);
      
      doc.setFontSize(9);
      doc.text(date, margin, yPosition);
      doc.text(type, margin + 28, yPosition);
      doc.text(clientName, margin + 50, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(amount, margin + 100, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(receipt, margin + 130, yPosition);
      doc.text(notes, margin + 160, yPosition);
      
      if (payment.is_free_month) {
        doc.setFontSize(7);
        doc.text('🎁', margin + 95, yPosition);
      }
      
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Guardar PDF
  const fileName = `Pagos_${monthData.monthName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

export const generateMonthlyExpensesPDF = (monthData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resumen de Gastos - ${monthData.monthName}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Estadísticas del mes
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Mes', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Gastos: ${monthData.totalExpenses}`, margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0); // Rojo para gastos
  doc.text(`TOTAL GASTOS: $${monthData.totalAmount.toFixed(2)}`, margin, yPosition);
  doc.setTextColor(0, 0, 0); // Volver a negro
  doc.setFont('helvetica', 'normal');
  yPosition += 12;

  // Tabla de gastos
  if (monthData.expenses && monthData.expenses.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Gastos', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Descripción', margin + 30, yPosition);
    doc.text('Monto', margin + 110, yPosition);
    doc.text('Factura', margin + 140, yPosition);
    doc.text('Notas', margin + 170, yPosition);
    yPosition += 7;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 3;

    doc.setFont('helvetica', 'normal');
    monthData.expenses.forEach((expense) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
        // Encabezados en nueva página
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Descripción', margin + 30, yPosition);
        doc.text('Monto', margin + 110, yPosition);
        doc.text('Factura', margin + 140, yPosition);
        doc.text('Notas', margin + 170, yPosition);
        yPosition += 7;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 3;
      }
      
      const date = format(new Date(expense.expense_date), 'dd/MM/yyyy');
      const description = (expense.description || '').substring(0, 30);
      const amount = `$${parseFloat(expense.amount).toFixed(2)}`;
      const invoiceInfo = expense.supply_invoice_id 
        ? `${expense.supply_invoice_number || 'N/A'}`.substring(0, 15)
        : '-';
      const notes = (expense.notes || '-').substring(0, 15);
      
      doc.setFontSize(9);
      doc.text(date, margin, yPosition);
      doc.text(description, margin + 30, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0); // Rojo para montos de gastos
      doc.text(amount, margin + 110, yPosition);
      doc.setTextColor(0, 0, 0); // Volver a negro
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceInfo, margin + 140, yPosition);
      doc.text(notes, margin + 170, yPosition);
      
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Guardar PDF
  const fileName = `Gastos_${monthData.monthName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

export const previewMonthlyExpensesPDF = (monthData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resumen de Gastos - ${monthData.monthName}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Estadísticas del mes
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Mes', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Gastos: ${monthData.totalExpenses}`, margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0); // Rojo para gastos
  doc.text(`TOTAL GASTOS: $${monthData.totalAmount.toFixed(2)}`, margin, yPosition);
  doc.setTextColor(0, 0, 0); // Volver a negro
  doc.setFont('helvetica', 'normal');
  yPosition += 12;

  // Tabla de gastos
  if (monthData.expenses && monthData.expenses.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Gastos', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Descripción', margin + 30, yPosition);
    doc.text('Monto', margin + 110, yPosition);
    doc.text('Factura', margin + 140, yPosition);
    doc.text('Notas', margin + 170, yPosition);
    yPosition += 7;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 3;

    doc.setFont('helvetica', 'normal');
    monthData.expenses.forEach((expense) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
        // Encabezados en nueva página
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Descripción', margin + 30, yPosition);
        doc.text('Monto', margin + 110, yPosition);
        doc.text('Factura', margin + 140, yPosition);
        doc.text('Notas', margin + 170, yPosition);
        yPosition += 7;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 3;
      }
      
      const date = format(new Date(expense.expense_date), 'dd/MM/yyyy');
      const description = (expense.description || '').substring(0, 30);
      const amount = `$${parseFloat(expense.amount).toFixed(2)}`;
      const invoiceInfo = expense.supply_invoice_id 
        ? `${expense.supply_invoice_number || 'N/A'}`.substring(0, 15)
        : '-';
      const notes = (expense.notes || '-').substring(0, 15);
      
      doc.setFontSize(9);
      doc.text(date, margin, yPosition);
      doc.text(description, margin + 30, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0); // Rojo para montos de gastos
      doc.text(amount, margin + 110, yPosition);
      doc.setTextColor(0, 0, 0); // Volver a negro
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceInfo, margin + 140, yPosition);
      doc.text(notes, margin + 170, yPosition);
      
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Previsualizar PDF en nueva ventana
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const newWindow = window.open(pdfUrl, '_blank');
  if (newWindow) {
    newWindow.focus();
  }
};

export const generateMonthlySupplyInvoicesPDF = (monthData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Facturas de Insumos - ${monthData.monthName}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Estadísticas del mes
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Mes', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Facturas: ${monthData.totalInvoices}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Monto Total: $${monthData.totalAmount.toFixed(2)}`, margin, yPosition);
  yPosition += 12;

  // Tabla de facturas
  if (monthData.invoices && monthData.invoices.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Facturas', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Número', margin + 35, yPosition);
    doc.text('Empresa', margin + 80, yPosition);
    doc.text('Monto', margin + 140, yPosition);
    yPosition += 7;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 3;

    doc.setFont('helvetica', 'normal');
    monthData.invoices.forEach((invoice) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
        // Encabezados en nueva página
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Número', margin + 35, yPosition);
        doc.text('Empresa', margin + 80, yPosition);
        doc.text('Monto', margin + 140, yPosition);
        yPosition += 7;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 3;
      }
      
      const date = format(new Date(invoice.invoice_date), 'dd/MM/yyyy');
      const invoiceNumber = (invoice.invoice_number || '').substring(0, 20);
      const company = (invoice.company || '').substring(0, 30);
      const amount = `$${parseFloat(invoice.amount).toFixed(2)}`;
      
      doc.setFontSize(9);
      doc.text(date, margin, yPosition);
      doc.text(invoiceNumber, margin + 35, yPosition);
      doc.text(company, margin + 80, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(amount, margin + 140, yPosition);
      doc.setFont('helvetica', 'normal');
      
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Guardar PDF
  const fileName = `Facturas_Insumos_${monthData.monthName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

export const generateQuotationPDF = (quotation) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Encabezado
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${quotation.quotation_number}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Información de la empresa (puedes personalizar esto)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('CDCom Comunicaciones', margin, yPosition);
  yPosition += 5;
  doc.text('CDCom Internet Services', margin, yPosition);
  yPosition += 5;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 5;
  doc.text('Tel: +52 315-125-9871', margin, yPosition);
  yPosition += 5;
  doc.text('Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 10;

  // Información del cliente
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', pageWidth - margin - 50, yPosition - 15);
  doc.setFont('helvetica', 'normal');
  doc.text(quotation.client_name || '', pageWidth - margin - 50, yPosition - 8);
  if (quotation.client_address) {
    doc.text(quotation.client_address, pageWidth - margin - 50, yPosition - 3);
  }
  if (quotation.client_email) {
    doc.text(`Email: ${quotation.client_email}`, pageWidth - margin - 50, yPosition + 2);
  }
  if (quotation.client_phone) {
    doc.text(`Tel: ${quotation.client_phone}`, pageWidth - margin - 50, yPosition + 7);
  }
  yPosition += 15;

  // Fechas
  doc.setFontSize(10);
  doc.text(`Fecha: ${format(new Date(quotation.quotation_date), 'dd/MM/yyyy')}`, margin, yPosition);
  if (quotation.valid_until) {
    doc.text(`Válida hasta: ${format(new Date(quotation.valid_until), 'dd/MM/yyyy')}`, margin + 60, yPosition);
  }
  yPosition += 10;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Tabla de items
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE SERVICIOS', margin, yPosition);
  yPosition += 10;

  // Encabezados de tabla
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Descripción', margin, yPosition);
  doc.text('Cant.', margin + 85, yPosition);
  doc.text('Precio Unit.', margin + 110, yPosition);
  doc.text('Subtotal', pageWidth - margin - 20, yPosition, { align: 'right' });
  yPosition += 7;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
  yPosition += 5;

  // Items
  doc.setFont('helvetica', 'normal');
  const items = quotation.items || [];
  items.forEach((item) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
      // Encabezados en nueva página
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Descripción', margin, yPosition);
      doc.text('Cant.', margin + 85, yPosition);
      doc.text('Precio Unit.', margin + 110, yPosition);
      doc.text('Subtotal', pageWidth - margin - 20, yPosition, { align: 'right' });
      yPosition += 7;
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += 5;
    }

    const description = (item.description || '').substring(0, 35);
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const subtotal = parseFloat(item.subtotal) || 0;

    doc.setFontSize(9);
    doc.text(description, margin, yPosition);
    doc.text(quantity.toString(), margin + 85, yPosition);
    doc.text(`$${unitPrice.toFixed(2)}`, margin + 110, yPosition);
    doc.text(`$${subtotal.toFixed(2)}`, pageWidth - margin - 20, yPosition, { align: 'right' });
    yPosition += 7;
  });

  yPosition += 5;

  // Totales
  if (yPosition > 230) {
    doc.addPage();
    yPosition = margin;
  }

  const subtotal = parseFloat(quotation.subtotal) || 0;
  const discount = parseFloat(quotation.discount) || 0;
  const discountType = quotation.discount_type || 'percentage';
  let discountAmount = 0;
  if (discount > 0) {
    if (discountType === 'percentage') {
      discountAmount = subtotal * (discount / 100);
    } else {
      discountAmount = discount;
    }
  }
  const tax = parseFloat(quotation.tax) || 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = subtotalAfterDiscount * (tax / 100);
  const total = parseFloat(quotation.total) || 0;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', pageWidth - margin - 60, yPosition, { align: 'right' });
  doc.text(`$${subtotal.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 7;

  if (discountAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Descuento:', pageWidth - margin - 60, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`-$${discountAmount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 7;
  }

  if (taxAmount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Impuesto (${tax}%):`, pageWidth - margin - 60, yPosition, { align: 'right' });
    doc.text(`$${taxAmount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 7;
  }

  // Línea separadora antes del total
  doc.setDrawColor(100, 100, 100);
  doc.line(pageWidth - margin - 60, yPosition, pageWidth - margin, yPosition);
  yPosition += 7;

  // Total
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - margin - 60, yPosition, { align: 'right' });
  doc.text(`$${total.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 15;

  // Notas
  if (quotation.notes) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS:', margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(quotation.notes, pageWidth - (margin * 2));
    notesLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Términos y condiciones
  if (quotation.terms) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TÉRMINOS Y CONDICIONES:', margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(quotation.terms, pageWidth - (margin * 2));
    termsLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  const fileName = `Cotizacion_${quotation.quotation_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

// Función auxiliar para crear el contenido del PDF de folio
const createFolioPDFContent = (doc, folio) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Encabezado
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FOLIO DE REPARACIÓN', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${folio.folio_number}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Información de la empresa
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('CDCom Comunicaciones', margin, yPosition);
  yPosition += 5;
  doc.text('CDCom Internet Services', margin, yPosition);
  yPosition += 5;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 5;
  doc.text('Tel: +52 315-125-9871', margin, yPosition);
  yPosition += 5;
  doc.text('Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 10;

  // Información del cliente
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', pageWidth - margin - 50, yPosition - 15);
  doc.setFont('helvetica', 'normal');
  if (folio.client_name) {
    doc.text(folio.client_name, pageWidth - margin - 50, yPosition - 8);
  }
  if (folio.client_number) {
    doc.text(`Número: ${folio.client_number}`, pageWidth - margin - 50, yPosition - 3);
  }
  if (folio.client_address) {
    doc.text(folio.client_address, pageWidth - margin - 50, yPosition + 2);
  }
  if (folio.client_phone) {
    doc.text(`Tel: ${folio.client_phone}`, pageWidth - margin - 50, yPosition + 7);
  }
  yPosition += 15;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Información del folio
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL SERVICIO', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  // Formatear fecha correctamente sin problemas de zona horaria
  const visitDateParts = folio.visit_date ? folio.visit_date.split('T')[0].split('-') : [];
  const visitDateFormatted = visitDateParts.length === 3 
    ? `${visitDateParts[2]}/${visitDateParts[1]}/${visitDateParts[0]}`
    : format(new Date(folio.visit_date), 'dd/MM/yyyy');
  doc.text(`Fecha de Visita: ${visitDateFormatted}`, margin, yPosition);
  yPosition += 10;

  // Estado
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const status = folio.status || 'pendiente';
  const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
  doc.text(statusText, margin + 30, yPosition);
  yPosition += 10;

  // Información de resolución
  if (folio.resolution_method || folio.resolution_date || folio.resolution_cost) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE RESOLUCIÓN', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (folio.resolution_method) {
      doc.setFont('helvetica', 'bold');
      doc.text('Método de Resolución:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const methodLabels = {
        'visita-domiciliaria': 'Visita Domiciliaria',
        'chat-ia': 'Chat con IA',
        'asesor': 'Asesor',
        'remoto': 'Soporte Remoto',
        'otro': 'Otro'
      };
      const methodText = methodLabels[folio.resolution_method] || folio.resolution_method;
      doc.text(methodText, margin + 60, yPosition);
      yPosition += 10;
    }

    if (folio.resolution_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha de Resolución:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      // Formatear fecha correctamente sin problemas de zona horaria
      const resolutionDateParts = folio.resolution_date.split('T')[0].split('-');
      const resolutionDateFormatted = resolutionDateParts.length === 3 
        ? `${resolutionDateParts[2]}/${resolutionDateParts[1]}/${resolutionDateParts[0]}`
        : format(new Date(folio.resolution_date), 'dd/MM/yyyy');
      doc.text(resolutionDateFormatted, margin + 60, yPosition);
      yPosition += 10;
    }

    if (folio.resolution_cost && folio.resolution_cost > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Costo de Reparación:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(`$${parseFloat(folio.resolution_cost).toFixed(2)}`, margin + 60, yPosition);
      yPosition += 10;
    }

    yPosition += 5;
  }

  // Descripción del problema
  if (folio.problem_description) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN DEL PROBLEMA', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const problemLines = doc.splitTextToSize(folio.problem_description, pageWidth - (margin * 2));
    problemLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Notas del técnico
  if (folio.technician_notes) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS DEL TÉCNICO', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(folio.technician_notes, pageWidth - (margin * 2));
    notesLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }
};

export const generateFolioPDF = (folio) => {
  const doc = new jsPDF();
  createFolioPDFContent(doc, folio);
  const fileName = `Folio_${folio.folio_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

export const downloadFolioPDF = (folio) => {
  const doc = new jsPDF();
  createFolioPDFContent(doc, folio);

  // Guardar PDF directamente
  const fileName = `Folio_${folio.folio_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

// Función auxiliar para crear el contenido del PDF de recibo
const createReceiptPDFContent = (doc, receipt) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Encabezado
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${receipt.receipt_number}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Información de la empresa
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('CDCom Comunicaciones', margin, yPosition);
  yPosition += 5;
  doc.text('CDCom Internet Services', margin, yPosition);
  yPosition += 5;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 5;
  doc.text('Tel: +52 315-125-9871', margin, yPosition);
  yPosition += 5;
  doc.text('Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 10;

  // Información del cliente
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBÍ DE:', pageWidth - margin - 50, yPosition - 15);
  doc.setFont('helvetica', 'normal');
  const clientName = receipt.client_name || receipt.custom_name || '';
  const clientAddress = receipt.client_address || receipt.custom_address || '';
  const clientNumber = receipt.client_number || '';
  const clientPhone = receipt.client_phone || '';
  
  if (clientName) {
    doc.text(clientName, pageWidth - margin - 50, yPosition - 8);
  }
  if (clientNumber) {
    doc.text(`Número: ${clientNumber}`, pageWidth - margin - 50, yPosition - 3);
  }
  if (clientAddress) {
    doc.text(clientAddress, pageWidth - margin - 50, yPosition + 2);
  }
  if (clientPhone) {
    doc.text(`Tel: ${clientPhone}`, pageWidth - margin - 50, yPosition + 7);
  }
  yPosition += 15;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Información del recibo
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DEL PAGO', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Formatear fecha correctamente sin problemas de zona horaria
  const receiptDateParts = receipt.receipt_date ? receipt.receipt_date.split('T')[0].split('-') : [];
  const receiptDateFormatted = receiptDateParts.length === 3 
    ? `${receiptDateParts[2]}/${receiptDateParts[1]}/${receiptDateParts[0]}`
    : format(new Date(receipt.receipt_date), 'dd/MM/yyyy');
  doc.text(`Fecha: ${receiptDateFormatted}`, margin, yPosition);
  yPosition += 10;

  // Tipo de recibo
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const receiptType = receipt.receipt_type === 'mensualidad' ? 'Pago de Mensualidad' : 'Pago de Instalación';
  doc.text(receiptType, margin + 30, yPosition);
  yPosition += 10;
  
  // Método de pago
  if (receipt.payment_method) {
    const paymentMethodLabels = {
      'efectivo': 'Efectivo',
      'deposito-tarjeta': 'Depósito en Tarjeta',
      'transferencia': 'Transferencia'
    };
    const paymentMethodLabel = paymentMethodLabels[receipt.payment_method] || receipt.payment_method;
    doc.setFont('helvetica', 'bold');
    doc.text('Método de Pago:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(paymentMethodLabel, margin + 50, yPosition);
    yPosition += 10;
  }

  // Concepto
  if (receipt.concept) {
    doc.setFont('helvetica', 'bold');
    doc.text('Concepto:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const conceptLines = doc.splitTextToSize(receipt.concept, pageWidth - (margin * 2) - 40);
    doc.text(conceptLines[0], margin + 40, yPosition);
    yPosition += 7;
    if (conceptLines.length > 1) {
      conceptLines.slice(1).forEach((line) => {
        doc.text(line, margin + 40, yPosition);
        yPosition += 7;
      });
    }
    yPosition += 5;
  }

  // Monto
  const amount = parseFloat(receipt.amount) || 0;
  const isFreeMonth = receipt.concept && receipt.concept.includes('Mes Gratis');
  const isZeroAmount = amount === 0;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  if (isFreeMonth) {
    // Si es mes gratis, mostrar texto especial
    doc.text('MES GRATIS - SIN COBRO', margin, yPosition);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 150, 0); // Verde para mes gratis
    doc.text('$0.00', pageWidth - margin, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Volver a negro
  } else if (isZeroAmount) {
    // Si el monto es 0 pero no es mes gratis
    doc.text('CANTIDAD RECIBIDA:', margin, yPosition);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0); // Rojo para monto 0
    doc.text('$0.00', pageWidth - margin, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0); // Volver a negro
  } else {
    // Monto normal
    doc.text('CANTIDAD RECIBIDA:', margin, yPosition);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${amount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
  }
  yPosition += 15;

  // Línea separadora antes del monto
  doc.setDrawColor(100, 100, 100);
  doc.line(margin, yPosition - 10, pageWidth - margin, yPosition - 10);
  yPosition += 10;
  
  // Mensaje especial para mes gratis o monto 0
  if (isFreeMonth || isZeroAmount) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    if (isFreeMonth) {
      doc.setTextColor(0, 150, 0); // Verde
      doc.text('Este recibo corresponde a un mes gratis otorgado al cliente.', margin, yPosition);
    } else {
      doc.setTextColor(200, 0, 0); // Rojo
      doc.text('Este recibo corresponde a un pago con monto de $0.00.', margin, yPosition);
    }
    doc.setTextColor(0, 0, 0); // Volver a negro
    yPosition += 10;
  }

  // Notas
  if (receipt.notes) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS:', margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(receipt.notes, pageWidth - (margin * 2));
    notesLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }
};

export const generateReceiptPDF = (receipt) => {
  const doc = new jsPDF();
  createReceiptPDFContent(doc, receipt);
  const fileName = `Recibo_${receipt.receipt_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

export const downloadReceiptPDF = (receipt) => {
  const doc = new jsPDF();
  createReceiptPDFContent(doc, receipt);

  // Guardar PDF directamente
  const fileName = `Recibo_${receipt.receipt_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

// Función auxiliar simplificada para convertir números a palabras en español
const numberToWords = (num) => {
  const n = Math.floor(num);
  if (n === 0) return 'cero';
  if (n < 0) return 'menos ' + numberToWords(-n);
  
  const ones = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    if (one === 0) return tens[ten];
    if (ten === 2) return 'veinti' + ones[one];
    return tens[ten] + ' y ' + ones[one];
  }
  if (n === 100) return 'cien';
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    if (rest === 0) return hundreds[hundred];
    return hundreds[hundred] + ' ' + numberToWords(rest);
  }
  if (n < 1000000) {
    const thousand = Math.floor(n / 1000);
    const rest = n % 1000;
    const thousandWord = thousand === 1 ? 'mil' : numberToWords(thousand) + ' mil';
    if (rest === 0) return thousandWord;
    return thousandWord + ' ' + numberToWords(rest);
  }
  
  // Para números muy grandes, usar formato simplificado
  return n.toLocaleString('es-MX');
};

// Función auxiliar para crear el contenido del PDF de instalación
const createInstallationPDFContent = (doc, installation) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Encabezado
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE INSTALACIÓN', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (installation.installation_folio) {
    doc.text(`Folio: ${installation.installation_folio}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }
  yPosition += 5;

  // Información de la empresa
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('CDCom Comunicaciones', margin, yPosition);
  yPosition += 5;
  doc.text('CDCom Internet Services', margin, yPosition);
  yPosition += 5;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 5;
  doc.text('Tel: +52 315-125-9871', margin, yPosition);
  yPosition += 5;
  doc.text('Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 10;

  // Información del cliente
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', pageWidth - margin - 50, yPosition - 15);
  doc.setFont('helvetica', 'normal');
  const clientName = installation.display_name || installation.client_name || installation.custom_name || '';
  const clientAddress = installation.display_address || installation.address || installation.client_address || '';
  const clientNumber = installation.client_number || '';
  
  if (clientName) {
    doc.text(clientName, pageWidth - margin - 50, yPosition - 8);
  }
  if (clientNumber) {
    doc.text(`Número: ${clientNumber}`, pageWidth - margin - 50, yPosition - 3);
  }
  if (clientAddress) {
    const addressLines = doc.splitTextToSize(clientAddress, 50);
    addressLines.forEach((line, index) => {
      doc.text(line, pageWidth - margin - 50, yPosition + (index * 5) + 2);
    });
    yPosition += (addressLines.length - 1) * 5;
  }
  yPosition += 15;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Información de la instalación
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DE LA INSTALACIÓN', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Fecha de instalación
  const installationDateParts = installation.installation_date ? installation.installation_date.split('T')[0].split('-') : [];
  const installationDateFormatted = installationDateParts.length === 3 
    ? `${installationDateParts[2]}/${installationDateParts[1]}/${installationDateParts[0]}`
    : format(new Date(installation.installation_date), 'dd/MM/yyyy');
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de Instalación:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(installationDateFormatted, margin + 60, yPosition);
  yPosition += 10;

  // Tipo de instalación
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo de Instalación:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(installation.installation_type || '-', margin + 60, yPosition);
  yPosition += 10;

  // Paquete contratado
  if (installation.package_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Paquete Contratado:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    let packageText = installation.package_name;
    if (installation.package_speed) {
      packageText += ` - ${installation.package_speed}`;
    }
    if (installation.package_price) {
      packageText += ` - $${parseFloat(installation.package_price).toFixed(2)}`;
    }
    doc.text(packageText, margin + 60, yPosition);
    yPosition += 10;
  }

  // Teléfono de contacto
  if (installation.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Teléfono de Contacto:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(installation.phone, margin + 60, yPosition);
    yPosition += 10;
  }

  // Estado
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const status = installation.status || 'pendiente';
  const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
  doc.text(statusText, margin + 60, yPosition);
  yPosition += 10;

  // Técnico responsable
  if (installation.technician_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Técnico Responsable:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(installation.technician_name, margin + 60, yPosition);
    yPosition += 10;
  }

  // Equipo utilizado
  if (installation.equipment_used) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Equipo Utilizado:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const equipmentLines = doc.splitTextToSize(installation.equipment_used, pageWidth - (margin * 2) - 60);
    equipmentLines.forEach((line, index) => {
      doc.text(line, margin + 60, yPosition + (index * 7));
    });
    yPosition += equipmentLines.length * 7;
    yPosition += 5;
  }

  // Fecha de finalización
  if (installation.completion_date) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Finalización:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const completionDateParts = installation.completion_date.split('T')[0].split('-');
    const completionDateFormatted = completionDateParts.length === 3 
      ? `${completionDateParts[2]}/${completionDateParts[1]}/${completionDateParts[0]}`
      : format(new Date(installation.completion_date), 'dd/MM/yyyy');
    doc.text(completionDateFormatted, margin + 60, yPosition);
    yPosition += 10;
  }

  // Tiempo de instalación
  if (installation.installation_time) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tiempo de Instalación:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const hours = Math.floor(installation.installation_time / 60);
    const minutes = installation.installation_time % 60;
    const timeText = hours > 0 
      ? `${hours} hora(s) y ${minutes} minuto(s)`
      : `${minutes} minuto(s)`;
    doc.text(timeText, margin + 60, yPosition);
    yPosition += 10;
  }

  // Costo de instalación
  if (installation.installation_fee && parseFloat(installation.installation_fee) > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE PAGO', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Costo de Instalación:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`$${parseFloat(installation.installation_fee).toFixed(2)}`, margin + 60, yPosition);
    yPosition += 10;

    // Estado de pago
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado de Pago:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const isPaid = installation.is_paid === true || installation.is_paid === 1 || installation.is_paid === '1';
    doc.setTextColor(...(isPaid ? [0, 150, 0] : [200, 0, 0]));
    doc.text(isPaid ? 'Pagado' : 'Pendiente', margin + 60, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Notas
  if (installation.notes) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS', margin, yPosition);
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(installation.notes, pageWidth - (margin * 2));
    notesLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Pagaré con firma (si es crédito)
  const isCredit = installation.is_credit === true || installation.is_credit === 1 || installation.is_credit === '1';
  if (isCredit && installation.installation_fee && parseFloat(installation.installation_fee) > 0) {
    // Asegurar que haya espacio suficiente, si no, nueva página
    if (yPosition > 200) {
      doc.addPage();
      yPosition = margin;
    }
    
    yPosition += 10;
    
    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Título del pagaré
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGARÉ', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Texto del pagaré
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Fecha y lugar
    const today = new Date();
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const day = today.getDate();
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    const dateFormatted = `${day} de ${month} de ${year}`;
    const locationText = 'La Huerta, Jalisco';
    
    doc.text(`Por medio del presente, yo ${clientName}, identificado/a con la siguiente información:`, margin, yPosition);
    yPosition += 8;
    
    if (clientAddress) {
      doc.text(`Domicilio: ${clientAddress}`, margin + 10, yPosition);
      yPosition += 7;
    }
    
    if (clientNumber) {
      doc.text(`Número de Cliente: ${clientNumber}`, margin + 10, yPosition);
      yPosition += 7;
    }
    
    yPosition += 5;
    
    // Texto del compromiso de pago
    const amountText = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(parseFloat(installation.installation_fee));
    
    const promissoryText = `Me comprometo a pagar a CDCom Comunicaciones / CDCom Internet Services la cantidad de ${amountText} (${numberToWords(parseFloat(installation.installation_fee))} pesos mexicanos) correspondiente al costo de instalación del servicio de internet.`;
    
    const promissoryLines = doc.splitTextToSize(promissoryText, pageWidth - (margin * 2));
    promissoryLines.forEach((line) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin + 10;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    
    yPosition += 5;
    
    // Fecha y lugar
    doc.text(`Fecha: ${dateFormatted}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Lugar: ${locationText}`, margin, yPosition);
    yPosition += 15;

    // Espacio para firma del cliente
    const signatureY = yPosition;
    
    // Línea de firma del cliente
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, signatureY, margin + 70, signatureY);
    doc.setFontSize(9);
    doc.text('Firma del Cliente', margin + 2, signatureY + 5);
    
    yPosition = signatureY + 12;
    
    // Nombre del cliente bajo la firma
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, margin + 2, yPosition);
    
    yPosition += 15;
    
    // Nota sobre términos y condiciones
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Nota: Este pagaré es válido como documento de compromiso de pago. El cliente se compromete a liquidar el monto establecido según los términos acordados.', margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }
};

export const generateInstallationPDF = (installation) => {
  const doc = new jsPDF();
  createInstallationPDFContent(doc, installation);
  const folio = installation.installation_folio || installation.id;
  const fileName = `Instalacion_${folio}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

export const downloadInstallationPDF = (installation) => {
  const doc = new jsPDF();
  createInstallationPDFContent(doc, installation);

  // Guardar PDF directamente
  const folio = installation.installation_folio || installation.id;
  const fileName = `Instalacion_${folio}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

// Función para crear el contenido del PDF de folio de instalación completada
const createCompletionFolioPDFContent = (doc, installation) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FOLIO DE INSTALACIÓN COMPLETADA', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Folio de completado
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (installation.completion_folio) {
    doc.text(`Folio: ${installation.completion_folio}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }
  yPosition += 5;

  // Información de la empresa
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('CDCom Comunicaciones', margin, yPosition);
  yPosition += 5;
  doc.text('CDCom Internet Services', margin, yPosition);
  yPosition += 5;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 5;
  doc.text('Tel: +52 315-125-9871', margin, yPosition);
  yPosition += 5;
  doc.text('Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 10;

  // Información del cliente
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', pageWidth - margin - 50, yPosition - 15);
  doc.setFont('helvetica', 'normal');
  const clientName = installation.display_name || installation.client_name || installation.custom_name || '';
  const clientAddress = installation.display_address || installation.address || installation.client_address || '';
  const clientNumber = installation.client_number || '';
  
  if (clientName) {
    doc.text(clientName, pageWidth - margin - 50, yPosition - 8);
  }
  if (clientNumber) {
    doc.text(`Número: ${clientNumber}`, pageWidth - margin - 50, yPosition - 3);
  }
  if (clientAddress) {
    const addressLines = doc.splitTextToSize(clientAddress, 50);
    addressLines.forEach((line, index) => {
      doc.text(line, pageWidth - margin - 50, yPosition + (index * 5) + 2);
    });
    yPosition += (addressLines.length - 1) * 5;
  }
  if (installation.phone) {
    doc.text(`Teléfono: ${installation.phone}`, pageWidth - margin - 50, yPosition + 7);
    yPosition += 5;
  }
  yPosition += 15;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Información del servicio contratado
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL SERVICIO CONTRATADO', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Paquete contratado
  if (installation.package_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Paquete de Internet:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    let packageText = installation.package_name;
    if (installation.package_speed) {
      packageText += ` - ${installation.package_speed}`;
    }
    if (installation.package_price) {
      packageText += ` - $${parseFloat(installation.package_price).toFixed(2)}/mes`;
    }
    doc.text(packageText, margin + 50, yPosition);
    yPosition += 10;
  }

  // Fecha de inicio
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de Instalación:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const installationDateParts = installation.installation_date ? installation.installation_date.split('T')[0].split('-') : [];
  const installationDateFormatted = installationDateParts.length === 3 
    ? `${installationDateParts[2]}/${installationDateParts[1]}/${installationDateParts[0]}`
    : format(new Date(installation.installation_date), 'dd/MM/yyyy');
  doc.text(installationDateFormatted, margin + 50, yPosition);
  yPosition += 10;

  // Fecha de completado
  if (installation.completion_date) {
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Completado:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const completionDateParts = installation.completion_date.split('T')[0].split('-');
    const completionDateFormatted = completionDateParts.length === 3 
      ? `${completionDateParts[2]}/${completionDateParts[1]}/${completionDateParts[0]}`
      : format(new Date(installation.completion_date), 'dd/MM/yyyy');
    doc.text(completionDateFormatted, margin + 50, yPosition);
    yPosition += 10;
  }

  // Tipo de instalación
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo de Instalación:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(installation.installation_type || '-', margin + 50, yPosition);
  yPosition += 10;

  // Técnico responsable
  if (installation.technician_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Técnico Responsable:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(installation.technician_name, margin + 50, yPosition);
    yPosition += 10;
  }

  // Equipo utilizado
  if (installation.equipment_used) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Equipo Utilizado:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const equipmentLines = doc.splitTextToSize(installation.equipment_used, pageWidth - (margin * 2) - 50);
    equipmentLines.forEach((line, index) => {
      doc.text(line, margin + 50, yPosition + (index * 7));
    });
    yPosition += equipmentLines.length * 7;
    yPosition += 5;
  }

  // Tiempo de instalación
  if (installation.installation_time) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tiempo de Instalación:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const hours = Math.floor(installation.installation_time / 60);
    const minutes = installation.installation_time % 60;
    const timeText = hours > 0 
      ? `${hours} hora(s) y ${minutes} minuto(s)`
      : `${minutes} minuto(s)`;
    doc.text(timeText, margin + 50, yPosition);
    yPosition += 10;
  }

  // Información de pago
  if (installation.installation_fee && parseFloat(installation.installation_fee) > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE PAGO', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Costo de Instalación:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`$${parseFloat(installation.installation_fee).toFixed(2)}`, margin + 50, yPosition);
    yPosition += 10;

    // Estado de pago
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado de Pago:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const isPaid = installation.is_paid === true || installation.is_paid === 1 || installation.is_paid === '1';
    doc.setTextColor(...(isPaid ? [0, 150, 0] : [200, 0, 0]));
    doc.text(isPaid ? 'Pagado' : 'Pendiente', margin + 50, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Notas
  if (installation.notes) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTAS ADICIONALES', margin, yPosition);
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(installation.notes, pageWidth - (margin * 2));
    notesLines.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });
    yPosition += 5;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }
};

// Generar PDF de folio de instalación completada (toast opcional para mostrar errores)
export const generateCompletionFolioPDF = (installation, toast) => {
  if (!installation.completion_folio) {
    const msg = 'Esta instalación no tiene un folio de completado. Debe estar marcada como completada para generar el folio.';
    if (toast && typeof toast.error === 'function') toast.error(msg);
    else alert(msg);
    return;
  }

  const doc = new jsPDF();
  createCompletionFolioPDFContent(doc, installation);
  const folio = installation.completion_folio;
  const fileName = `Folio_Completado_${folio}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

// Descargar PDF de folio de instalación completada (toast opcional)
export const downloadCompletionFolioPDF = (installation, toast) => {
  if (!installation.completion_folio) {
    const msg = 'Esta instalación no tiene un folio de completado. Debe estar marcada como completada para generar el folio.';
    if (toast && typeof toast.error === 'function') toast.error(msg);
    else alert(msg);
    return;
  }

  const doc = new jsPDF();
  createCompletionFolioPDFContent(doc, installation);
  const folio = installation.completion_folio;
  const fileName = `Folio_Completado_${folio}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

// Generar PDF de contrato/bienvenida para cliente nuevo
export const generateClientContractPDF = (client, contractData) => {
  const doc = new jsPDF();
  createClientContractPDFContent(doc, client, contractData);
  const clientName = (client.name || 'Cliente').replace(/\s+/g, '_');
  const fileName = `Contrato_${clientName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

// Función auxiliar para crear el contenido del PDF de contrato
const createClientContractPDFContent = (doc, client, contractData) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const footerHeight = 15; // Espacio para el pie de página
  const maxContentHeight = pageHeight - margin - footerHeight;
  let yPosition = margin;
  
  // Calcular altura real del contenido fijo (sin términos y notas)
  // Primero estimamos con tamaños base
  let baseFixedHeight = 0;
  baseFixedHeight += 18; // Título y subtítulo
  baseFixedHeight += 32; // Info empresa y cliente (incluyendo red y correo)
  baseFixedHeight += 20; // Servicio contratado (paquete, duración, inicio)
  if (contractData.paymentMethods && contractData.paymentMethods.length > 0) {
    const methodsText = contractData.paymentMethods.join(', ');
    baseFixedHeight += 5 + doc.splitTextToSize(methodsText, pageWidth - (margin * 2) - 40).length * 4;
  }
  if (contractData.businessHours) {
    baseFixedHeight += 5 + doc.splitTextToSize(contractData.businessHours || '', pageWidth - (margin * 2) - 40).length * 4;
  }
  baseFixedHeight += 12; // Contacto
  
  // Calcular altura de términos y notas
  const termsLines = contractData.termsAndConditions 
    ? doc.splitTextToSize(contractData.termsAndConditions || '', pageWidth - (margin * 2) - 30)
    : [];
  const notesLines = contractData.additionalNotes
    ? doc.splitTextToSize(contractData.additionalNotes || '', pageWidth - (margin * 2) - 30)
    : [];
  
  const termsHeight = termsLines.length * 4;
  const notesHeight = notesLines.length * 4;
  const totalVariableHeight = termsHeight + notesHeight;
  
  // Calcular espacio disponible para términos y notas
  const spaceForTermsAndNotes = maxContentHeight - baseFixedHeight;
  
  // Si hay mucho contenido variable, calcular factor de compresión
  let compressionFactor = 1;
  if (totalVariableHeight > spaceForTermsAndNotes && spaceForTermsAndNotes > 0) {
    compressionFactor = Math.max(0.5, spaceForTermsAndNotes / totalVariableHeight);
  }
  
  // Calcular altura total estimada
  const estimatedTotalHeight = baseFixedHeight + (totalVariableHeight * compressionFactor);
  
  // Factor de expansión para usar todo el espacio disponible
  const availableSpace = maxContentHeight - estimatedTotalHeight;
  const expansionFactor = availableSpace > 0 && baseFixedHeight > 0 
    ? 1 + (availableSpace / baseFixedHeight) * 0.6 
    : 1;
  
  // Asegurar que el factor esté en un rango razonable
  const spaceFactor = Math.min(1.8, Math.max(0.9, expansionFactor));

  // Título principal (ajustado dinámicamente)
  const titleSize = Math.min(18, 12 + (spaceFactor * 6));
  doc.setFontSize(titleSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('BIENVENIDO A CDCOM COMUNICACIONES', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6 * spaceFactor;

  const subtitleSize = Math.min(11, 8 + (spaceFactor * 3));
  doc.setFontSize(subtitleSize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Información de su Contrato de Servicio', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8 * spaceFactor;

  // Información de la empresa (ajustada dinámicamente)
  const companyLabelSize = Math.min(9, 7 + (spaceFactor * 2));
  doc.setFontSize(companyLabelSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('EMPRESA', margin, yPosition);
  yPosition += 4 * spaceFactor;
  doc.setFont('helvetica', 'normal');
  const companyTextSize = Math.min(8, 7 + spaceFactor);
  doc.setFontSize(companyTextSize);
  doc.text('CDCom Comunicaciones | CDCom Internet Services', margin, yPosition);
  yPosition += 3.5 * spaceFactor;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin, yPosition);
  yPosition += 3.5 * spaceFactor;
  doc.text('Tel: +52 315-125-9871 | Email: cdcomcomunicaciones@gmail.com', margin, yPosition);
  yPosition += 7 * spaceFactor;

  // Información del cliente (ajustada dinámicamente)
  const clientLabelSize = Math.min(9, 7 + (spaceFactor * 2));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(clientLabelSize);
  doc.text('CLIENTE', pageWidth - margin - 50, yPosition - 8 * spaceFactor);
  doc.setFont('helvetica', 'normal');
  const clientTextSize = Math.min(8, 7 + spaceFactor);
  doc.setFontSize(clientTextSize);
  if (client.name) {
    doc.text(client.name, pageWidth - margin - 50, yPosition - 4 * spaceFactor);
  }
  if (client.client_number) {
    doc.text(`N°: ${client.client_number}`, pageWidth - margin - 50, yPosition);
  }
  if (client.address) {
    const addressLines = doc.splitTextToSize(client.address, 50);
    addressLines.forEach((line, index) => {
      doc.text(line, pageWidth - margin - 50, yPosition + (index * 3.5 * spaceFactor) + 3 * spaceFactor);
    });
    yPosition += (addressLines.length - 1) * 3.5 * spaceFactor;
  }
  if (client.phone) {
    doc.text(`Tel: ${client.phone}`, pageWidth - margin - 50, yPosition + 6 * spaceFactor);
  }
  if (client.email || contractData.email) {
    doc.text(`Email: ${client.email || contractData.email}`, pageWidth - margin - 50, yPosition + 9 * spaceFactor);
  }
  if (client.network_type || contractData.networkType) {
    doc.text(`Red: ${client.network_type || contractData.networkType}`, pageWidth - margin - 50, yPosition + 12 * spaceFactor);
    yPosition += 3 * spaceFactor;
  }
  yPosition += 10 * spaceFactor;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6 * spaceFactor;

  // Información del servicio contratado
  const serviceTitleSize = Math.min(11, 9 + (spaceFactor * 2));
  doc.setFontSize(serviceTitleSize);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL SERVICIO CONTRATADO', margin, yPosition);
  yPosition += 5 * spaceFactor;

  const serviceTextSize = Math.min(9, 8 + spaceFactor);
  doc.setFontSize(serviceTextSize);
  doc.setFont('helvetica', 'normal');

  // Paquete contratado
  if (client.package_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Paquete:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    let packageText = client.package_name;
    if (client.speed) {
      packageText += ` - ${client.speed}`;
    }
    if (client.package_price) {
      packageText += ` - $${parseFloat(client.package_price).toFixed(2)}/mes`;
    }
    doc.text(packageText, margin + 35, yPosition);
    yPosition += 5 * spaceFactor;
  }

  // Duración del contrato
  if (contractData.contractMonths) {
    doc.setFont('helvetica', 'bold');
    doc.text('Duración:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`${contractData.contractMonths} ${contractData.contractMonths === 1 ? 'mes' : 'meses'}`, margin + 35, yPosition);
    yPosition += 5 * spaceFactor;
  }

  // Fecha de inicio
  if (contractData.startDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Inicio:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const startDateParts = contractData.startDate.split('-');
    const startDateFormatted = startDateParts.length === 3 
      ? `${startDateParts[2]}/${startDateParts[1]}/${startDateParts[0]}`
      : contractData.startDate;
    doc.text(startDateFormatted, margin + 35, yPosition);
    yPosition += 5 * spaceFactor;
  }

  // Métodos de pago aceptados
  if (contractData.paymentMethods && contractData.paymentMethods.length > 0) {
    yPosition += 2 * spaceFactor;
    const paymentLabelSize = Math.min(10, 8 + (spaceFactor * 2));
    doc.setFontSize(paymentLabelSize);
    doc.setFont('helvetica', 'bold');
    doc.text('Métodos de Pago:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const paymentTextSize = Math.min(8, 7 + spaceFactor);
    doc.setFontSize(paymentTextSize);
    const methodsText = contractData.paymentMethods.join(', ');
    const methodsLines = doc.splitTextToSize(methodsText, pageWidth - (margin * 2) - 40);
    methodsLines.forEach((line, index) => {
      doc.text(line, margin + 40, yPosition + (index * 3.5 * spaceFactor));
    });
    yPosition += methodsLines.length * 3.5 * spaceFactor + 2 * spaceFactor;
  }

  // Horarios de atención
  if (contractData.businessHours) {
    const hoursLabelSize = Math.min(10, 8 + (spaceFactor * 2));
    doc.setFontSize(hoursLabelSize);
    doc.setFont('helvetica', 'bold');
    doc.text('Horarios:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const hoursTextSize = Math.min(8, 7 + spaceFactor);
    doc.setFontSize(hoursTextSize);
    const hoursLines = doc.splitTextToSize(contractData.businessHours, pageWidth - (margin * 2) - 40);
    hoursLines.forEach((line, index) => {
      doc.text(line, margin + 40, yPosition + (index * 3.5 * spaceFactor));
    });
    yPosition += hoursLines.length * 3.5 * spaceFactor + 2 * spaceFactor;
  }

  // Información de contacto (ajustada dinámicamente)
  yPosition += 2 * spaceFactor;
  const contactLabelSize = Math.min(10, 8 + (spaceFactor * 2));
  doc.setFontSize(contactLabelSize);
  doc.setFont('helvetica', 'bold');
  doc.text('Contacto:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const contactTextSize = Math.min(8, 7 + spaceFactor);
  doc.setFontSize(contactTextSize);
  doc.text('Tel: +52 315-125-9871 | Email: cdcomcomunicaciones@gmail.com', margin + 30, yPosition);
  yPosition += 3.5 * spaceFactor;
  doc.text('12 de octubre #16, La Huerta, Jalisco, CP 48850', margin + 30, yPosition);
  yPosition += 4 * spaceFactor;

  // Calcular espacio restante para términos y notas
  const remainingSpace = maxContentHeight - yPosition;
  
  // Términos y condiciones (ajustado dinámicamente)
  if (contractData.termsAndConditions) {
    yPosition += 3 * spaceFactor;
    const termsLabelSize = Math.min(11, 9 + (spaceFactor * 2));
    doc.setFontSize(termsLabelSize);
    doc.setFont('helvetica', 'bold');
    doc.text('Términos y Condiciones:', margin, yPosition);
    yPosition += 4 * spaceFactor; // Espacio después del título
    
    // Calcular cuánto espacio queda para términos (dejar espacio para notas si existen)
    const spaceForTerms = contractData.additionalNotes 
      ? remainingSpace * 0.6 
      : remainingSpace * 0.85;
    
    const termsTextSize = Math.min(9, 7 + (spaceFactor * 2));
    doc.setFontSize(termsTextSize);
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(contractData.termsAndConditions, pageWidth - (margin * 2) - 30);
    const lineHeight = 3.5 * spaceFactor * compressionFactor;
    const maxTermsLines = Math.floor(spaceForTerms / lineHeight);
    const termsLinesToShow = Math.min(termsLines.length, maxTermsLines);
    
    termsLines.slice(0, termsLinesToShow).forEach((line, index) => {
      doc.text(line, margin + 30, yPosition + (index * lineHeight));
    });
    yPosition += termsLinesToShow * lineHeight + 4 * spaceFactor;
  }

  // Notas adicionales (ajustado dinámicamente)
  if (contractData.additionalNotes) {
    const remainingSpaceForNotes = maxContentHeight - yPosition;
    if (remainingSpaceForNotes > 20) {
      yPosition += 2 * spaceFactor;
      const notesLabelSize = Math.min(11, 9 + (spaceFactor * 2));
      doc.setFontSize(notesLabelSize);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas Adicionales:', margin, yPosition);
      yPosition += 4 * spaceFactor; // Espacio después del título
      
      const notesTextSize = Math.min(9, 7 + (spaceFactor * 2));
      doc.setFontSize(notesTextSize);
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(contractData.additionalNotes, pageWidth - (margin * 2) - 30);
      const lineHeight = 3.5 * spaceFactor * compressionFactor;
      const maxNotesLines = Math.floor(remainingSpaceForNotes / lineHeight);
      const notesLinesToShow = Math.min(notesLines.length, maxNotesLines);
      
      notesLines.slice(0, notesLinesToShow).forEach((line, index) => {
        doc.text(line, margin + 30, yPosition + (index * lineHeight));
      });
      yPosition += notesLinesToShow * lineHeight;
    }
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }
};

// Descargar PDF de contrato directamente
export const downloadClientContractPDF = (client, contractData) => {
  const doc = new jsPDF();
  createClientContractPDFContent(doc, client, contractData);
  
  // Guardar PDF directamente
  const clientName = client.name.replace(/\s+/g, '_');
  const fileName = `Contrato_${clientName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

// Generar PDF completo del mes con toda la información
export const previewMonthlyCompletePDF = (monthData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Título principal
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`Reporte Completo del Mes - ${monthData.monthName}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // ========== RESUMEN FINANCIERO ==========
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
  doc.text('Resumen Financiero', margin, yPosition);
  yPosition += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Ingresos
  const totalReceived = monthData.totalReceived || 0;
  const totalReceivedWithoutInstallations = monthData.totalReceivedWithoutInstallations || totalReceived;
  const totalInstallations = monthData.totalInstallationsAmount || 0;
  const totalExpenses = monthData.totalExpenses || 0;
  const totalPaidToProviders = monthData.totalPaidToProviders || 0;
  const totalTransfers = monthData.totalTransfers || 0;
  const freeMonthsAmountMonth = monthData.freeMonthsAmount || 0;
  const freeMonthsCountMonth = monthData.freeMonthsCount || 0;
  
  // Ganancia neta: NUNCA incluye ingresos por instalación. Solo mensualidad neta − gastos − proveedores − transferencias.
  const netProfit = monthData.netRevenueWithInstallations !== undefined 
    ? monthData.netRevenueWithInstallations 
    : (totalReceivedWithoutInstallations - totalPaidToProviders - totalExpenses - totalTransfers);

  doc.setFont('helvetica', 'bold');
  doc.text('Ingresos por mensualidad (neto):', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalReceivedWithoutInstallations.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  if (freeMonthsAmountMonth > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Meses gratis (descontados):', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 0, 0);
    doc.text(`−$${freeMonthsAmountMonth.toFixed(2)} (${freeMonthsCountMonth} ${freeMonthsCountMonth === 1 ? 'mes' : 'meses'})`, pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Ingresos por instalaciones:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalInstallations.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Total ingresos:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalReceived.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Pagos a Proveedores:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 0, 0);
  doc.text(`$${totalPaidToProviders.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Otros Gastos:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 0, 0);
  doc.text(`$${totalExpenses.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  if (totalTransfers > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Transferencias:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 0, 0);
    doc.text(`$${totalTransfers.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
  }

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Ganancia Neta - NUNCA incluye ingresos por instalación. Solo mensualidad neta − gastos − proveedores − transferencias.
  let finalNetProfit = netProfit;
  
  if (monthData.netRevenueWithInstallations !== undefined) {
    finalNetProfit = monthData.netRevenueWithInstallations;
  } else {
    finalNetProfit = totalReceivedWithoutInstallations - totalPaidToProviders - totalExpenses - totalTransfers;
  }
  
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  if (finalNetProfit >= 0) {
    doc.setFillColor(220, 255, 220);
    doc.setTextColor(0, 150, 0);
  } else {
    doc.setFillColor(255, 220, 220);
    doc.setTextColor(200, 0, 0);
  }
  doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 12, 'F');
  doc.text('GANANCIA NETA (Final):', margin, yPosition);
  doc.text(`$${finalNetProfit.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;
  
  // Nota explicativa
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('(Total recibido - Pagos a proveedores - Gastos - Transferencias)', margin + 5, yPosition);
  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  // ========== PAGOS DEL MES ==========
  if (monthData.payments && monthData.payments.length > 0) {
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Pagos del Mes', margin, yPosition);
    yPosition += 12;

    // Resumen de pagos
    const freeMonthsAmount = monthData.payments
      .filter(p => p.is_free_month === true || p.is_free_month === 1 || p.is_free_month === '1')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const netPayments = (monthData.totalPaymentsAmount || 0) - freeMonthsAmount;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Pagos: ${monthData.payments.length}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Monto Total Bruto: $${(monthData.totalPaymentsAmount || 0).toFixed(2)}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Meses Gratis: $${freeMonthsAmount.toFixed(2)}`, margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Neto: $${netPayments.toFixed(2)}`, margin, yPosition);
    yPosition += 10;

    // Tabla de pagos
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Cliente', margin + 30, yPosition);
    doc.text('Monto', margin + 90, yPosition);
    doc.text('Tipo', margin + 120, yPosition);
    doc.text('Recibo', margin + 150, yPosition);
    yPosition += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;

    doc.setFont('helvetica', 'normal');
    monthData.payments.slice(0, 20).forEach((payment) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
        // Encabezados en nueva página
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Cliente', margin + 30, yPosition);
        doc.text('Monto', margin + 90, yPosition);
        doc.text('Tipo', margin + 120, yPosition);
        doc.text('Recibo', margin + 150, yPosition);
        yPosition += 6;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 4;
        doc.setFont('helvetica', 'normal');
      }

      const date = format(new Date(payment.date || payment.payment_date), 'dd/MM/yyyy');
      const clientName = (payment.client_name || payment.display_name || '-').substring(0, 25);
      const amount = parseFloat(payment.amount) || 0;
      const isFree = payment.is_free_month === true || payment.is_free_month === 1 || payment.is_free_month === '1';
      const paymentType = payment.revenue_type === 'installation' ? 'Instalación' : 'Mensualidad';
      const receipt = payment.receipt_number || '-';

      doc.setFontSize(8);
      doc.text(date, margin, yPosition);
      doc.text(clientName, margin + 30, yPosition);
      if (isFree) {
        doc.setTextColor(200, 0, 0);
      }
      doc.text(`$${amount.toFixed(2)}`, margin + 90, yPosition);
      doc.setTextColor(0, 0, 0);
      doc.text(paymentType, margin + 120, yPosition);
      doc.text(receipt.substring(0, 15), margin + 150, yPosition);
      yPosition += 6;
    });

    if (monthData.payments.length > 20) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`... y ${monthData.payments.length - 20} pagos más`, margin, yPosition);
      yPosition += 8;
    }

    yPosition += 10;
  }

  // ========== CRÉDITOS Y ABONOS ==========
  const creditsInMonth = monthData.creditsInMonth || [];
  const creditPaymentsInMonth = monthData.creditPaymentsInMonth || [];
  const totalCreditPaymentsAmount = monthData.totalCreditPaymentsAmount || 0;
  if (creditsInMonth.length > 0 || creditPaymentsInMonth.length > 0) {
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Créditos y abonos', margin, yPosition);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (creditsInMonth.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Créditos abiertos en el mes: ${creditsInMonth.length}`, margin, yPosition);
      yPosition += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha', margin, yPosition);
      doc.text('Cliente', margin + 28, yPosition);
      doc.text('Tipo', margin + 75, yPosition);
      doc.text('Total', margin + 100, yPosition);
      doc.text('Pend.', margin + 130, yPosition);
      yPosition += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += 4;
      doc.setFont('helvetica', 'normal');
      creditsInMonth.slice(0, 15).forEach((cr) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = margin;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Fecha', margin, yPosition);
          doc.text('Cliente', margin + 28, yPosition);
          doc.text('Tipo', margin + 75, yPosition);
          doc.text('Total', margin + 100, yPosition);
          doc.text('Pend.', margin + 130, yPosition);
          yPosition += 6;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += 4;
          doc.setFont('helvetica', 'normal');
        }
        const date = format(new Date(cr.created_at), 'dd/MM/yyyy');
        const clientName = (cr.display_name || cr.client_name || '-').substring(0, 22);
        const type = cr.credit_type === 'instalacion' ? 'Instal.' : 'Mens.';
        const total = parseFloat(cr.total_amount) || 0;
        const pending = parseFloat(cr.remaining_amount) || 0;
        doc.text(date, margin, yPosition);
        doc.text(clientName, margin + 28, yPosition);
        doc.text(type, margin + 75, yPosition);
        doc.text(`$${total.toFixed(2)}`, margin + 100, yPosition);
        doc.text(`$${pending.toFixed(2)}`, margin + 130, yPosition);
        yPosition += 6;
      });
      if (creditsInMonth.length > 15) {
        doc.setFont('helvetica', 'italic');
        doc.text(`... y ${creditsInMonth.length - 15} créditos más`, margin, yPosition);
        yPosition += 8;
      }
      yPosition += 6;
    }

    if (creditPaymentsInMonth.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Abonos al crédito en el mes: ${creditPaymentsInMonth.length} — Total: $${totalCreditPaymentsAmount.toFixed(2)}`, margin, yPosition);
      yPosition += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha', margin, yPosition);
      doc.text('Cliente', margin + 28, yPosition);
      doc.text('Tipo', margin + 75, yPosition);
      doc.text('Monto', margin + 100, yPosition);
      yPosition += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += 4;
      doc.setFont('helvetica', 'normal');
      creditPaymentsInMonth.slice(0, 15).forEach((cp) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = margin;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Fecha', margin, yPosition);
          doc.text('Cliente', margin + 28, yPosition);
          doc.text('Tipo', margin + 75, yPosition);
          doc.text('Monto', margin + 100, yPosition);
          yPosition += 6;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += 4;
          doc.setFont('helvetica', 'normal');
        }
        const date = format(new Date(cp.payment_date), 'dd/MM/yyyy');
        const clientName = (cp.display_name || cp.client_name || '-').substring(0, 22);
        const type = cp.credit_type === 'instalacion' ? 'Instal.' : 'Mens.';
        const amount = parseFloat(cp.amount) || 0;
        doc.text(date, margin, yPosition);
        doc.text(clientName, margin + 28, yPosition);
        doc.text(type, margin + 75, yPosition);
        doc.setTextColor(0, 120, 0);
        doc.text(`$${amount.toFixed(2)}`, margin + 100, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
      });
      if (creditPaymentsInMonth.length > 15) {
        doc.setFont('helvetica', 'italic');
        doc.text(`... y ${creditPaymentsInMonth.length - 15} abonos más`, margin, yPosition);
        yPosition += 8;
      }
      yPosition += 6;
    }

    doc.setFont('helvetica', 'normal');
    yPosition += 4;
  }

  // ========== GASTOS DEL MES ==========
  if (monthData.expenses && monthData.expenses.length > 0) {
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Gastos del Mes', margin, yPosition);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Gastos: ${monthData.expenses.length}`, margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(`Total: $${(monthData.totalExpensesAmount || 0).toFixed(2)}`, margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Tabla de gastos
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Descripción', margin + 30, yPosition);
    doc.text('Monto', margin + 100, yPosition);
    yPosition += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;

    doc.setFont('helvetica', 'normal');
    monthData.expenses.slice(0, 15).forEach((expense) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Descripción', margin + 30, yPosition);
        doc.text('Monto', margin + 100, yPosition);
        yPosition += 6;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 4;
        doc.setFont('helvetica', 'normal');
      }

      const date = format(new Date(expense.expense_date), 'dd/MM/yyyy');
      const description = (expense.description || '-').substring(0, 40);
      const amount = parseFloat(expense.amount) || 0;

      doc.setFontSize(8);
      doc.text(date, margin, yPosition);
      doc.text(description, margin + 30, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0);
      doc.text(`$${amount.toFixed(2)}`, margin + 100, yPosition);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;
    });

    if (monthData.expenses.length > 15) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`... y ${monthData.expenses.length - 15} gastos más`, margin, yPosition);
      yPosition += 8;
    }

    yPosition += 10;
  }

  // ========== PAGOS A PROVEEDORES ==========
  if (monthData.providerPayments && monthData.providerPayments.length > 0) {
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Pagos a Proveedores', margin, yPosition);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Pagos: ${monthData.providerPayments.length}`, margin, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(`Total Pagado: $${(monthData.totalPaidToProviders || 0).toFixed(2)}`, margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Tabla de pagos a proveedores
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, yPosition);
    doc.text('Red', margin + 30, yPosition);
    doc.text('Monto Total', margin + 70, yPosition);
    doc.text('Monto Pagado', margin + 110, yPosition);
    doc.text('Pendiente', margin + 150, yPosition);
    yPosition += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;

    doc.setFont('helvetica', 'normal');
    monthData.providerPayments.forEach((payment) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, yPosition);
        doc.text('Red', margin + 30, yPosition);
        doc.text('Monto Total', margin + 70, yPosition);
        doc.text('Monto Pagado', margin + 110, yPosition);
        doc.text('Pendiente', margin + 150, yPosition);
        yPosition += 6;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 4;
        doc.setFont('helvetica', 'normal');
      }

      const date = format(new Date(payment.payment_date), 'dd/MM/yyyy');
      const network = payment.network_type || '-';
      const totalAmount = parseFloat(payment.total_amount) || 0;
      const paidAmount = parseFloat(payment.paid_amount) || 0;
      const remaining = totalAmount - paidAmount;

      doc.setFontSize(8);
      doc.text(date, margin, yPosition);
      doc.text(network.substring(0, 15), margin + 30, yPosition);
      doc.text(`$${totalAmount.toFixed(2)}`, margin + 70, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0);
      doc.text(`$${paidAmount.toFixed(2)}`, margin + 110, yPosition);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`$${remaining.toFixed(2)}`, margin + 150, yPosition);
      yPosition += 6;
    });

    yPosition += 10;
  }

  // ========== DISTRIBUCIÓN POR INVERSIONISTA ==========
  const investorDist = monthData.investorDistribution;
  if (investorDist && investorDist.distribution && investorDist.distribution.length > 0) {
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Distribución por inversionista', margin, yPosition);
    yPosition += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    // Ganancia: solo mensualidad; los ingresos por instalación NUNCA entran en la ganancia
    const totalProfit = investorDist.total_profit != null
      ? investorDist.total_profit
      : (monthData.netRevenueWithInstallations ?? (totalReceivedWithoutInstallations - totalPaidToProviders - totalExpenses - totalTransfers));
    doc.text(`Ganancia neta final (mensualidad neta − gastos (incluye proveedor) − transferencias): $${(totalProfit || 0).toFixed(2)}`, margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    const colNombre = margin;
    const colPct = margin + 90;
    const colMonto = pageWidth - margin - 40;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Inversionista', colNombre, yPosition);
    doc.text('Porcentaje', colPct, yPosition);
    doc.text('Le corresponde', colMonto, yPosition, { align: 'right' });
    yPosition += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    investorDist.distribution.forEach((d) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text((d.name || '-').substring(0, 35), colNombre, yPosition);
      doc.text(`${parseFloat(d.percentage || 0).toFixed(1)}%`, colPct, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 100, 0);
      doc.text(`$${(parseFloat(d.profit) || 0).toFixed(2)}`, colMonto, yPosition, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      yPosition += 7;
    });
    yPosition += 8;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Abrir o descargar PDF (evita bloqueos de pop-up)
  const fileName = `Reporte_Mensual_${monthData.monthName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  openPdfInNewTab(doc, fileName);
};

/** Generar y abrir/descargar PDF del reporte completo del mes (mismo contenido que previewMonthlyCompletePDF). */
export const generateMonthlyCompletePDF = previewMonthlyCompletePDF;

// Generar PDF del reporte anual consolidado
export const generateAnnualReportPDF = (annualData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Título principal
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(`Reporte Anual ${annualData.year}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // ========== RESUMEN FINANCIERO ANUAL ==========
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 12, 'F');
  doc.text('Resumen Financiero Anual', margin, yPosition);
  yPosition += 15;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const totalReceived = annualData.totalReceived || 0;
  const totalReceivedWithoutInstallations = annualData.totalReceivedWithoutInstallations || totalReceived;
  const totalInstallations = annualData.totalInstallationsAmount || 0;
  const totalExpenses = annualData.totalExpensesAmount || 0;
  const totalPaidToProviders = annualData.totalPaidToProviders || 0;
  const totalTransfers = annualData.totalTransfers || 0;
  // Ganancia anual: solo mensualidad; instalaciones no entran
  const netProfit = annualData.netRevenueWithInstallations ?? (totalReceivedWithoutInstallations - totalPaidToProviders - totalExpenses - totalTransfers);
  const freeMonthsAmount = annualData.freeMonthsAmount || 0;

  doc.setFont('helvetica', 'bold');
  doc.text('Ingresos por mensualidad (neto):', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalReceivedWithoutInstallations.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Ingresos por instalaciones:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalInstallations.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Total ingresos:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 150, 0);
  doc.text(`$${totalReceived.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  if (freeMonthsAmount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Meses Gratis (descontados):', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 0, 0);
    doc.text(`$${freeMonthsAmount.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Pagos a Proveedores:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 0, 0);
  doc.text(`$${totalPaidToProviders.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Otros Gastos:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 0, 0);
  doc.text(`$${totalExpenses.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 8;

  if (totalTransfers > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Transferencias:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 0, 0);
    doc.text(`$${totalTransfers.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += 8;
  }

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Ganancia Neta Anual
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  if (netProfit >= 0) {
    doc.setFillColor(220, 255, 220);
    doc.setTextColor(0, 150, 0);
  } else {
    doc.setFillColor(255, 220, 220);
    doc.setTextColor(200, 0, 0);
  }
  doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 12, 'F');
  doc.text('GANANCIA NETA ANUAL (Final):', margin, yPosition);
  doc.text(`$${netProfit.toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  yPosition += 10;

  // Estadísticas generales
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Pagos: ${annualData.payments ? annualData.payments.length : 0}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Total de Gastos: ${annualData.expenses ? annualData.expenses.length : 0}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Total de Pagos a Proveedores: ${annualData.providerPayments ? annualData.providerPayments.length : 0}`, margin, yPosition);
  yPosition += 12;

  // ========== DESGLOSE MENSUAL ==========
  if (annualData.monthlyBreakdown && annualData.monthlyBreakdown.length > 0) {
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 10, 'F');
    doc.text('Desglose Mensual', margin, yPosition);
    yPosition += 12;

    // Encabezados de tabla
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Mes', margin, yPosition);
    doc.text('Ingresos', margin + 30, yPosition);
    doc.text('Gastos', margin + 70, yPosition);
    doc.text('Egresos', margin + 100, yPosition);
    doc.text('Ganancia', margin + 130, yPosition);
    doc.text('Pagos', margin + 160, yPosition);
    yPosition += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;

    doc.setFont('helvetica', 'normal');
    annualData.monthlyBreakdown.forEach((month) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
        // Reimprimir encabezados
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Mes', margin, yPosition);
        doc.text('Ingresos', margin + 30, yPosition);
        doc.text('Gastos', margin + 70, yPosition);
        doc.text('Egresos', margin + 100, yPosition);
        doc.text('Ganancia', margin + 130, yPosition);
        doc.text('Pagos', margin + 160, yPosition);
        yPosition += 6;
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 4;
        doc.setFont('helvetica', 'normal');
      }

      const monthName = month.monthName.charAt(0).toUpperCase() + month.monthName.slice(1);
      doc.setFontSize(8);
      doc.text(monthName.substring(0, 10), margin, yPosition);
      
      doc.setTextColor(0, 150, 0);
      doc.text(`$${month.totalReceived.toFixed(2)}`, margin + 30, yPosition);
      doc.setTextColor(0, 0, 0);
      
      doc.setTextColor(200, 0, 0);
      doc.text(`$${month.totalExpenses.toFixed(2)}`, margin + 70, yPosition);
      doc.text(`$${month.totalEgresos.toFixed(2)}`, margin + 100, yPosition);
      doc.setTextColor(0, 0, 0);
      
      if (month.netRevenue >= 0) {
        doc.setTextColor(0, 150, 0);
      } else {
        doc.setTextColor(200, 0, 0);
      }
      doc.text(`$${month.netRevenue.toFixed(2)}`, margin + 130, yPosition);
      doc.setTextColor(0, 0, 0);
      
      doc.text(`${month.paymentCount}`, margin + 160, yPosition);
      
      yPosition += 7;
    });

    // Totales
    yPosition += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTALES:', margin, yPosition);
    
    doc.setTextColor(0, 150, 0);
    doc.text(`$${totalReceived.toFixed(2)}`, margin + 30, yPosition);
    doc.setTextColor(0, 0, 0);
    
    doc.setTextColor(200, 0, 0);
    doc.text(`$${totalExpenses.toFixed(2)}`, margin + 70, yPosition);
    doc.text(`$${annualData.totalEgresos.toFixed(2)}`, margin + 100, yPosition);
    doc.setTextColor(0, 0, 0);
    
    if (netProfit >= 0) {
      doc.setTextColor(0, 150, 0);
    } else {
      doc.setTextColor(200, 0, 0);
    }
    doc.text(`$${netProfit.toFixed(2)}`, margin + 130, yPosition);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`${annualData.payments ? annualData.payments.length : 0}`, margin + 160, yPosition);
    yPosition += 12;
  }

  // Pie de página
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addCompanyFooter(doc, pageWidth, i, totalPages);
  }

  // Abrir/descargar PDF (openPdfInNewTab evita bloqueos por pop-up o iframe)
  const now = new Date();
  const timestamp = format(now, 'yyyyMMdd_HHmmss');
  const fileName = `Reporte_Anual_${annualData.year}_${timestamp}.pdf`;
  openPdfInNewTab(doc, fileName);
};
