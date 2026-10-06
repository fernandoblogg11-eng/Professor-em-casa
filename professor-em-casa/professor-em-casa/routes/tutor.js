const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { wrap } = auth;
router.use(auth);
const aiTutor = require('../services/aiTutor');
const socratic = require('../services/socraticTutor');

const CHILD = `select c.*, extract(year from age(c.birth_date))::int as age, p.difficult_subjects as difficulties, p.focus_areas as interests, p.other_languages as languages, p.preferences as learning_prefs
  from children c left join child_preferences p on p.child_id = c.id where c.id=$1 and c.family_id=$2`;
const MSG = 'id, sender, content, created_at';

const saveMsg = async (familyId, sessionId, sender, content) =>
  (await db.query(`insert into messages(family_id,session_id,sender,content) values($1,$2,$3,$4) returning ${MSG}`,
    [familyId, sessionId, sender, content])).rows[0];

// Progresso: apenas contagens reais. O tempo só considera sessões encerradas.
router.get('/progress', wrap(async (req, res) => {
  const { rows } = await db.query(
    `select child_id, subject, topic, count(*)::int as sessions,
       coalesce(round(sum(extract(epoch from (ended_at - started_at)) / 60) filter (where status = 'completed')), 0)::int as minutes,
       max(started_at) as last_at
     from study_sessions where family_id=$1 group by child_id, subject, topic order by last_at desc`, [req.familyId]);
  res.json(rows);
}));

router.get('/sessions', wrap(async (req, res) => {
  const { rows } = await db.query(
    'select id, child_id, subject, topic, status, started_at, ended_at from study_sessions where family_id=$1 order by started_at desc limit 30',
    [req.familyId]);
  res.json(rows);
}));

router.post('/session', wrap(async (req, res) => {
  const subject = String(req.body.subject || '').trim().slice(0, 60), topic = String(req.body.topic || '').trim().slice(0, 200);
  if (!subject || !topic) return res.status(400).json({ error: 'Informe a matéria e o assunto.' });
  const child = (await db.query(CHILD, [req.body.child_id, req.familyId])).rows[0];
  if (!child) return res.status(404).json({ error: 'Criança não encontrada.' });
  const session = (await db.query(
    'insert into study_sessions(family_id,child_id,subject,topic) values($1,$2,$3,$4) returning id, child_id, subject, topic, status, started_at, ended_at',
    [req.familyId, child.id, subject, topic])).rows[0];
  const hello = await saveMsg(req.familyId, session.id, 'tutor', socratic.greeting(child, session));
  res.status(201).json({ session, messages: [hello] });
}));

router.get('/session/:id', wrap(async (req, res) => {
  const s = (await db.query(
    'select id, child_id, subject, topic, status, started_at, ended_at from study_sessions where id=$1 and family_id=$2',
    [req.params.id, req.familyId])).rows[0];
  if (!s) return res.status(404).json({ error: 'Sessão não encontrada.' });
  const messages = (await db.query(`select ${MSG} from messages where session_id=$1 and family_id=$2 order by created_at`, [s.id, req.familyId])).rows;
  const child = (await db.query(CHILD, [s.child_id, req.familyId])).rows[0];
  res.json({ session: s, child: child && { id: child.id, name: child.name, grade: child.grade, age: child.age }, messages });
}));

router.post('/message', wrap(async (req, res) => {
  const content = String(req.body.content || '').trim().slice(0, 4000);
  if (!content) return res.status(400).json({ error: 'Mensagem vazia.' });
  const session = (await db.query('select * from study_sessions where id=$1 and family_id=$2', [req.body.session_id, req.familyId])).rows[0];
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
  if (session.status !== 'active') return res.status(409).json({ error: 'Esta sessão já foi encerrada.' });
  await saveMsg(req.familyId, session.id, 'user', content);
  const history = (await db.query(`select ${MSG} from messages where session_id=$1 and family_id=$2 order by created_at`, [session.id, req.familyId])).rows;
  const child = (await db.query(CHILD, [session.child_id, req.familyId])).rows[0];
  // A mensagem da criança já foi salva. Se a IA falhar, avisamos sem expor detalhes técnicos.
  let text;
  try { text = await aiTutor.generateReply({ child, session, history }); }
  catch (e) {
    console.error('Falha da IA:', e.message);
    return res.json({ reply: { sender: 'tutor', content: aiTutor.FALLBACK, transient: true } });
  }
  res.json({ reply: await saveMsg(req.familyId, session.id, 'tutor', text) });
}));

router.put('/session/:id/end', wrap(async (req, res) => {
  const { rows } = await db.query(
    `update study_sessions set status='completed', ended_at=now() where id=$1 and family_id=$2 and status<>'completed'
     returning id, child_id, subject, topic, status, started_at, ended_at`, [req.params.id, req.familyId]);
  if (!rows[0]) return res.status(404).json({ error: 'Sessão não encontrada ou já encerrada.' });
  res.json(rows[0]);
}));

module.exports = router;
