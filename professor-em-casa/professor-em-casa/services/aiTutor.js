// Única camada que fala com o modelo de IA. Provedor configurável por variáveis de ambiente:
//   AI_PROVIDER = anthropic | openai  ("openai" serve para qualquer API compatível com /chat/completions)
//   AI_API_KEY, AI_MODEL (obrigatórios)  |  AI_BASE_URL (opcional, só para "openai")
const { buildSystemPrompt, toChatMessages } = require('./socraticTutor');

const FALLBACK = 'O professor está descansando um pouquinho agora. 😴 Tente de novo daqui a pouco!';

async function post(url, headers, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const providers = {
  async anthropic({ system, messages }) {
    const d = await post('https://api.anthropic.com/v1/messages',
      { 'x-api-key': process.env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
      { model: process.env.AI_MODEL, max_tokens: 600, system, messages });
    return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  },
  async openai({ system, messages }) {
    const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const d = await post(base + '/chat/completions', { Authorization: 'Bearer ' + process.env.AI_API_KEY },
      { model: process.env.AI_MODEL, messages: [{ role: 'system', content: system }, ...messages] });
    return (d.choices?.[0]?.message?.content || '').trim();
  }
};

async function generateReply({ child, session, history }) {
  const { AI_PROVIDER = 'anthropic', AI_API_KEY, AI_MODEL } = process.env;
  const run = providers[AI_PROVIDER];
  if (!run || !AI_API_KEY || !AI_MODEL) throw new Error('IA não configurada (AI_PROVIDER, AI_API_KEY, AI_MODEL).');
  const text = await run({ system: buildSystemPrompt(child, session), messages: toChatMessages(history) });
  if (!text) throw new Error('Resposta vazia da IA.');
  return text.slice(0, 4000);
}

module.exports = { generateReply, FALLBACK };
