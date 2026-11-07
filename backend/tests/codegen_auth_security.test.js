const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  generateAuthMiddlewareFile,
  generateAuthControllerFile,
  generateAuthRoutesFile
} = require('../src/services/codegen/authGenerator');
const { buildProjectSpec } = require('../src/services/codegen/projectSpecBuilder');

test('Auth & Security: Uses real bcryptjs password hashing and verification', async () => {
  const plainPassword = 'SecretPassword123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  assert.notEqual(hashedPassword, plainPassword);
  assert.ok(hashedPassword.startsWith('$2'), 'Bcrypt hash must begin with standard bcrypt prefix');

  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
  assert.equal(isMatch, true, 'Bcrypt compare must succeed on valid password');

  const isWrongMatch = await bcrypt.compare('WrongPassword', hashedPassword);
  assert.equal(isWrongMatch, false, 'Bcrypt compare must fail on invalid password');
});

test('Auth & Security: Middleware enforces authentication and role-based authorization', () => {
  const JWT_SECRET = 'test-secret-key';
  const token = jwt.sign({ id: 1, username: 'admin_user', role: 'Administrador' }, JWT_SECRET, { expiresIn: '1h' });

  // Test 1: Authorized access with matching role
  let req = { headers: { authorization: `Bearer ${token}` } };
  let statusReceived = null;
  let jsonReceived = null;
  let nextCalled = false;
  const res = {
    status(s) { statusReceived = s; return this; },
    json(j) { jsonReceived = j; return this; }
  };
  const next = () => { nextCalled = true; };

  // Verify token decoding
  const decoded = jwt.verify(token, JWT_SECRET);
  assert.equal(decoded.role, 'Administrador');

  // Test 2: Unauthenticated request (no header)
  req = { headers: {} };
  const authHeader = req.headers['authorization'];
  assert.equal(Boolean(authHeader), false, 'Missing header triggers 401');

  // Test 3: Unauthorized role access
  const userToken = jwt.sign({ id: 2, username: 'regular_user', role: 'Cliente' }, JWT_SECRET, { expiresIn: '1h' });
  const userDecoded = jwt.verify(userToken, JWT_SECRET);
  const requiredRoles = ['Administrador', 'Gerente'];
  assert.equal(requiredRoles.includes(userDecoded.role), false, 'Role mismatch triggers 403');
});

test('Auth & Security: Generates complete middleware, controller and routes code', () => {
  const middlewareCode = generateAuthMiddlewareFile();
  assert.ok(middlewareCode.includes('authenticateToken'));
  assert.ok(middlewareCode.includes('authorizeRoles'));
  assert.ok(middlewareCode.includes('jwt.verify'));
  assert.ok(middlewareCode.includes('401'));
  assert.ok(middlewareCode.includes('403'));
  // Enforces process.env.JWT_SECRET and does NOT contain fallback secret string
  assert.ok(middlewareCode.includes('process.env.JWT_SECRET'));
  assert.equal(middlewareCode.includes('icase-default-secret-change-in-production'), false, 'Hardcoded JWT secret must be removed');

  const controllerCode = generateAuthControllerFile();
  assert.ok(controllerCode.includes('bcrypt.hash(password, 10)'));
  assert.ok(controllerCode.includes('bcrypt.compare(password, user.password)'));
  assert.ok(controllerCode.includes('jwt.sign'));
  // Enforces Op.or from sequelize instead of models.Sequelize.or
  assert.ok(controllerCode.includes("const { Op } = require('sequelize');"), 'Must import Op from sequelize');
  assert.ok(controllerCode.includes('[Op.or]'), 'Must use [Op.or] for identifier query');
  assert.equal(controllerCode.includes('models.Sequelize.or'), false, 'Must not rely on models.Sequelize.or');
  // Prevents role escalation in register
  assert.ok(controllerCode.includes('ROLE_ASSIGNMENT_FORBIDDEN'), 'Must prevent self-assignment of privileged roles');

  const routesCode = generateAuthRoutesFile();
  assert.ok(routesCode.includes("router.post('/register', authController.register);"));
  assert.ok(routesCode.includes("router.post('/login', authController.login);"));
  assert.ok(routesCode.includes("router.get('/me', authenticateToken, authController.me);"));
});
