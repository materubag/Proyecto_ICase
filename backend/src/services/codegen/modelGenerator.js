/**
 * Model Generator for Sequelize
 * Generates individual model files and models/index.js with associations
 */

const { toPascalCase, toCamelCase, toSnakeCasePlural, normalizeAttributes } = require('./typeMapper');

/**
 * Generates the source code for an individual Sequelize model file
 */
function generateModelFile(entity) {
  const modelName = toPascalCase(entity.name);
  const tableName = toSnakeCasePlural(entity.name);
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);

  const attributeLines = normalizedAttrs.map(attr => {
    const options = [
      `type: ${attr.dataType}`,
      `allowNull: ${attr.allowNull}`
    ];
    if (attr.isPk) {
      options.push('primaryKey: true');
      if (attr.autoIncrement || attr.dataType.includes('INTEGER')) {
        options.push('autoIncrement: true');
      }
    }

    return `    ${attr.fieldName}: {\n      ${options.join(',\n      ')}\n    }`;
  }).join(',\n');

  return `/**
 * Modelo Sequelize para ${modelName}
 * Generado automáticamente por ICASE Studio
 * ${entity.description ? `Descripción: ${entity.description}` : ''}
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${modelName} = sequelize.define('${modelName}', {
${attributeLines}
  }, {
    tableName: '${tableName}',
    timestamps: true,
    underscored: true
  });

  return ${modelName};
};
`;
}

/**
 * Generates the master models/index.js with all associations
 */
function generateModelsIndexFile(entities = [], relationships = []) {
  const modelImports = [];
  const modelInits = [];
  const associationLines = [];

  const entityNames = new Set(entities.map(e => toPascalCase(e.name)));

  // Model initialization
  for (const entity of entities) {
    const name = toPascalCase(entity.name);
    modelImports.push(`const define${name} = require('./${name}');`);
    modelInits.push(`const ${name} = define${name}(sequelize);`);
  }

  // Association generation
  const processedRels = new Set();

  for (const rel of relationships) {
    const sourceName = toPascalCase(rel.source);
    const targetName = toPascalCase(rel.target);

    // Skip relationships pointing to non-existent entities
    if (!entityNames.has(sourceName) || !entityNames.has(targetName)) continue;
    if (sourceName === targetName) continue; // skip circular self-ref for simplicity

    const relKey = `${sourceName}->${targetName}`;
    if (processedRels.has(relKey)) continue;
    processedRels.add(relKey);

    const card = (rel.cardinality || '1:N').replace(/\s+/g, '');
    const sourceFk = `${toCamelCase(sourceName)}Id`;
    const targetFk = `${toCamelCase(targetName)}Id`;
    const targetPlural = toCamelCase(toSnakeCasePlural(targetName));
    const sourcePlural = toCamelCase(toSnakeCasePlural(sourceName));
    const targetSingular = toCamelCase(targetName);
    const sourceSingular = toCamelCase(sourceName);

    if (card === 'N:M' || card === '*:*' || card === '*..*') {
      const throughTable = `${sourceName}${targetName}s`;
      associationLines.push(`  // Relación Muchos a Muchos: ${sourceName} <--> ${targetName}`);
      associationLines.push(`  ${sourceName}.belongsToMany(${targetName}, { through: '${throughTable}', foreignKey: '${sourceFk}', as: '${targetPlural}' });`);
      associationLines.push(`  ${targetName}.belongsToMany(${sourceName}, { through: '${throughTable}', foreignKey: '${targetFk}', as: '${sourcePlural}' });`);
    } else if (card === '1:1') {
      associationLines.push(`  // Relación Uno a Uno: ${sourceName} <-> ${targetName}`);
      associationLines.push(`  ${sourceName}.hasOne(${targetName}, { foreignKey: '${sourceFk}', as: '${targetSingular}', onDelete: 'CASCADE' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceSingular}' });`);
    } else {
      // Default: 1:N
      associationLines.push(`  // Relación Uno a Muchos: ${sourceName} (1) -> ${targetName} (N)`);
      associationLines.push(`  ${sourceName}.hasMany(${targetName}, { foreignKey: '${sourceFk}', as: '${targetPlural}', onDelete: 'CASCADE' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceSingular}' });`);
    }
  }

  const modelExports = entities.map(e => toPascalCase(e.name)).join(',\n  ');

  return `/**
 * Inicializador y Asociaciones de Modelos Sequelize
 * Generado automáticamente por ICASE Studio
 */

const sequelize = require('../config/database');

// Importación de definiciones de modelos
${modelImports.join('\n')}

// Instanciación de modelos
${modelInits.join('\n')}

// Definición de Asociaciones (Relaciones)
${associationLines.length > 0 ? associationLines.join('\n') : '  // Sin asociaciones entre entidades configuradas'}

// ============================================================================
// LÓGICA DE NEGOCIO DETERMINÍSTICA (Hooks de Ciclo de Vida Sequelize)
// ============================================================================

// 1. Descuento Automático de Stock e Historial de Movimientos (RF-23, RF-22)
try {
  // Descuento al registrar consumo de repuesto en actividades de taller
  if (typeof Actividad !== 'undefined' && typeof Producto !== 'undefined') {
    Actividad.addHook('afterCreate', async (actividad, options) => {
      try {
        const prodId = actividad.productoId || actividad.repuestoId;
        const cant = Number(actividad.cantidad || actividad.cantidadUtilizada || 1);
        if (prodId) {
          await Producto.decrement('stock', { by: cant, where: { id: prodId }, transaction: options?.transaction });
          if (typeof MovimientoInventario !== 'undefined') {
            await MovimientoInventario.create({
              productoId: prodId,
              tipoMovimiento: 'SALIDA',
              cantidad: cant,
              motivo: \`Consumo en Actividad OT #\${actividad.ordenTrabajoId || actividad.id}\`,
              fechaMovimiento: new Date()
            }, { transaction: options?.transaction });
          }
        }
      } catch (err) {
        console.error('Error en hook de descuento de stock (Actividad):', err.message);
      }
    });
  }

  // Descuento en ventas directas de repuestos
  if (typeof VentaDetalle !== 'undefined' && typeof Producto !== 'undefined') {
    VentaDetalle.addHook('afterCreate', async (detalle, options) => {
      try {
        const prodId = detalle.productoId || detalle.repuestoId;
        const cant = Number(detalle.cantidad || 1);
        if (prodId) {
          await Producto.decrement('stock', { by: cant, where: { id: prodId }, transaction: options?.transaction });
          if (typeof MovimientoInventario !== 'undefined') {
            await MovimientoInventario.create({
              productoId: prodId,
              tipoMovimiento: 'SALIDA',
              cantidad: cant,
              motivo: \`Venta directa #\${detalle.ventaId || detalle.id}\`,
              fechaMovimiento: new Date()
            }, { transaction: options?.transaction });
          }
        }
      } catch (err) {
        console.error('Error en hook de descuento de stock (VentaDetalle):', err.message);
      }
    });
  }

  // Ingreso automático al registrar compras de repuestos
  if (typeof CompraDetalle !== 'undefined' && typeof Producto !== 'undefined') {
    CompraDetalle.addHook('afterCreate', async (detalle, options) => {
      try {
        const prodId = detalle.productoId || detalle.repuestoId;
        const cant = Number(detalle.cantidad || 1);
        if (prodId) {
          await Producto.increment('stock', { by: cant, where: { id: prodId }, transaction: options?.transaction });
          if (typeof MovimientoInventario !== 'undefined') {
            await MovimientoInventario.create({
              productoId: prodId,
              tipoMovimiento: 'ENTRADA',
              cantidad: cant,
              motivo: \`Ingreso por Compra #\${detalle.compraId || detalle.id}\`,
              fechaMovimiento: new Date()
            }, { transaction: options?.transaction });
          }
        }
      } catch (err) {
        console.error('Error en hook de ingreso de stock (CompraDetalle):', err.message);
      }
    });
  }
} catch (hookErr) {
  console.log('Nota inicialización hooks stock:', hookErr.message);
}

// 2. Trazabilidad y Auditoría Automática para Operaciones Críticas (RF-34)
try {
  if (typeof Auditoria !== 'undefined') {
    const trackedModels = [
      typeof Cliente !== 'undefined' ? Cliente : null,
      typeof Vehiculo !== 'undefined' ? Vehiculo : null,
      typeof Cotizacion !== 'undefined' ? Cotizacion : null,
      typeof OrdenTrabajo !== 'undefined' ? OrdenTrabajo : null,
      typeof Producto !== 'undefined' ? Producto : null,
      typeof Compra !== 'undefined' ? Compra : null,
      typeof Venta !== 'undefined' ? Venta : null,
      typeof Usuario !== 'undefined' ? Usuario : null
    ].filter(Boolean);

    for (const m of trackedModels) {
      m.addHook('afterCreate', async (instance) => {
        try {
          await Auditoria.create({
            entidad: m.name,
            tablaAfectada: m.name,
            entidadId: instance.id || 0,
            registroId: instance.id || 0,
            operacion: 'CREATE',
            accionRealizada: 'CREATE',
            fechaEvento: new Date(),
            fechaHora: new Date(),
            detalle: \`Creación en \${m.name} ID #\${instance.id || 0}\`,
            direccionIp: '127.0.0.1',
            ipOrigen: '127.0.0.1'
          });
        } catch (e) {}
      });

      m.addHook('afterUpdate', async (instance) => {
        try {
          await Auditoria.create({
            entidad: m.name,
            tablaAfectada: m.name,
            entidadId: instance.id || 0,
            registroId: instance.id || 0,
            operacion: 'UPDATE',
            accionRealizada: 'UPDATE',
            fechaEvento: new Date(),
            fechaHora: new Date(),
            detalle: \`Modificación en \${m.name} ID #\${instance.id || 0}\`,
            direccionIp: '127.0.0.1',
            ipOrigen: '127.0.0.1'
          });
        } catch (e) {}
      });

      m.addHook('afterDestroy', async (instance) => {
        try {
          await Auditoria.create({
            entidad: m.name,
            tablaAfectada: m.name,
            entidadId: instance.id || 0,
            registroId: instance.id || 0,
            operacion: 'DELETE',
            accionRealizada: 'DELETE',
            fechaEvento: new Date(),
            fechaHora: new Date(),
            detalle: \`Eliminación en \${m.name} ID #\${instance.id || 0}\`,
            direccionIp: '127.0.0.1',
            ipOrigen: '127.0.0.1'
          });
        } catch (e) {}
      });
    }
  }
} catch (audErr) {
  console.log('Nota inicialización hooks auditoría:', audErr.message);
}

module.exports = {
  sequelize,
  ${modelExports}
};
`;
}

module.exports = {
  generateModelFile,
  generateModelsIndexFile
};
