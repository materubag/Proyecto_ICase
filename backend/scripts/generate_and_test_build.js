const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testFullBuild() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  const artifacts = await prisma.artifact.findMany({
    where: { projectId, type: 'MOCKUP' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  console.log(`Found ${artifacts.length} mockups for project`);
  const converted = [];

  for (const a of artifacts) {
    const v = a.versions[0];
    const s = v?.structuredContent?.screen;
    if (!s?.htmlUrl) continue;

    console.log(`Fetching HTML for ${s.name} (${s.route})...`);
    const res = await fetch(s.htmlUrl);
    const html = await res.text();
    const jsx = convertHtmlToJsx(html, s.name, s.route);

    const safeName = s.route.replace(/^\//, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascal = safeName ? safeName.charAt(0).toUpperCase() + safeName.slice(1) : 'Home';
    converted.push({
      name: s.name,
      route: s.route,
      pascal,
      fileName: `${pascal}Page.jsx`,
      jsx
    });
  }

  console.log(`Converted ${converted.length} mockups to JSX components.`);
}

testFullBuild().finally(() => prisma.$disconnect());
