const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');
const { wrap } = auth;

const FAMILY = 'id, email, family_name, guardian_name';
const str = (v, n) => String(v || '').trim().slice(0, n);
const strongEnough = p => typeof p === 'string' && p.length >= 8 && p.length <= 72;

router.post('/register', wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (!strongEnough(req.body.password)) return res.status(400).json({ error: 'A senha deve ter de 8 a 72 caracteres.' });
  if (req.body.terms_accepted !== true) return res.status(400).json({ error: 'É preciso aceitar os termos de uso.' });
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    const f = (await db.query(
      `insert into families(email,password_hash,family_name,guardian_name,terms_accepted) values($1,$2,$3,$4,true) returning ${FAMILY}`,
      [email, hash, str(req.body.family_name, 80), str(req.body.guardian_name, 80)])).rows[0];
    res.status(201).json({ token: auth.sign(f.id), family: f });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    throw e;
  }
}));

router.post('/login', wrap(async (req, res) => {
  const f = (await db.query('select * from families where email=$1', [str(req.body.email, 200).toLowerCase()])).rows[0];
  const ok = f && await bcrypt.compare(String(req.body.password || ''), f.password_hash);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  res.json({ token: auth.sign(f.id), family: { id: f.id, email: f.email, family_name: f.family_name, guardian_name: f.guardian_name } });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const f = (await db.query(`select ${FAMILY} from families where id=$1`, [req.familyId])).rows[0];
  if (!f) return res.status(404).json({ error: 'Família não encontrada.' });
  res.json(f);
}));

router.put('/me', auth, wrap(async (req, res) => {
  const f = (await db.query(`update families set family_name=$2, guardian_name=$3 where id=$1 returning ${FAMILY}`,
    [req.familyId, str(req.body.family_name, 80), str(req.body.guardian_name, 80)])).rows[0];
  res.json(f);
}));

router.put('/password', auth, wrap(async (req, res) => {
  if (!strongEnough(req.body.new_password)) return res.status(400).json({ error: 'A nova senha deve ter de 8 a 72 caracteres.' });
  const f = (await db.query('select password_hash from families where id=$1', [req.familyId])).rows[0];
  if (!f || !await bcrypt.compare(String(req.body.current_password || ''), f.password_hash))
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  await db.query('update families set password_hash=$2 where id=$1', [req.familyId, await bcrypt.hash(req.body.new_password, 10)]);
  res.json({ ok: true });
}));

module.exports = router;
