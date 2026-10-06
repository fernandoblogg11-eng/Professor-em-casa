const app = document.getElementById('app');
let token = localStorage.getItem('token');

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};
const field = (label, name, attrs = {}) => h('label', {}, label, h('input', { name, ...attrs }));
const select = (label, name, opts) => h('label', {}, label, h('select', { name, required: '' }, opts.map(o => h('option', { value: o }, o))));
const LEVELS = ['Iniciante', 'Intermediário', 'Avançado'];

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { logout(); throw new Error(d.error); }
  if (!r.ok) throw new Error(d.error || 'Algo deu errado.');
  return d;
}
function logout() { localStorage.removeItem('token'); token = null; viewAuth(); }

function shell(...content) {
  app.replaceChildren(
    h('header', {}, h('span', { class: 'brand' }, 'Professor em Casa'),
      token ? h('nav', {}, h('button', { class: 'link', onclick: viewHome }, 'Início'),
        h('button', { class: 'link', onclick: viewProgress }, 'Progresso'),
        h('button', { class: 'link', onclick: logout }, 'Sair')) : null),
    h('main', {}, content));
  window.scrollTo(0, 0);
}
const age = d => Math.floor((Date.now() - new Date(d)) / 31557600000);

function viewAuth(mode = 'login') {
  const reg = mode === 'register';
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', { class: 'card narrow', onsubmit: async ev => {
    ev.preventDefault(); err.textContent = '';
    const d = Object.fromEntries(new FormData(form)); d.terms_accepted = !!d.terms_accepted;
    try { const r = await api(reg ? '/auth/register' : '/auth/login', 'POST', d); token = r.token; localStorage.setItem('token', token); viewHome(); }
    catch (e) { err.textContent = e.message; }
  } },
    h('h1', {}, reg ? 'Criar conta' : 'Entrar'),
    reg ? field('Seu nome', 'guardian_name', { required: '', autocomplete: 'name' }) : null,
    reg ? field('Nome da família', 'family_name', {}) : null,
    field('E-mail', 'email', { type: 'email', required: '', autocomplete: 'email' }),
    field('Senha', 'password', { type: 'password', required: '', minlength: '8', autocomplete: reg ? 'new-password' : 'current-password' }),
    reg ? h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'terms_accepted', required: '' }), 'Li e aceito os termos de uso e a política de privacidade.') : null,
    err, h('button', { class: 'btn' }, reg ? 'Criar conta' : 'Entrar'),
    h('button', { type: 'button', class: 'link', onclick: () => viewAuth(reg ? 'login' : 'register') }, reg ? 'Já tenho conta' : 'Ainda não tenho conta'));
  shell(form);
}

async function viewHome() {
  shell(h('p', { class: 'muted' }, 'Carregando…'));
  try {
    const [kids, sessions] = await Promise.all([api('/children'), api('/tutor/sessions')]);
    const name = id => (kids.find(k => k.id === id) || {}).name || 'Criança removida';
    shell(
      kids.length ? kids.map(childCard) : h('p', { class: 'card' }, 'Cadastre a primeira criança abaixo para começar a estudar.'),
      addChildForm(),
      sessions.length ? h('section', { class: 'card' }, h('h2', {}, 'Sessões recentes'),
        sessions.map(s => h('div', { class: 'row' },
          h('span', {}, `${name(s.child_id)}: ${s.subject}, ${s.topic} (${s.status === 'active' ? 'em andamento' : 'encerrada'})`),
          h('button', { class: 'link', onclick: () => openSession(s.id) }, s.status === 'active' ? 'Continuar' : 'Ver conversa')))) : null);
  } catch (e) { if (token) shell(h('p', { class: 'error' }, e.message)); }
}

function childCard(k) {
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', { onsubmit: async ev => {
    ev.preventDefault(); err.textContent = '';
    try { const r = await api('/tutor/session', 'POST', { child_id: k.id, ...Object.fromEntries(new FormData(form)) }); viewChat(r.session, k, r.messages); }
    catch (e) { err.textContent = e.message; }
  }, class: 'grid2' },
    field('Matéria', 'subject', { required: '', maxlength: '60', placeholder: 'Matemática' }),
    field('Assunto', 'topic', { required: '', maxlength: '200', placeholder: 'Frações' }),
    h('button', { class: 'btn' }, 'Começar a estudar'), err);
  return h('section', { class: 'card' },
    h('div', { class: 'row' }, h('h2', {}, k.name),
      h('button', { class: 'link', onclick: async () => { if (confirm(`Remover ${k.name} e todo o histórico?`)) { await api('/children/' + k.id, 'DELETE'); viewHome(); } } }, 'Remover')),
    h('p', { class: 'muted' }, `${age(k.birth_date)} anos, ${k.grade}`), form);
}

function addChildForm() {
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', { class: 'card', onsubmit: async ev => {
    ev.preventDefault(); err.textContent = '';
    try { await api('/children', 'POST', Object.fromEntries(new FormData(form))); viewHome(); } catch (e) { err.textContent = e.message; }
  } },
    h('h2', {}, 'Adicionar criança'),
    h('div', { class: 'grid2' },
      field('Nome', 'name', { required: '', maxlength: '80' }),
      field('Data de nascimento', 'birth_date', { type: 'date', required: '' }),
      field('Série', 'grade', { required: '', maxlength: '40', placeholder: '3º ano' }),
      select('Nível de leitura', 'reading_level', LEVELS), select('Nível de matemática', 'math_level', LEVELS),
      field('Matérias difíceis (separe por vírgula)', 'difficulties', {}),
      field('Interesses (separe por vírgula)', 'interests', { placeholder: 'dinossauros, futebol' }),
      field('Outros idiomas', 'languages', {})),
    field('Como ela aprende melhor?', 'learning_prefs', { maxlength: '500' }),
    err, h('button', { class: 'btn' }, 'Salvar criança'));
  return form;
}

async function openSession(id) {
  try { const d = await api('/tutor/session/' + id); viewChat(d.session, d.child || { name: 'Criança' }, d.messages); }
  catch (e) { alert(e.message); }
}

function viewChat(session, child, messages) {
  const log = h('div', { class: 'chat', 'aria-live': 'polite' });
  const bubble = m => { log.append(h('div', { class: 'bubble ' + (m.sender === 'user' ? 'user' : 'tutor') }, m.content)); log.scrollTop = log.scrollHeight; };
  messages.forEach(bubble);
  const active = session.status === 'active';
  const input = h('input', { name: 'content', required: '', maxlength: '4000', placeholder: 'Escreva aqui…', autocomplete: 'off' });
  const btn = h('button', { class: 'btn' }, 'Enviar');
  const form = h('form', { class: 'send', onsubmit: async ev => {
    ev.preventDefault();
    const content = input.value.trim(); if (!content) return;
    input.value = ''; bubble({ sender: 'user', content }); btn.disabled = true;
    try { bubble((await api('/tutor/message', 'POST', { session_id: session.id, content })).reply); }
    catch (e) { bubble({ sender: 'tutor', content: e.message }); }
    btn.disabled = false; input.focus();
  } }, input, btn);
  shell(h('section', { class: 'card' },
    h('div', { class: 'row' }, h('h2', {}, `${child.name}: ${session.topic}`),
      active ? h('button', { class: 'btn ghost', onclick: async () => { if (confirm('Encerrar esta sessão?')) { await api(`/tutor/session/${session.id}/end`, 'PUT'); viewHome(); } } }, 'Encerrar sessão') : h('span', { class: 'muted' }, 'Sessão encerrada')),
    log, active ? form : null));
  if (active) input.focus();
}

async function viewProgress() {
  shell(h('p', { class: 'muted' }, 'Carregando…'));
  try {
    const [kids, rows] = await Promise.all([api('/children'), api('/tutor/progress')]);
    const name = id => (kids.find(k => k.id === id) || {}).name || '—';
    shell(h('section', { class: 'card' }, h('h2', {}, 'Progresso'),
      rows.length ? h('div', { class: 'scroll' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Criança', 'Matéria', 'Assunto', 'Sessões', 'Minutos'].map(t => h('th', {}, t)))),
        h('tbody', {}, rows.map(r => h('tr', {}, [name(r.child_id), r.subject, r.topic, r.sessions, r.minutes].map(v => h('td', {}, String(v)))))))) :
        h('p', { class: 'muted' }, 'Ainda não há sessões. Os minutos contam só sessões encerradas.')));
  } catch (e) { if (token) shell(h('p', { class: 'error' }, e.message)); }
}

token ? viewHome() : viewAuth();
