const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { wrap } = auth;
router.use(auth);

const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 15);
const SEL = `select c.id, c.name, c.birth_date, c.grade, c.reading_level, c.math_level,
  coalesce(p.difficult_subjects,'{}') as difficulties, coalesce(p.focus_areas,'{}') as interests,
  coalesce(p.other_languages,'{}') as languages, coalesce(p.preferences,'') as learning_prefs
  from children c left join child_preferences p on p.child_id=c.id`;

function clean(b) {
  const c = { name: String(b.name || '').trim().slice(0, 80), birth_date: String(b.birth_date || '').slice(0, 10),
    grade: String(b.grade || '').trim().slice(0, 40), reading_level: String(b.reading_level || '').trim().slice(0, 40),
    math_level: String(b.math_level || '').trim().slice(0, 40) };
  const d = new Date(c.birth_date);
  if (!c.name || !c.grade || !c.reading_level || !c.math_level || !/^\d{4}-\d{2}-\d{2}$/.test(c.birth_date) || isNaN(d) || d > new Date()) return null;
  return c;
}
const savePrefs = (childId, familyId, b) => db.query(
  `insert into child_preferences(child_id,family_id,difficult_subjects,focus_areas,other_languages,preferences) values($1,$2,$3,$4,$5,$6)
   on conflict (child_id) do update set difficult_subjects=$3, focus_areas=$4, other_languages=$5, preferences=$6`,
  [childId, familyId, list(b.difficulties), list(b.interests), list(b.languages), String(b.learning_prefs || '').trim().slice(0, 500)]);
const one = async (id, familyId) => (await db.query(SEL + ' where c.id=$1 and c.family_id=$2', [id, familyId])).rows[0];

router.get('/', wrap(async (req, res) =>
  res.json((await db.query(SEL + ' where c.family_id=$1 order by c.created_at', [req.familyId])).rows)));

router.get('/:id', wrap(async (req, res) => {
  const c = await one(req.params.id, req.familyId);
  c ? res.json(c) : res.status(404).json({ error: 'Criança não encontrada.' });
}));

router.post('/', wrap(async (req, res) => {
  const c = clean(req.body);
  if (!c) return res.status(400).json({ error: 'Preencha nome, data de nascimento válida, série e níveis.' });
  const { id } = (await db.query(
    'insert into children(family_id,name,birth_date,grade,reading_level,math_level) values($1,$2,$3,$4,$5,$6) returning id',
    [req.familyId, c.name, c.birth_date, c.grade, c.reading_level, c.math_level])).rows[0];
  await savePrefs(id, req.familyId, req.body);
  res.status(201).json(await one(id, req.familyId));
}));

router.put('/:id', wrap(async (req, res) => {
  const c = clean(req.body);
  if (!c) return res.status(400).json({ error: 'Preencha nome, data de nascimento válida, série e níveis.' });
  const r = await db.query(
    'update children set name=$3,birth_date=$4,grade=$5,reading_level=$6,math_level=$7 where id=$1 and family_id=$2 returning id',
    [req.params.id, req.familyId, c.name, c.birth_date, c.grade, c.reading_level, c.math_level]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Criança não encontrada.' });
  await savePrefs(req.params.id, req.familyId, req.body);
  res.json(await one(req.params.id, req.familyId));
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await db.query('delete from children where id=$1 and family_id=$2 returning id', [req.params.id, req.familyId]);
  r.rows[0] ? res.json({ ok: true }) : res.status(404).json({ error: 'Criança não encontrada.' });
}));

module.exports = router;
