/**
 * PlatformDetector
 * Detecta explícitamente las plataformas objetivo:
 * WEB, MOBILE, DESKTOP, HYBRID.
 * Regla: NO asumir que "responsive web" significa automáticamente aplicación móvil nativa.
 */

class PlatformDetector {
  /**
   * Detecta plataformas en el texto.
   * @param {string} text
   * @returns {Array<{ type: 'WEB'|'MOBILE'|'DESKTOP'|'HYBRID', evidence: string, confidence: number, devices: Array<string> }>}
   */
  detect(text = '') {
    const platforms = [];
    const lower = text.toLowerCase();

    // 1. Detección Web
    const webEvidenceMatch = text.match(/(?:aplicaci[oó]n\s+web|plataforma\s+web|navegadores?\s+web|interfaz\s+responsiva|arquitectura\s+web|portal\s+web)/i);
    if (webEvidenceMatch) {
      const devices = [];
      if (/computadoras?/i.test(lower) || /pc/i.test(lower)) devices.push('Computadora / PC');
      if (/tablets?/i.test(lower)) devices.push('Tablet');
      if (/tel[eé]fonos?|smartphones?|m[oó]viles?/i.test(lower)) devices.push('Teléfono móvil (Navegador responsivo)');

      platforms.push({
        type: 'WEB',
        isResponsive: /responsiv[ao]/i.test(lower),
        evidence: webEvidenceMatch[0],
        devices: devices.length > 0 ? devices : ['Navegadores web modernos'],
        confidence: 0.95
      });
    }

    // 2. Detección Móvil Nativa (Android / iOS / App móvil nativa)
    const mobileNativeMatch = text.match(/(?:aplicaci[oó]n\s+m[oó]vil\s+nativa|app\s+m[oó]vil\s+nativa|Android\s+(?:Studio|SDK)|(?:Play\s+Store|App\s+Store)|Flutter|React\s+Native|Swift|Kotlin)/i);
    if (mobileNativeMatch) {
      platforms.push({
        type: 'MOBILE',
        evidence: mobileNativeMatch[0],
        devices: ['Smartphone nativo'],
        confidence: 0.9
      });
    }

    // 3. Detección Desktop
    const desktopMatch = text.match(/(?:aplicaci[oó]n\s+(?:de\s+)?escritorio|aplicaci[oó]n\s+desktop|Electron\s+desktop|instalador\s+windows|instalador\s+macos)/i);
    if (desktopMatch) {
      platforms.push({
        type: 'DESKTOP',
        evidence: desktopMatch[0],
        devices: ['Escritorio / Desktop'],
        confidence: 0.9
      });
    }

    // 4. Detección Híbrida
    const hybridMatch = text.match(/(?:aplicaci[oó]n\s+h[ií]brida|PWA|Progressive\s+Web\s+App|Capacitor|Cordova|Ionic)/i);
    if (hybridMatch) {
      platforms.push({
        type: 'HYBRID',
        evidence: hybridMatch[0],
        devices: ['Web y Móvil híbrido'],
        confidence: 0.85
      });
    }

    // Si no se detectó nada explícito pero hay mención a navegadores
    if (platforms.length === 0 && /navegador/i.test(lower)) {
      platforms.push({
        type: 'WEB',
        evidence: 'Mención a navegador en el documento.',
        devices: ['Navegador'],
        confidence: 0.75
      });
    }

    return platforms;
  }
}

module.exports = new PlatformDetector();
