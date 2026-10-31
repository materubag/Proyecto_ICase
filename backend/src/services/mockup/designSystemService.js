/**
 * Design System Service
 * Integrates DESIGN_SYSTEM.md into Stitch mockup generation and frontend React code generation.
 * Parses design tokens, visual archetypes, and mandatory rules to maintain absolute visual coherence.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DesignSystemService {
  constructor() {
    this.candidatePaths = [
      path.resolve(__dirname, '../../../../DESIGN_SYSTEM.md'),
      path.resolve(__dirname, '../../../../docs/design_system.md'),
      path.resolve(__dirname, '../../../DESIGN_SYSTEM.md'),
      path.resolve(__dirname, '../../DESIGN_SYSTEM.md'),
      path.resolve(process.cwd(), 'DESIGN_SYSTEM.md'),
      path.resolve(process.cwd(), '../DESIGN_SYSTEM.md'),
      '/app/DESIGN_SYSTEM.md'
    ];
  }

  /**
   * Resolves and reads DESIGN_SYSTEM.md from the file system.
   */
  getDesignSystemContent() {
    for (const p of this.candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          return fs.readFileSync(p, 'utf8');
        }
      } catch {
        // try next path
      }
    }
    return '';
  }

  /**
   * Returns cryptographic metadata (hash, version, reference) of DESIGN_SYSTEM.md
   */
  getDesignSystemMetadata() {
    const content = this.getDesignSystemContent();
    if (!content) {
      return {
        version: 'unknown',
        hash: null,
        reference: 'DESIGN_SYSTEM.md',
        available: false,
        error: 'DESIGN_SYSTEM_NOT_FOUND'
      };
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const versionMatch = content.match(/v(\d+(\.\d+)?)/i) || content.match(/Versión:\s*([^\n\r]+)/i);
    const version = versionMatch ? versionMatch[1].trim() : '3.0';

    return {
      version,
      hash,
      reference: 'DESIGN_SYSTEM.md',
      available: true
    };
  }

  /**
   * Parses design tokens directly from the markdown table in DESIGN_SYSTEM.md
   */
  getCssTokens() {
    const content = this.getDesignSystemContent();
    if (!content) {
      throw new Error('DESIGN_SYSTEM_NOT_FOUND: No se encontró el archivo DESIGN_SYSTEM.md en el sistema.');
    }

    const tokens = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\|\s*(`?--[\w-]+`?)\s*\|\s*`?([^`|]+)`?\s*\|/);
      if (match) {
        const tokenName = match[1].replace(/`/g, '').trim();
        // If there are multiple values (e.g. #16A34A / #F0FDF4), take the primary value
        const rawValue = match[2].trim().split('/')[0].trim();
        tokens[tokenName] = rawValue;
      }
    }

    // Fallback if parsing produced no tokens
    if (Object.keys(tokens).length === 0) {
      return {
        '--color-primary': '#4f46e5',
        '--color-primary-hover': '#4338ca',
        '--color-bg-app': '#f8fafc',
        '--color-surface': '#ffffff',
        '--color-border': '#e2e8f0',
        '--radius-md': '8px'
      };
    }

    return tokens;
  }

  /**
   * Builds prompt guidelines using DESIGN_SYSTEM.md as the true source,
   * cleanly separating general design rules from project-specific branding.
   */
  getStitchPromptContext(projectName = 'App', projectDescription = '', brandIdentity = {}) {
    const content = this.getDesignSystemContent();
    if (!content) {
      throw new Error('DESIGN_SYSTEM_NOT_FOUND: No se puede generar contexto de diseño sin DESIGN_SYSTEM.md.');
    }

    // Extract core sections dynamically from DESIGN_SYSTEM.md
    const manifestoMatch = content.match(/## 1\. Manifiesto y Filosofía[\s\S]*?(?=## 2)/i);
    const archetypesMatch = content.match(/## 3\. Arquetipos de Pantalla[\s\S]*$/i);

    const manifestoText = manifestoMatch ? manifestoMatch[0].trim() : 'SISTEMA DE DISEÑO MINIMALISTA: Solo lo esencial.';
    const archetypesText = archetypesMatch ? archetypesMatch[0].trim() : 'ARQUETIPOS: Focal, Guiado, Dashboard.';

    const primaryColor = brandIdentity.primaryColor || '#4F46E5';

    return `SISTEMA DE DISEÑO OFICIAL OBLIGATORIO (FUENTE: DESIGN_SYSTEM.md v3.0):

${manifestoText}

REGLAS GENERALES DE COMPONENTES:
- Paleta Primaria: ${primaryColor} (acciones principales, selección activa).
- Superficie: Blanco puro (#FFFFFF) con bordes finos (#E2E8F0) y esquinas redondeadas.
- Tipografía: Títulos en Slate (#0F172A), cuerpo (#334155), textos secundarios (#64748B).
- Controles: Altura de 44px en inputs y botones primarios.
- Idioma: 100% en español.
- Cero ruido administrativo: Prohibido exponer códigos RF-XX, hashes o sellos técnicos en la UI regular.

${archetypesText}

IDENTIDAD APROBADA DEL PROYECTO:
- Nombre: "${projectName}"
- Dominio / Propósito: ${projectDescription || 'Gestión operativa institucional'}
- Identidad de Marca: Color de acción ${primaryColor}.`;
  }

  /**
   * Reports Stitch capabilities and explicit limitations
   */
  getStitchCapabilities(apiKey = '') {
    const meta = this.getDesignSystemMetadata();
    return {
      provider: 'Google Stitch MCP',
      available: Boolean(apiKey && apiKey.length > 5),
      designSystem: meta,
      supportedFeatures: [
        'Generación de mockups visuales HTML/CSS interactivos',
        `Inyección de tokens dinámicos de ${meta.reference} (v${meta.version})`,
        'Diseño responsive enfocado en Desktop (1440px / 1280px)',
        'Arquetipos A (Focal), B (Guiado) y C (Dashboard)'
      ],
      limitations: [
        'Stitch genera prototipos visuales HTML; la conexión con Sequelize y controladores Express es orquestada por ICASE Studio.',
        'No reemplaza la lógica de negocio ni migraciones SQL.',
        'En ausencia de API Key válida, ICASE utiliza el generador offline funcional basado en templates del Design System.'
      ]
    };
  }
}

module.exports = new DesignSystemService();
