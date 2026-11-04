import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const token = process.env.NOTION_TOKEN;
const sourceId = process.env.NOTION_DATA_SOURCE_ID;
if (!token || !sourceId) {
  console.error('NOTION_TOKEN and NOTION_DATA_SOURCE_ID must be configured before syncing.');
  process.exit(1);
}
const aliases = JSON.parse(await readFile(new URL('../data/names.json', import.meta.url)));
const idFor = value => 'member-' + createHash('sha256').update(value.replaceAll('-', '')).digest('hex').slice(0, 12);

async function request(path, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch('https://api.notion.com/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const retry = Number(response.headers.get('retry-after'));
      await delay((Number.isFinite(retry) && retry > 0 ? retry : 2 ** attempt) * 1000);
      continue;
    }
    throw new Error('Notion request failed with HTTP ' + response.status + '. Check connection access and data source settings.');
  }
}

const rows = [];
let cursor;
do {
  const page = await request('data_sources/' + encodeURIComponent(sourceId) + '/query', { page_size: 100, ...(cursor ? {start_cursor: cursor} : {}) });
  rows.push(...page.results);
  cursor = page.has_more ? page.next_cursor : undefined;
} while (cursor);

const participants = new Map();
const problems = [];
for (const row of rows) {
  const props = row.properties;
  if (props['참여자']?.type !== 'people' || props['날짜']?.type !== 'date' || props['문제 이름']?.type !== 'title') {
    throw new Error('Source schema changed. Expected 문제 이름 (title), 날짜 (date), 참여자 (people).');
  }
  const date = props['날짜'].date?.start;
  const people = props['참여자'].people;
  if (!date || people.length === 0) continue;
  if (!Number.isFinite(Date.parse(date))) throw new Error('A problem contains an invalid date.');
  const memberIds = [];
  for (const person of people) {
    const id = idFor(person.id);
    const user = person.name ? person : await request('users/' + encodeURIComponent(person.id));
    const name = aliases[id] || user.name;
    if (!name) throw new Error('A participant needs a display name before publishing.');
    participants.set(id, {id, name});
    memberIds.push(id);
  }
  problems.push({
    id: createHash('sha256').update(row.id.replaceAll('-', '')).digest('hex').slice(0, 16),
    title: props['문제 이름'].title.map(text => text.plain_text).join('') || '이름 없는 문제',
    date,
    url: props['링크']?.url || '',
    tags: (props['유형']?.multi_select || []).map(tag => tag.name),
    participants: memberIds
  });
}
if (!problems.length) throw new Error('No dated participation records found. Existing data is preserved.');
problems.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const output = {updatedAt:new Date().toISOString(),timezone:'Asia/Seoul',participants:[...participants.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')),problems};
const destination = new URL('../data/activity.json', import.meta.url);
const temporary = new URL('../data/activity.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify(output, null, 2) + '\n');
await rename(temporary, destination);
console.log('Synced ' + problems.length + ' problems and ' + participants.size + ' participants.');
