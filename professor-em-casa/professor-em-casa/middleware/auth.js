require('dotenv').config();
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error('Defina JWT_SECRET com 32 ou mais caracteres.');

function auth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  try {
    req.familyId = jwt.verify(m && m[1], SECRET).sub; // family_id vem só do token assinado
    next();
  } catch { res.status(401).json({ error: 'Sessão expirada. Entre novamente.' }); }
}
auth.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
auth.sign = familyId => jwt.sign({ sub: familyId }, SECRET, { expiresIn: '7d' });
module.exports = auth;
