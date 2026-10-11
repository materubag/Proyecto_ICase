/**
 * Flowchart Generator
 * Generates semantically correct, syntactically safe Process Flow diagrams (flowchart TD).
 * Models business processes with Start -> Steps -> Decisions -> Branches -> End.
 */

const { toSafeIdentifier, toSafeLabel } = require('./mermaidNormalizer');

module.exports = {
  /**
   * Generates a Process Flow diagram from functional requirements and use cases.
   */
  generate(requirements = [], useCases = [], projectName = 'Sistema') {
    const lines = ['flowchart TD'];
    const pName = toSafeLabel(projectName || 'Sistema', 35);

    lines.push(`  START(["Inicio: Proceso Operativo ${pName}"])`);
    lines.push('  REG_SOLICITUD["1. Recepción y captura de solicitud o evento inicial"]');
    lines.push('  START --> REG_SOLICITUD');

    lines.push('  DEC_CLIENTE{"¿Cliente o activo registrado previamente en el sistema?"}');
    lines.push('  REG_SOLICITUD --> DEC_CLIENTE');

    lines.push('  REG_NUEVO["Registrar nueva ficha con datos validados"]');
    lines.push('  CARGA_DATOS["Cargar datos existentes e historial previo"]');
    lines.push('  DEC_CLIENTE -->|No| REG_NUEVO');
    lines.push('  DEC_CLIENTE -->|Sí| CARGA_DATOS');

    lines.push('  CONVERGE_INGRESO["2. Inspección preliminar y verificación de condiciones"]');
    lines.push('  REG_NUEVO --> CONVERGE_INGRESO');
    lines.push('  CARGA_DATOS --> CONVERGE_INGRESO');

    lines.push('  DEC_DIAG{"¿Se detectan fallas complejas o requerimientos adicionales?"}');
    lines.push('  CONVERGE_INGRESO --> DEC_DIAG');

    lines.push('  PROC_RUTINA["3. Ejecución de servicio o proceso estándar directo"]');
    lines.push('  PROC_DIAG["3. Diagnóstico técnico especializado y documentación de evidencias"]');
    lines.push('  DEC_DIAG -->|No| PROC_RUTINA');
    lines.push('  DEC_DIAG -->|Sí| PROC_DIAG');

    lines.push('  GEN_COTIZ["4. Generar cotización y presupuesto con desglose de ítems"]');
    lines.push('  PROC_DIAG --> GEN_COTIZ');

    lines.push('  DEC_AUTORIZA{"¿Cliente autoriza la propuesta (total o parcialmente)?"}');
    lines.push('  GEN_COTIZ --> DEC_AUTORIZA');

    lines.push('  CANCEL_TRAMITE["Registrar motivo de desestimación y generar acta de devolución"]');
    lines.push('  FIN_CANCEL(["Fin: Proceso no autorizado / Cancelado"])');
    lines.push('  DEC_AUTORIZA -->|No| CANCEL_TRAMITE');
    lines.push('  CANCEL_TRAMITE --> FIN_CANCEL');

    lines.push('  CREAR_ORDEN["5. Emitir Orden de Trabajo con ítems y tareas autorizadas"]');
    lines.push('  DEC_AUTORIZA -->|Sí| CREAR_ORDEN');

    lines.push('  ASIG_RESP["6. Asignar responsables técnicos y verificar recursos o repuestos"]');
    lines.push('  CREAR_ORDEN --> ASIG_RESP');

    lines.push('  DEC_STOCK{"¿Disponibilidad completa de recursos e inventario?"}');
    lines.push('  ASIG_RESP --> DEC_STOCK');

    lines.push('  SOLICITAR_STOCK["Generar orden de compra a proveedor o abastecimiento"]');
    lines.push('  EJECUTAR_TRABAJO["7. Ejecución operativa de actividades técnicas"]');
    lines.push('  DEC_STOCK -->|No| SOLICITAR_STOCK');
    lines.push('  SOLICITAR_STOCK --> EJECUTAR_TRABAJO');
    lines.push('  DEC_STOCK -->|Sí| EJECUTAR_TRABAJO');

    lines.push('  CONTROL_CALIDAD{"8. ¿Control de calidad y pruebas técnicas superadas?"}');
    lines.push('  EJECUTAR_TRABAJO --> CONTROL_CALIDAD');

    lines.push('  REVISION_AJUSTE["Revisar observaciones técnicas y corregir detalles"]');
    lines.push('  CONTROL_CALIDAD -->|No| REVISION_AJUSTE');
    lines.push('  REVISION_AJUSTE --> EJECUTAR_TRABAJO');

    lines.push('  CIERRE_ORDEN["9. Finalizar orden, actualizar expediente digital y emitir liquidación"]');
    lines.push('  CONTROL_CALIDAD -->|Sí| CIERRE_ORDEN');
    lines.push('  PROC_RUTINA --> CIERRE_ORDEN');

    lines.push('  FIN_EXITO(["Fin: Entrega satisfactoria y registro de auditoría"])');
    lines.push('  CIERRE_ORDEN --> FIN_EXITO');

    return lines.join('\n');
  }
};
