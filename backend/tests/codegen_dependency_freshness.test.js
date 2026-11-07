const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const projectSpecService = require('../src/services/codegen/projectSpec.service');
const { computeCanonicalHash } = require('../src/services/codegen/projectSpecBuilder');

test('Freshness: Changing an attribute on an entity without varying element count marks spec as outdated', async () => {
  const spec = {
    schemaVersion: '1.0.0',
    project: { id: 'proj-test', name: 'Test App' },
    dependencyManifest: {
      entities: [
        {
          id: 'ent-1',
          name: 'Libro',
          revision: 1,
          status: 'APPROVED',
          attributes: [
            { id: 'attr-1', name: 'titulo', type: 'String', isPk: false, revision: 1 }
          ]
        }
      ],
      requirements: [],
      businessRules: [],
      useCases: [],
      screens: []
    }
  };
  spec.hash = computeCanonicalHash(spec);

  // Mock prisma.entity.findMany to return an entity where attribute 'titulo' type was changed to 'Text' (same count: 1 entity)
  const originalFindMany = prisma.entity.findMany;
  prisma.entity.findMany = async () => [
    {
      id: 'ent-1',
      name: 'Libro',
      revision: 1,
      status: 'APPROVED',
      isDeleted: false,
      attributes: [
        { id: 'attr-1', name: 'titulo', type: 'Text', isPk: false, revision: 2 } // Modified!
      ]
    }
  ];

  try {
    const freshness = await projectSpecService.checkSpecFreshness('proj-test', spec);
    assert.equal(freshness.upToDate, false);
    assert.equal(freshness.reason, 'DEPENDENCY_MODIFIED');
    assert.equal(freshness.element, 'Attribute:Libro.titulo');
    assert.equal(freshness.changeType, 'ATTRIBUTE_MODIFIED');
  } finally {
    prisma.entity.findMany = originalFindMany;
  }
});

test('Freshness: Modifying a business rule without varying the count marks spec as outdated', async () => {
  const spec = {
    schemaVersion: '1.0.0',
    project: { id: 'proj-test', name: 'Test App' },
    dependencyManifest: {
      entities: [],
      requirements: [],
      businessRules: [
        {
          id: 'rule-1',
          name: 'LimitePrestamos',
          revision: 1,
          description: 'Maximo 3 libros por usuario',
          status: 'APPROVED'
        }
      ],
      useCases: [],
      screens: []
    }
  };
  spec.hash = computeCanonicalHash(spec);

  const originalRuleFindMany = prisma.businessRule.findMany;
  prisma.businessRule.findMany = async () => [
    {
      id: 'rule-1',
      name: 'LimitePrestamos',
      revision: 2, // Changed!
      description: 'Maximo 5 libros por usuario',
      status: 'APPROVED'
    }
  ];

  try {
    const freshness = await projectSpecService.checkSpecFreshness('proj-test', spec);
    assert.equal(freshness.upToDate, false);
    assert.equal(freshness.reason, 'DEPENDENCY_MODIFIED');
    assert.equal(freshness.element, 'BusinessRule:LimitePrestamos');
    assert.equal(freshness.changeType, 'MODIFIED');
  } finally {
    prisma.businessRule.findMany = originalRuleFindMany;
  }
});

test('Freshness: Entity losing approval marks spec as outdated', async () => {
  const spec = {
    schemaVersion: '1.0.0',
    project: { id: 'proj-test', name: 'Test App' },
    dependencyManifest: {
      entities: [
        {
          id: 'ent-1',
          name: 'Libro',
          revision: 1,
          status: 'APPROVED',
          attributes: []
        }
      ],
      requirements: [],
      businessRules: [],
      useCases: [],
      screens: []
    }
  };
  spec.hash = computeCanonicalHash(spec);

  const originalFindMany = prisma.entity.findMany;
  prisma.entity.findMany = async () => [
    {
      id: 'ent-1',
      name: 'Libro',
      revision: 1,
      status: 'REJECTED', // Lost approval!
      isDeleted: false,
      attributes: []
    }
  ];

  try {
    const freshness = await projectSpecService.checkSpecFreshness('proj-test', spec);
    assert.equal(freshness.upToDate, false);
    assert.equal(freshness.reason, 'DEPENDENCY_MODIFIED');
    assert.equal(freshness.element, 'Entity:Libro');
    assert.equal(freshness.changeType, 'LOST_APPROVAL');
  } finally {
    prisma.entity.findMany = originalFindMany;
  }
});

test('Freshness: Changes to unapproved draft elements outside the approved scope DO NOT invalidate the spec', async () => {
  const spec = {
    schemaVersion: '1.0.0',
    project: { id: 'proj-test', name: 'Test App' },
    dependencyManifest: {
      entities: [
        {
          id: 'ent-approved-1',
          name: 'Libro',
          revision: 1,
          status: 'APPROVED',
          attributes: [
            { id: 'attr-1', name: 'titulo', type: 'String', isPk: false, revision: 1 }
          ]
        }
      ],
      requirements: [],
      businessRules: [],
      useCases: [],
      screens: []
    }
  };
  spec.hash = computeCanonicalHash(spec);

  const originalFindMany = prisma.entity.findMany;
  // DB query only asks for IDs in manifest ({ in: ['ent-approved-1'] })
  prisma.entity.findMany = async ({ where }) => {
    // Even if other draft entities like 'Revista (DRAFT)' exist in the DB, only manifest items are returned
    return [
      {
        id: 'ent-approved-1',
        name: 'Libro',
        revision: 1,
        status: 'APPROVED',
        isDeleted: false,
        attributes: [
          { id: 'attr-1', name: 'titulo', type: 'String', isPk: false, revision: 1 }
        ]
      }
    ];
  };

  try {
    const freshness = await projectSpecService.checkSpecFreshness('proj-test', spec);
    assert.equal(freshness.upToDate, true, 'Drafts outside approved scope must not invalidate approved spec');
  } finally {
    prisma.entity.findMany = originalFindMany;
  }
});
