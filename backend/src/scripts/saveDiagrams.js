'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const projectId = '548804a3-4620-4e92-aca9-fac3172db604';

const classMermaid = `classDiagram
  class Usuario {
    +int id
    +string nombre
    +string correo
    +string contrasenaHash
    +string rol
    +boolean activo
  }
  class Herramienta {
    +int id
    +string nombre
    +string categoria
    +int cantidadDisponible
    +boolean activo
  }
  class Prestamo {
    +int id
    +int estudianteId
    +int herramientaId
    +int plazoDias
    +string estado
    +datetime fechaSolicitud
    +datetime fechaEntrega
    +datetime fechaVencimiento
    +datetime fechaDevolucion
    +string observaciones
  }
  Usuario "1" --> "*" Prestamo : realiza
  Herramienta "1" --> "*" Prestamo : incluye`;

const flowMermaid = `flowchart TD
  Inicio(["Inicio: Estudiante solicita préstamo"]) --> Catalogo["Consultar herramientas disponibles"]
  Catalogo --> StockCheck{"¿Hay unidades disponibles? (RN-02)"}
  StockCheck -- No --> BloqueoStock["Impedir solicitud: Stock 0"]
  StockCheck -- Sí --> VencidoCheck{"¿Tiene préstamos vencidos? (RN-03)"}
  VencidoCheck -- Sí --> BloqueoVencido["Impedir solicitud: Préstamo vencido"]
  VencidoCheck -- No --> PlazoCheck{"¿Plazo es 1 a 3 días? (RN-01)"}
  PlazoCheck -- No --> RechazarPlazo["Rechazar solicitud"]
  PlazoCheck -- Sí --> CrearSol["Registrar solicitud Pendiente"]
  CrearSol --> Revision["Encargado revisa solicitud"]
  Revision --> Decision{"¿Resolución?"}
  Decision -- Rechazar --> EstadoRechazada["Estado: Rechazada"]
  Decision -- Aprobar --> EstadoAprobada["Estado: Aprobada (Lista para entrega, RN-05)"]
  EstadoAprobada --> Entrega["Encargado confirma entrega"]
  Entrega --> Descuento["Descontar 1 unidad de stock y fijar vencimiento (RN-04, RN-05)"]
  Descuento --> EstadoEntregada["Estado: Entregada"]
  EstadoEntregada --> Devolucion["Encargado recibe devolución"]
  Devolucion --> Reposicion["Reponer 1 unidad al stock y rehabilitar estudiante (RN-03, RN-05)"]
  Reposicion --> Fin(["Estado: Devuelta (Fin del ciclo)"])`;

const archMermaid = `flowchart TD
  subgraph Frontend["Frontend SPA (React + Vite)"]
    UI["Vistas por Rol: Encargado y Estudiante"]
    Router["React Router protegido por Roles"]
  end
  subgraph Backend["API REST (Node.js + Express)"]
    Auth["Middleware JWT y BCrypt"]
    Controllers["Controladores de Herramientas y Préstamos"]
    Rules["Reglas de negocio RN-01 a RN-05"]
  end
  subgraph Persistencia["Base de Datos"]
    DB[("PostgreSQL 16")]
  end
  Frontend -->|HTTP REST JSON Bearer JWT| Backend
  Backend -->|Sequelize ORM| DB`;

const extraDiagrams = [
  { type: 'CLASS', name: 'CLASS', title: 'Diagrama de Clases', code: classMermaid },
  { type: 'FLOWCHART', name: 'FLOWCHART', title: 'Diagrama de Flujo', code: flowMermaid },
  { type: 'ARCHITECTURE', name: 'ARCHITECTURE', title: 'Diagrama de Arquitectura', code: archMermaid }
];

async function saveExtra() {
  for (const diag of extraDiagrams) {
    let art = await prisma.artifact.findFirst({
      where: { projectId, type: diag.type }
    });
    if (!art) {
      art = await prisma.artifact.create({
        data: { projectId, type: diag.type, name: diag.name, revision: 1, status: 'APPROVED' }
      });
    }
    const version = await prisma.artifactVersion.create({
      data: {
        artifactId: art.id,
        version: art.revision + 1,
        renderedContent: diag.code,
        structuredContent: { type: diag.type, title: diag.title },
        status: 'APPROVED',
        validationStatus: 'RENDERED'
      }
    });
    await prisma.artifact.update({
      where: { id: art.id },
      data: { revision: version.version, approvedVersionId: version.id, status: 'APPROVED' }
    });
    console.log('Saved extra diagram:', diag.type);
  }
  console.log('ALL DIAGRAMS PERSISTED SUCCESSFULLY');
  process.exit(0);
}

saveExtra().catch(e => {
  console.error(e);
  process.exit(1);
});
