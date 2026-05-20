import React from 'react';

/**
 * Hoja de cotización (misma estructura que el cotizador e interfaz pública).
 */
const CotizadorSheetView = ({
  company,
  folio,
  quotationDate,
  validUntil,
  clientName,
  clientAddress,
  clientEmail,
  clientPhone,
  items,
  subtotal,
  discountAmount,
  taxPct,
  taxAmount,
  total,
  notes,
  terms,
  footerExtra,
}) => {
  const tpl = company.template;
  return (
    <div
      className={`cotizador-sheet cotizador-sheet--${tpl}`}
      style={{ '--co-accent': company.accent, '--co-accent2': company.accent2 }}
    >
      <header className="cotizador-sh-head">
        <div className="cotizador-sh-brand">
          {company.logoUrl ? (
            <span className="cotizador-sh-logo cotizador-sh-logo--img" aria-hidden>
              <img src={company.logoUrl} alt={company.logoAlt || ''} loading="lazy" decoding="async" />
            </span>
          ) : (
            <span className="cotizador-sh-logo" aria-hidden>
              ◇
            </span>
          )}
          <div>
            <div className="cotizador-sh-legal">{company.legalName}</div>
            <div className="cotizador-sh-tag">{company.tagline}</div>
          </div>
        </div>
        <div className="cotizador-sh-title-block">
          <h2 className="cotizador-sh-title">{company.sheetTitle}</h2>
          <div className="cotizador-sh-folio">Ref. {folio}</div>
        </div>
      </header>

      <div className="cotizador-sh-meta">
        <div className="cotizador-sh-issuer">
          <strong>Dirección</strong>
          <span>{company.address}</span>
          <strong>Teléfono</strong>
          <span>{company.phone}</span>
          <strong>Correo</strong>
          <span>{company.email}</span>
        </div>
        <div className="cotizador-sh-client">
          <strong>Cliente</strong>
          <span className="cotizador-sh-client-name">{clientName || '—'}</span>
          {clientAddress ? <span>{clientAddress}</span> : null}
          {clientEmail ? <span>{clientEmail}</span> : null}
          {clientPhone ? <span>{clientPhone}</span> : null}
        </div>
        <div className="cotizador-sh-dates">
          <div>
            <span className="cotizador-sh-dl">Fecha</span>
            <span className="cotizador-sh-dv">
              {quotationDate ? new Date(`${quotationDate}T12:00:00`).toLocaleDateString('es-MX') : '—'}
            </span>
          </div>
          {validUntil ? (
            <div>
              <span className="cotizador-sh-dl">Válida hasta</span>
              <span className="cotizador-sh-dv">{new Date(`${validUntil}T12:00:00`).toLocaleDateString('es-MX')}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="cotizador-sh-table-wrap">
        <table className="cotizador-sh-table">
          <thead>
            <tr>
              <th className="cotizador-th-desc">Descripción</th>
              <th>Cant.</th>
              <th>P. unit.</th>
              <th className="cotizador-th-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((row, i) => (
              <tr key={i}>
                <td className="cotizador-td-desc">{row.description || '—'}</td>
                <td className="cotizador-td-num">{row.quantity}</td>
                <td className="cotizador-td-num">${parseFloat(row.unit_price).toFixed(2)}</td>
                <td className="cotizador-td-num cotizador-td-right">
                  ${(parseFloat(row.quantity) * parseFloat(row.unit_price)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cotizador-sh-totals">
        <div className="cotizador-sh-totals-inner">
          <div className="cotizador-tline">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 ? (
            <div className="cotizador-tline">
              <span>Descuento</span>
              <span>−${discountAmount.toFixed(2)}</span>
            </div>
          ) : null}
          {taxAmount > 0 ? (
            <div className="cotizador-tline">
              <span>Impuesto ({taxPct}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="cotizador-tline cotizador-tline-total">
            <span>Total</span>
            <span>${total.toFixed(2)} MXN</span>
          </div>
        </div>
      </div>

      {notes ? (
        <div className="cotizador-sh-notes">
          <strong>Notas</strong>
          <p>{notes}</p>
        </div>
      ) : null}

      {terms ? (
        <div className="cotizador-sh-terms">
          <strong>Términos</strong>
          <p>{terms}</p>
        </div>
      ) : null}

      <footer className="cotizador-sh-foot">
        <span>{company.legalName}</span>
        <span className="cotizador-sh-foot-muted">
          {footerExtra || `Documento · ${new Date().toLocaleDateString('es-MX')}`}
        </span>
      </footer>
    </div>
  );
};

export default CotizadorSheetView;
