/**
 * Catálogo extensible de tecnologías conocidas para ICASE.
 * Permite detectar tecnologías de forma determinística en el texto sin recurrir a IA.
 */

const TECHNOLOGIES = [
  // Frontend
  {
    name: 'React',
    category: 'frontend',
    aliases: ['react', 'reactjs', 'react.js', 'react native']
  },
  {
    name: 'Angular',
    category: 'frontend',
    aliases: ['angular', 'angularjs', 'angular.js']
  },
  {
    name: 'Vue',
    category: 'frontend',
    aliases: ['vue', 'vuejs', 'vue.js', 'vue 3', 'vue2']
  },
  {
    name: 'Svelte',
    category: 'frontend',
    aliases: ['svelte', 'sveltekit']
  },
  {
    name: 'Next.js',
    category: 'frontend',
    aliases: ['nextjs', 'next.js', 'next']
  },
  {
    name: 'HTML5/CSS3/JavaScript',
    category: 'frontend',
    aliases: ['html5', 'html', 'css3', 'css', 'javascript vanilla', 'vanilla js']
  },

  // Backend
  {
    name: 'Node.js',
    category: 'backend',
    aliases: ['node', 'nodejs', 'node.js']
  },
  {
    name: 'Express',
    category: 'backend',
    aliases: ['express', 'expressjs', 'express.js']
  },
  {
    name: 'Spring Boot',
    category: 'backend',
    aliases: ['spring boot', 'springboot', 'spring framework', 'spring mvc', 'java spring']
  },
  {
    name: 'Django',
    category: 'backend',
    aliases: ['django', 'django rest', 'drf']
  },
  {
    name: 'Laravel',
    category: 'backend',
    aliases: ['laravel', 'php laravel']
  },
  {
    name: 'FastAPI',
    category: 'backend',
    aliases: ['fastapi', 'fast-api']
  },
  {
    name: 'NestJS',
    category: 'backend',
    aliases: ['nestjs', 'nest.js', 'nest']
  },
  {
    name: '.NET Core',
    category: 'backend',
    aliases: ['.net', '.net core', 'dotnet', 'asp.net', 'c# .net']
  },
  {
    name: 'Flask',
    category: 'backend',
    aliases: ['flask', 'python flask']
  },

  // Database
  {
    name: 'PostgreSQL',
    category: 'database',
    aliases: ['postgresql', 'postgres', 'pgsql']
  },
  {
    name: 'MySQL',
    category: 'database',
    aliases: ['mysql', 'mariadb']
  },
  {
    name: 'MongoDB',
    category: 'database',
    aliases: ['mongodb', 'mongo']
  },
  {
    name: 'SQL Server',
    category: 'database',
    aliases: ['sql server', 'mssql', 'microsoft sql server']
  },
  {
    name: 'SQLite',
    category: 'database',
    aliases: ['sqlite', 'sqlite3']
  },
  {
    name: 'Redis',
    category: 'database',
    aliases: ['redis']
  },
  {
    name: 'Oracle DB',
    category: 'database',
    aliases: ['oracle database', 'oracle db', 'oracle sql']
  },

  // Infrastructure / Cloud / DevOps
  {
    name: 'Docker',
    category: 'infrastructure',
    aliases: ['docker', 'docker-compose', 'docker compose', 'contenedores docker']
  },
  {
    name: 'Kubernetes',
    category: 'infrastructure',
    aliases: ['kubernetes', 'k8s']
  },
  {
    name: 'AWS',
    category: 'infrastructure',
    aliases: ['aws', 'amazon web services', 's3', 'ec2', 'lambda']
  },
  {
    name: 'Azure',
    category: 'infrastructure',
    aliases: ['azure', 'microsoft azure']
  },
  {
    name: 'Google Cloud Platform',
    category: 'infrastructure',
    aliases: ['gcp', 'google cloud']
  },
  {
    name: 'Nginx',
    category: 'infrastructure',
    aliases: ['nginx']
  },
  {
    name: 'Apache',
    category: 'infrastructure',
    aliases: ['apache', 'apache http server', 'httpd']
  },
  {
    name: 'MariaDB',
    category: 'database',
    aliases: ['mariadb', 'maria db']
  },

  // AI & Machine Learning
  {
    name: 'Google Gemini',
    category: 'ai',
    aliases: ['gemini', 'google gemini', 'gemini-3.1-flash-lite', 'gemini pro', 'gemini flash']
  },
  {
    name: 'OpenAI',
    category: 'ai',
    aliases: ['openai', 'gpt-4o', 'gpt-4', 'chatgpt']
  },
  {
    name: 'Ollama',
    category: 'ai',
    aliases: ['ollama']
  },
  {
    name: 'Llama',
    category: 'ai',
    aliases: ['llama', 'llama3', 'llama-3']
  },
  {
    name: 'Whisper',
    category: 'ai',
    aliases: ['whisper', 'faster-whisper', 'openai whisper']
  },

  // Security & Authentication & Libraries
  {
    name: 'JWT',
    category: 'security',
    aliases: ['jwt', 'json web token', 'sesiones seguras']
  },
  {
    name: 'HTTPS',
    category: 'security',
    aliases: ['https', 'ssl', 'tls', 'conexión cifrada']
  },
  {
    name: 'Prisma ORM',
    category: 'backend',
    aliases: ['prisma', 'prisma orm']
  }
];

class TechnologyCatalog {
  constructor(techList = TECHNOLOGIES) {
    this.catalog = [...techList];
  }

  /**
   * Agrega o extiende una nueva tecnología al catálogo dinámicamente.
   * @param {{ name: string, category: string, aliases: string[] }} tech
   */
  addTechnology(tech) {
    if (!tech || !tech.name || !tech.category) return;
    this.catalog.push({
      name: tech.name,
      category: tech.category,
      aliases: (tech.aliases || []).map(a => a.toLowerCase().trim())
    });
  }

  /**
   * Detecta tecnologías en un texto normalizado mediante comparación determinística de palabras clave y alias.
   * @param {string} text - Texto del documento
   * @returns {{
   *   frontend: string[],
   *   backend: string[],
   *   database: string[],
   *   infrastructure: string[],
   *   detected: Array<{ name: string, category: string, source: string }>
   * }}
   */
  detect(text = '') {
    const lower = ` ${text.toLowerCase().replace(/[^a-z0-9+#.]/g, ' ')} `;

    const result = {
      frontend: [],
      backend: [],
      database: [],
      infrastructure: [],
      detected: []
    };

    const added = new Set();

    for (const tech of this.catalog) {
      // Revisa nombre principal y todos los alias
      const searchTerms = [tech.name.toLowerCase(), ...(tech.aliases || [])];
      let matched = false;

      for (const term of searchTerms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Word boundary o espacios delimitados
        const regex = new RegExp(`(?:^|\\s|\\W)${escaped}(?:$|\\s|\\W)`, 'i');
        if (regex.test(lower)) {
          matched = true;
          break;
        }
      }

      if (matched && !added.has(tech.name)) {
        added.add(tech.name);
        const cat = tech.category;
        if (result[cat]) {
          result[cat].push(tech.name);
        }
        result.detected.push({
          name: tech.name,
          category: tech.category,
          source: 'explicit'
        });
      }
    }

    return result;
  }
}

module.exports = new TechnologyCatalog();
