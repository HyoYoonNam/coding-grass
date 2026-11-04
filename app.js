import { dateKey, memberActivity, metrics, calendarRange } from './lib/activity.js';

const $ = id => document.getElementById(id);
const today = dateKey(new Date().toISOString());
const colors = ['#406c44', '#9b6c42', '#596f9c', '#9a6686', '#448981'];
let data;
let selected;
let selectedDay = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(name) { return [...name].slice(0, 1).join('').toUpperCase(); }
function activity() { return memberActivity(data, selected, today); }

function selectMember(id) {
  selected = id;
  selectedDay = null;
  try { localStorage.setItem('coding-grass-member', id); } catch {}
  history.replaceState(null, '', '#member=' + encodeURIComponent(id));
  render();
}

function renderMembers() {
  $('members').replaceChildren(...data.participants.map((person, index) => {
    const stats = metrics(memberActivity(data, person.id, today), today);
    const button = element('button', 'member' + (person.id === selected ? ' selected' : ''));
    button.setAttribute('aria-pressed', String(person.id === selected));
    const avatar = element('span', 'avatar', initials(person.name));
    avatar.style.setProperty('--avatar-color', colors[index % colors.length]);
    const info = element('span', 'member-info');
    info.append(element('strong', '', person.name), element('span', '', '누적 ' + stats.total + '문제'));
    button.append(avatar, info, element('span', 'member-arrow', '↗'));
    button.addEventListener('click', () => selectMember(person.id));
    return button;
  }));
}

function renderStats(problems) {
  const stats = metrics(problems, today);
  const items = [
    ['누적 풀이', stats.total, '문제'],
    ['이번 달', stats.month, '문제'],
    ['참여한 날', stats.days, '일'],
    ['현재 연속 기록', stats.streak, '일'],
    ['최장 연속 기록', stats.longest, '일']
  ];
  $('stats').replaceChildren(...items.map(([label, value, unit]) => {
    const card = element('div', 'stat');
    const number = element('div', 'stat-number', value);
    number.append(element('span', '', unit));
    card.append(element('p', '', label), number);
    return card;
  }));
}

function renderHeatmap(problems) {
  const mode = $('period').value;
  $('year').hidden = mode !== 'year';
  const range = calendarRange(today, mode, $('year').value);
  const counts = new Map();
  problems.forEach(problem => {
    const key = dateKey(problem.date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  $('range-label').textContent = range.start.replaceAll('-', '.') + ' — ' + range.end.replaceAll('-', '.');
  const wrapper = element('div', 'calendar');
  const labels = element('div', 'weekdays');
  ['월', '', '수', '', '금', '', '일'].forEach(day => labels.append(element('span', '', day)));
  const body = element('div', 'calendar-body');
  const weeks = element('div', 'weeks');
  const months = element('div', 'months');
  for (let index = 0; index < range.cells.length; index += 7) {
    const weekCells = range.cells.slice(index, index + 7);
    const monthStart = weekCells.find(cell => !cell.outside && cell.key.endsWith('-01'));
    const labelDay = monthStart || (index === 0 ? weekCells.find(cell => !cell.outside) : null);
    months.append(element('span', '', labelDay ? Number(labelDay.key.slice(5, 7)) + '월' : ''));
    const week = element('div', 'week');
    weekCells.forEach(cell => {
      const count = counts.get(cell.key) || 0;
      const square = element('button', 'day' + (cell.outside ? ' outside' : '') + (cell.future ? ' future' : '') + (cell.key === today ? ' today' : '') + (cell.key === selectedDay ? ' picked' : ''));
      square.dataset.level = Math.min(4, count);
      square.title = cell.key + ', ' + count + '문제';
      square.setAttribute('aria-label', cell.key + ', ' + count + '문제');
      square.setAttribute('aria-pressed', String(selectedDay === cell.key));
      square.disabled = cell.outside || cell.future;
      square.addEventListener('click', () => {
        selectedDay = cell.key;
        renderHeatmap(problems);
        renderProblems(problems);
      });
      week.append(square);
    });
    weeks.append(week);
  }
  body.append(months, weeks);
  wrapper.append(labels, body);
  $('heatmap').replaceChildren(wrapper);
}

function safeUrl(raw) {
  try { const url = new URL(raw); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}

function renderProblems(problems) {
  const visible = problems.filter(problem => !selectedDay || dateKey(problem.date) === selectedDay)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ko'));
  $('list-title').textContent = selectedDay ? selectedDay.replaceAll('-', '.') + '의 기록' : '푼 문제 ' + problems.length + '개';
  $('reset-date').hidden = !selectedDay;
  $('problem-list').replaceChildren(...visible.map(problem => {
    const row = element('div', 'problem');
    const info = element('div', 'problem-info');
    const url = safeUrl(problem.url);
    const title = element(url ? 'a' : 'span', 'problem-title', problem.title + (url ? ' ↗' : ''));
    if (url) { title.href = url; title.target = '_blank'; title.rel = 'noopener'; }
    const tags = element('div', 'problem-tags');
    problem.tags.forEach(tag => tags.append(element('span', '', tag)));
    info.append(title, tags);
    row.append(info, element('time', '', dateKey(problem.date).slice(5).replace('-', '.')));
    return row;
  }));
  if (!visible.length) $('problem-list').append(element('p', 'empty', '이 날짜에는 참여 기록이 없어요.'));
}

function renderTags(problems) {
  const counts = new Map();
  problems.forEach(problem => problem.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  const max = Math.max(1, ...counts.values());
  $('tag-list').replaceChildren(...[...counts].sort((a, b) => b[1] - a[1]).map(([tag, count]) => {
    const row = element('div', 'tag-row');
    const label = element('div', 'tag-label');
    label.append(element('span', '', tag), element('strong', '', count));
    const track = element('div', 'track');
    const bar = element('div', 'bar');
    bar.style.width = count / max * 100 + '%';
    track.append(bar); row.append(label, track); return row;
  }));
  if (!counts.size) $('tag-list').append(element('p', 'empty', '아직 등록된 유형이 없어요.'));
}

function render() {
  renderMembers();
  const person = data.participants.find(person => person.id === selected);
  $('person-name').textContent = person.name + '의 잔디';
  $('person-caption').textContent = '오늘의 한 문제도, 오래 남는 기록으로.';
  const problems = activity();
  renderStats(problems); renderHeatmap(problems); renderProblems(problems); renderTags(problems);
}

async function start() {
  try {
    const response = await fetch('./data/activity.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Unable to load activity');
    data = await response.json();
    const known = new Set(data.participants.map(person => person.id));
    let remembered;
    try { remembered = localStorage.getItem('coding-grass-member'); } catch {}
    const requested = new URLSearchParams(location.hash.slice(1)).get('member');
    selected = known.has(requested) ? requested : known.has(remembered) ? remembered : data.participants[0]?.id;
    $('member-count').textContent = data.participants.length + '명이 함께하고 있어요';
    $('sync-time').textContent = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.updatedAt)) + ' 동기화';
    const years = [...new Set([today.slice(0,4), ...data.problems.map(problem => dateKey(problem.date).slice(0,4))])].sort().reverse();
    $('year').replaceChildren(...years.map(year => { const option = element('option', '', year + '년'); option.value = year; return option; }));
    if (!selected) { $('members').append(element('p', 'empty', '첫 참여 기록을 기다리고 있어요.')); return; }
    $('dashboard').hidden = false;
    render();
    $('period').addEventListener('change', () => renderHeatmap(activity()));
    $('year').addEventListener('change', () => renderHeatmap(activity()));
    $('reset-date').addEventListener('click', () => { selectedDay = null; render(); });
    window.addEventListener('hashchange', () => { const id = new URLSearchParams(location.hash.slice(1)).get('member'); if (known.has(id)) selectMember(id); });
  } catch (error) {
    $('sync-time').textContent = '동기화 상태를 확인할 수 없어요';
    $('error').hidden = false;
    console.error(error.message);
  }
}
start();
