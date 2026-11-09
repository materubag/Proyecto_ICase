const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'docs/assets/swagger');
fs.mkdirSync(target, { recursive: true });
const write = (name, text) => fs.writeFileSync(path.join(root, 'docs', name), text, 'utf8');
const spec = require('../src/docs/openapi.json');
fs.copyFileSync(path.join(root, 'backend/src/docs/openapi.json'), path.join(target, 'openapi.json'));
const dist = require('swagger-ui-dist').absolutePath();
for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js']) fs.copyFileSync(path.join(dist, file), path.join(target, file));
for (const [source, destination] of [['LICENSE', 'LICENSE.txt'], ['NOTICE', 'NOTICE.txt'], ['swagger-ui-bundle.js.LICENSE.txt', 'swagger-ui-bundle.js.LICENSE.txt']]) {
  fs.copyFileSync(path.join(dist, source), path.join(target, destination));
}
write('assets/swagger/index.html', `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ICASE · Referencia OpenAPI</title><link rel="stylesheet" href="swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'openapi.json',dom_id:'#swagger-ui',deepLinking:true,validatorUrl:null,supportedSubmitMethods:[],defaultModelsExpandDepth:1});</script>
</body></html>\n`);
let catalogue = '# Catálogo de endpoints\n\nGenerado por `backend/scripts/sync-docs.cjs` desde OpenAPI. El servidor base es `/api`. Los esquemas abiertos indican campos pendientes de tipado; consultar la [referencia detallada](api-reference.md) y los controladores para esas operaciones.\n\n';
for (const tag of spec.tags) {
  const rows = [];
  for (const [url, item] of Object.entries(spec.paths)) for (const [method, op] of Object.entries(item)) {
    if (!op.tags?.includes(tag.name)) continue;
    const inputs = (op.parameters || []).map(p => `${p.in}: \`${p.name}\`${p.required ? ' (obligatorio)' : ''}`);
    if (op.requestBody) inputs.push('body: ' + Object.keys(op.requestBody.content).map(c => `\`${c}\``).join(', '));
    rows.push(`| ${method.toUpperCase()} | \`${url}\` | ${op.summary.replace(/\|/g, '/')} | ${inputs.join('; ') || '—'} | ${Object.keys(op.responses).join(', ')} |`);
  }
  catalogue += `## ${tag.name}\n\n| Método | Ruta | Operación | Entrada | Respuestas declaradas |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n`;
}
write('api-catalog.md', catalogue);
const read = file => fs.readFileSync(path.join(root, 'backend/src/services', file), 'utf8');
const section = (file, start, end) => {
  const source = read(file), from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`No se encontró la sección de plantilla: ${file}`);
  return source.slice(from, to).trim();
};
const contract = require('../src/services/analysis/extractionContract');
const actor = require('../src/services/analysis/actorRelationshipResolver');
const compact = require('../src/services/document/documentPrompt');
const blocks = [
  ['Extracción documental', 'analysis/extractionContract.js', contract.prompt, 'text'],
  ['Asociaciones actor–requisito', 'analysis/actorRelationshipResolver.js', actor.prompt, 'text'],
  ['Verificación de asociaciones', 'analysis/actorRelationshipResolver.js', section('analysis/actorRelationshipResolver.js', 'const verificationPrompt=', 'function supported('), 'javascript'],
  ['Análisis compacto compatible', 'document/documentPrompt.js', compact.buildDocumentPrompt({projectName:'<projectName>',objective:'<objective>',actors:[],functionalRequirements:[],nonFunctionalRequirements:[],businessRules:[],entities:[],technologies:[]}), 'text'],
  ['Instrucciones por tipo de diagrama y restricciones', 'diagrams/diagramAiService.js', section('diagrams/diagramAiService.js', '  getSystemInstructions(', '  generateDeterministicFallback('), 'javascript'],
  ['Prompts del camino documental de diagramas', 'diagrams/diagramAiService.js', section('diagrams/diagramAiService.js', '      let instructions =', '      let response;'), 'javascript'],
  ['Mockups con IA', 'mockup/mockup.service.js', section('mockup/mockup.service.js', '    const promptText =', '    let generatedScreens ='), 'javascript'],
  ['Pantalla individual de Stitch', 'mockup/GoogleStitchService.js', section('mockup/GoogleStitchService.js', '  buildScreenPrompt(', '  async generateSingleScreen('), 'javascript'],
  ['Chat contextual', 'engineering/workspace.service.js', section('engineering/workspace.service.js', "  if (['ollama', 'openai'].includes(input.provider))", '  return { answer: context.length'), 'javascript']
];
let prompts = '# Catálogo literal de plantillas\n\nGenerado desde el código con `npm run docs:sync` en `backend`. No editar manualmente. Los fragmentos JavaScript conservan las interpolaciones de variables de ejecución. Leer [ingeniería de prompts](prompts.md) para entradas, salidas, versiones y evaluación.\n\n';
for (const [title, file, body, lang] of blocks) prompts += `## ${title}\n\nFuente: \`backend/src/services/${file}\`.\n\n~~~~${lang}\n${body}\n~~~~\n\n`;
write('prompt-templates.md', prompts);
console.log('Sincronizados: OpenAPI, Swagger local, catálogo de rutas y plantillas de prompts.');
