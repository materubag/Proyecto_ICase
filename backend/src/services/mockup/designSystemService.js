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
      // 1. Direct CSS variable matches: | `--color-primary` | `#4338CA` |
      const match = line.match(/^\|\s*(`?--[\w-]+`?)\s*\|\s*`?([^`|]+)`?\s*\|/);
      if (match) {
        const tokenName = match[1].replace(/`/g, '').trim();
        const rawValue = match[2].trim().split('/')[0].trim();
        tokens[tokenName] = rawValue;
        continue;
      }

      // 2. Role-based markdown table support: | Rol | Valor |
      const roleMatch = line.match(/^\|\s*([^|]+)\|\s*`?([^`|]+)`?\s*\|/);
      if (roleMatch) {
        const role = roleMatch[1].replace(/\*/g, '').trim().toLowerCase();
        const rawValue = roleMatch[2].replace(/\*/g, '').trim().split('/')[0].trim();
        if (rawValue.startsWith('#')) {
          if (role.includes('fondo de página')) tokens['--color-bg-app'] = rawValue;
          else if (role.includes('superficie')) tokens['--color-surface'] = rawValue;
          else if (role.includes('divisoria')) tokens['--color-border'] = rawValue;
          else if (role.includes('borde de controles')) tokens['--color-border-control'] = rawValue;
          else if (role.includes('texto principal')) { tokens['--color-text-title'] = rawValue; tokens['--color-text-body'] = rawValue; }
          else if (role.includes('texto secundario')) tokens['--color-text-muted'] = rawValue;
          else if (role.includes('acento')) { tokens['--color-primary'] = rawValue; tokens['--color-primary-hover'] = rawValue; }
          else if (role.includes('éxito')) tokens['--status-success'] = rawValue;
          else if (role.includes('error')) tokens['--status-danger'] = rawValue;
        }
      }
    }

    // Default radii and tokens if not explicitly parsed
    if (!tokens['--radius-sm']) tokens['--radius-sm'] = '6px';
    if (!tokens['--radius-md']) tokens['--radius-md'] = '10px';
    if (!tokens['--radius-lg']) tokens['--radius-lg'] = '16px';
    if (!tokens['--color-primary']) tokens['--color-primary'] = '#4338CA';
    if (!tokens['--color-primary-hover']) tokens['--color-primary-hover'] = '#3730A3';
    if (!tokens['--color-bg-app']) tokens['--color-bg-app'] = '#FAFAF9';
    if (!tokens['--color-surface']) tokens['--color-surface'] = '#FFFFFF';
    if (!tokens['--color-border']) tokens['--color-border'] = '#E7E5E0';
    if (!tokens['--color-border-control']) tokens['--color-border-control'] = '#D6D3CC';
    if (!tokens['--color-text-title']) tokens['--color-text-title'] = '#111111';
    if (!tokens['--color-text-body']) tokens['--color-text-body'] = '#111111';
    if (!tokens['--color-text-muted']) tokens['--color-text-muted'] = '#5F5F5A';
    if (!tokens['--status-success']) tokens['--status-success'] = '#1F7A4D';
    if (!tokens['--status-danger']) tokens['--status-danger'] = '#B42318';

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

    const tokens = this.getCssTokens();
    const primaryColor = brandIdentity.primaryColor || tokens['--color-primary'] || '#4338CA';

    return `SISTEMA DE DISEÑO OFICIAL OBLIGATORIO (FUENTE: DESIGN_SYSTEM.md):

${content}

IDENTIDAD APROBADA DEL PROYECTO:
- Nombre: "${projectName}"
- Dominio / Propósito: ${projectDescription || 'Gestión operativa institucional'}
- Color de Acento: ${primaryColor} (único color destacado permitido)`;
  }

  getStitchScreenVisualRules(archetype = 'B', projectName = 'App', projectDescription = '') {
    const tokens = this.getCssTokens();
    const primaryColor = tokens['--color-primary'] || '#4338CA';
    const bgColor = tokens['--color-bg-app'] || '#FAFAF9';
    const borderColor = tokens['--color-border'] || '#E7E5E0';
    return `SISTEMA DE DISEÑO OFICIAL OBLIGATORIO (FUENTE: DESIGN_SYSTEM.md):
- Estilo: minimalista, limpio y aireado. Menos elementos, más espacio. Sin sombras, degradados, emojis ni decoraciones.
- Color: Fondo de página ${bgColor}, superficie blanca (#FFFFFF), líneas divisorias y bordes ${borderColor}, texto principal #111111, texto secundario #5F5F5A.
- Acento único: ${primaryColor} (solo en botón principal, enlaces, elemento de navegación activo, opción seleccionada).
- Controles: Alto 48px, esquinas 10px. Máximo UN botón relleno por pantalla (los demás contorno o texto).
- Tarjetas: borde 1px ${borderColor}, esquinas 16px, padding 32px, SIN sombra. Ancho máx 1200px.
- Resumen: máximo 4 indicadores arriba (número grande 38px + etiqueta).
- Estructura: 1) Ruta pequeña gris, 2) Título + descripción corta, 3) Máx 3 acciones, 4) Resumen opcional, 5) Tarjeta principal + lateral opcional.
- 100% en español, textos cortos y directos. Prohibido mostrar códigos RF, hashes o jerga técnica de requisitos.
IDENTIDAD: "${projectName}" — ${projectDescription || 'Operación del sistema'}.`;
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
