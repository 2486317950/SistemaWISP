/**
 * Helpers para WebAuthn (llaves de acceso / PIN / huella).
 * Convierte ArrayBuffer a base64url para enviar al servidor.
 */

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Serializa una credencial de registro para enviar al servidor.
 */
export function serializeRegistrationResponse(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
}

/**
 * Serializa una aserción (login) para enviar al servidor.
 */
export function serializeAuthenticationResponse(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}

/**
 * Decodifica base64url a Uint8Array (para opciones del servidor).
 */
export function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Comprueba si la página está en contexto seguro (HTTPS o localhost).
 * Las llaves de acceso solo funcionan en contexto seguro.
 */
export function isSecureContext() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * Comprueba si WebAuthn está disponible en el navegador (API + contexto seguro).
 */
export function isWebAuthnSupported() {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function' &&
    isSecureContext();
}
