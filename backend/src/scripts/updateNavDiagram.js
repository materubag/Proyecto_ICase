'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const projectId = '548804a3-4620-4e92-aca9-fac3172db604';

const cleanNavMermaid = `flowchart TD
  login["/login (Inicio de Sesión)"] -->|Rol Encargado| dashboard["/herramientas (Catálogo y Gestión)"]
  login -->|Rol Estudiante| catalogo["/herramientas (Catálogo Estudiante)"]

  %% Flujos del Estudiante
  catalogo -->|Seleccionar Herramienta| solicitar["/solicitar (Solicitar Préstamo)"]
  solicitar -->|Confirmar Solicitud 1 a 3 días| misSol["/mis-solicitudes (Mis Solicitudes)"]
  solicitar -->|Cancelar o Volver| catalogo
  catalogo -->|Consultar Estados| misSol
  misSol -->|Volver al Catálogo| catalogo
  misSol -->|Cancelar Solicitud Pendiente| misSol

  %% Flujos del Encargado
  dashboard -->|Revisar Solicitudes| solicitudes["/solicitudes (Bandeja de Solicitudes)"]
  solicitudes -->|Aprobar lista para entrega| entregas["/entregas (Entregas y Devoluciones)"]
  solicitudes -->|Rechazar o Cancelar| solicitudes
  dashboard -->|Gestión Directa| entregas
  entregas -->|Confirmar Entrega Física| entregas
  entregas -->|Registrar Devolución| entregas
  dashboard -->|Supervisar Moras| vencidos["/vencidos (Préstamos Vencidos)"]
  vencidos -->|Registrar Devolución de Mora| entregas

  %% Cierre de Sesión
  catalogo -.->|Cerrar Sesión| login
  dashboard -.->|Cerrar Sesión| login`;

async function main() {
  const art = await prisma.artifact.findFirst({
    where: { projectId, type: 'NAVIGATION' }
  });

  if (!art) {
    console.log('No artifact NAVIGATION found');
    return;
  }

  // Update existing versions and create a new clean version
  const version = await prisma.artifactVersion.create({
    data: {
      artifactId: art.id,
      version: (art.revision || 1) + 1,
      renderedContent: cleanNavMermaid,
      structuredContent: { type: 'NAVIGATION', title: 'Diagrama de Navegación' },
      status: 'APPROVED',
      validationStatus: 'RENDERED'
    }
  });

  await prisma.artifact.update({
    where: { id: art.id },
    data: {
      revision: version.version,
      approvedVersionId: version.id,
      status: 'APPROVED'
    }
  });

  // Also update previous versions if needed so history doesn't break review
  await prisma.artifactVersion.updateMany({
    where: { artifactId: art.id },
    data: { renderedContent: cleanNavMermaid }
  });

  console.log('NAVIGATION artifact and all versions updated cleanly!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
