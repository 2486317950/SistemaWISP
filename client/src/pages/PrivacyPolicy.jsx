import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '24px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1f2933' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '16px', color: '#111827' }}>Política de privacidad</h1>
      <p style={{ marginBottom: '16px', color: '#4b5563' }}>
        Esta política de privacidad aplica al sistema de gestión y a la app de clientes del proveedor de servicios de internet (WISP) que usa este sistema.
        Al utilizar el sistema o la app, aceptas el tratamiento de tus datos personales conforme a lo descrito a continuación.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>1. Responsable del tratamiento</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        El responsable del tratamiento de los datos es el titular del sistema y del servicio de internet que te brinda acceso a este portal o aplicación.
        Para cualquier duda o solicitud sobre tus datos, contacta con el administrador del sistema o con el área de soporte indicada en tu contrato
        o en los canales oficiales del proveedor.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>2. Datos que recopilamos</h2>
      <p style={{ marginBottom: '8px', color: '#4b5563' }}>Según la configuración del sistema, podemos tratar las siguientes categorías de datos:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '12px', color: '#4b5563' }}>
        <li>Datos de identificación: nombre, apellidos, número de cliente, usuario.</li>
        <li>Datos de contacto: teléfono, correo electrónico, dirección de instalación o facturación.</li>
        <li>Datos de facturación y pagos: historial de cargos, pagos, comprobantes y facturas.</li>
        <li>Datos de servicio: planes contratados, estado del servicio, consumos y tickets de soporte.</li>
        <li>Datos técnicos básicos: dirección IP desde la que accedes, tipo de dispositivo y navegador.</li>
        <li>En la app móvil, identificadores para notificaciones push (token de Firebase u otros servicios similares).</li>
      </ul>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>3. Finalidades del tratamiento</h2>
      <p style={{ marginBottom: '8px', color: '#4b5563' }}>Utilizamos tus datos para:</p>
      <ul style={{ paddingLeft: '20px', marginBottom: '12px', color: '#4b5563' }}>
        <li>Gestionar tu contrato de servicio y tu cuenta de cliente.</li>
        <li>Mostrar tu información de pagos, facturas, consumos y estado del servicio.</li>
        <li>Gestionar solicitudes, tickets de soporte y comunicaciones relacionadas con el servicio.</li>
        <li>Enviar notificaciones relacionadas con tu servicio (recordatorios de pago, avisos técnicos, novedades del portal, etc.).</li>
        <li>Mejorar la calidad del servicio, la seguridad y la estabilidad de la plataforma.</li>
        <li>Cumplir obligaciones legales y requerimientos de las autoridades competentes cuando aplique.</li>
      </ul>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>4. Base legal</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        La base legal principal para el tratamiento de tus datos es la ejecución del contrato de servicios que tienes con el proveedor,
        el cumplimiento de obligaciones legales y, en algunos casos, tu consentimiento (por ejemplo, para recibir ciertas notificaciones comerciales
        o para el uso de determinados datos opcionales).
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>5. Notificaciones y push</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        La app puede utilizar servicios de terceros (como Firebase Cloud Messaging) para enviarte notificaciones push sobre tu servicio.
        Para ello se almacena un identificador técnico de tu dispositivo (token) asociado a tu cuenta. Este identificador se usa únicamente
        para el envío de dichas notificaciones y puede ser eliminado si desinstalas la app o solicitas la baja de las notificaciones.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>6. Destinatarios y transferencias</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        Tus datos no se venden a terceros. Podrán ser compartidos únicamente con:
      </p>
      <ul style={{ paddingLeft: '20px', marginBottom: '12px', color: '#4b5563' }}>
        <li>Proveedores de infraestructura y hosting (por ejemplo, servicios en la nube donde se aloja el sistema).</li>
        <li>Proveedores de servicios de notificaciones push o correo electrónico transaccional.</li>
        <li>Asesores o terceros cuando sea necesario para cumplir obligaciones legales o contractuales.</li>
      </ul>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>7. Conservación de los datos</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        Los datos se conservan mientras tu contrato de servicio esté activo y durante los plazos adicionales que exija la normativa aplicable
        (por ejemplo, en materia contable o fiscal). Una vez transcurridos dichos plazos, se eliminarán o se anonimizarán de forma segura.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>8. Derechos de las personas usuarias</h2>
      <p style={{ marginBottom: '8px', color: '#4b5563' }}>
        De acuerdo con la normativa de protección de datos aplicable en tu país, puedes ejercer derechos como:
      </p>
      <ul style={{ paddingLeft: '20px', marginBottom: '12px', color: '#4b5563' }}>
        <li>Acceder a los datos personales que el proveedor tenga sobre ti.</li>
        <li>Solicitar la rectificación de datos inexactos o incompletos.</li>
        <li>Solicitar la supresión de tus datos cuando ya no sean necesarios o según lo permita la ley.</li>
        <li>Oponerte a determinados tratamientos o solicitar la limitación del uso de tus datos.</li>
      </ul>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        Para ejercer estos derechos, contacta con el administrador del sistema o con el área de soporte del proveedor de servicios
        indicando claramente tu solicitud y tus datos de identificación como cliente.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>9. Seguridad</h2>
      <p style={{ marginBottom: '12px', color: '#4b5563' }}>
        Se aplican medidas técnicas y organizativas razonables para proteger tus datos frente a accesos no autorizados, pérdida accidental
        o destrucción. Ningún sistema es 100% seguro, pero se revisan y actualizan las medidas de seguridad de forma periódica.
      </p>

      <h2 style={{ fontSize: '1.35rem', marginTop: '24px', marginBottom: '8px' }}>10. Cambios en esta política</h2>
      <p style={{ marginBottom: '0', color: '#4b5563' }}>
        Esta política de privacidad puede actualizarse periódicamente para reflejar cambios en el sistema, en la normativa o en los servicios ofrecidos.
        La versión vigente estará siempre disponible en esta misma URL <strong>/privacidad</strong>. Te recomendamos revisarla de forma ocasional.
      </p>
    </div>
  );
};

export default PrivacyPolicy;

