import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { dateKey, memberActivity, metrics, calendarRange } from '../lib/activity.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/activity.json', root), 'utf8'));
const today = dateKey(new Date().toISOString());
const outputDirectory = new URL('assets/grass/', root);
await mkdir(outputDirectory, {recursive:true});

const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const escapeMarkdown = value => String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/[\r\n]/g, ' ');
const text = (x, y, value, className = '') => '<text x="' + x + '" y="' + y + '" class="' + className + '">' + escapeXml(value) + '</text>';

function renderCard(person, problems) {
  const stats = metrics(problems, today);
  const range = calendarRange(today, '12w', today.slice(0, 4));
  const counts = new Map();
  problems.forEach(problem => {
    const key = dateKey(problem.date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const cells = range.cells.map((cell, index) => {
    const count = counts.get(cell.key) || 0;
    const x = 49 + Math.floor(index / 7) * 21;
    const y = 83 + index % 7 * 19;
    return '<rect x="' + x + '" y="' + y + '" width="16" height="14" rx="3" class="' + (cell.future ? 'future' : 'level-' + Math.min(count, 4)) + '"><title>' + escapeXml(cell.key + ', ' + count + '문제') + '</title></rect>';
  }).join('');
  const weekdays = ['월','화','수','목','금','토','일'].map((day, index) => text(25, 94 + index * 19, day, 'weekday')).join('');
  const entries = [
    ['누적 풀이', stats.total + '문제', 363, 91],
    ['이번 달', stats.month + '문제', 510, 91],
    ['참여한 날', stats.days + '일', 657, 91],
    ['현재 연속 기록', stats.streak + '일', 363, 166],
    ['최장 연속 기록', stats.longest + '일', 510, 166]
  ];
  const summary = entries.map(([label, value, x, y]) => text(x, y, label, 'metric-label') + text(x, y + 31, value, 'metric-value')).join('');
  const legend = [0,1,2,3,4].map(level => '<rect x="' + (150 + level * 19) + '" y="228" width="13" height="12" rx="3" class="level-' + level + '"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="260" viewBox="0 0 800 260" role="img" aria-labelledby="title description">' +
    '<title id="title">' + escapeXml(person.name + '의 최근 12주 잔디') + '</title>' +
    '<desc id="description">' + escapeXml('누적 ' + stats.total + '문제, 이번 달 ' + stats.month + '문제, ' + stats.days + '일 참여. 집계 기준 ' + today) + '</desc>' +
    '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;fill:#24292f}.card{fill:#fff;stroke:#d0d7de}.name{font-size:20px;font-weight:650}.caption,.weekday,.metric-label,.legend{fill:#656d76;font-size:11px}.metric-value{font-size:25px;font-weight:600}.divider{stroke:#d8dee4}.level-0{fill:#ebedf0}.level-1{fill:#9be9a8}.level-2{fill:#40c463}.level-3{fill:#30a14e}.level-4{fill:#216e39}.future{fill:none;stroke:#d8dee4;stroke-dasharray:2 2}@media(prefers-color-scheme:dark){text{fill:#e6edf3}.card{fill:#0d1117;stroke:#30363d}.caption,.weekday,.metric-label,.legend{fill:#8b949e}.divider{stroke:#30363d}.level-0{fill:#161b22}.level-1{fill:#0e4429}.level-2{fill:#006d32}.level-3{fill:#26a641}.level-4{fill:#39d353}.future{stroke:#30363d}}</style>' +
    '<rect class="card" x=".5" y=".5" width="799" height="259" rx="13"/>' +
    text(25, 34, person.name, 'name') + text(25, 57, '최근 12주  ' + range.start.replaceAll('-', '.') + ' ~ ' + range.end.replaceAll('-', '.'), 'caption') +
    '<line class="divider" x1="329" y1="80" x2="329" y2="215"/>' + weekdays + cells + summary +
    text(114, 238, '적음', 'legend') + legend + text(250, 238, '많음', 'legend') + text(657, 202, today.replaceAll('-', '.') + ' 기준', 'caption') +
    '</svg>\n';
}

const filenames = new Set();
const sections = [];
for (const person of data.participants) {
  if (!/^member-[a-f0-9]{12}$/.test(person.id)) throw new Error('Invalid participant identifier.');
  const filename = person.id + '.svg';
  filenames.add(filename);
  const problems = memberActivity(data, person.id, today);
  await writeFile(new URL(filename, outputDirectory), renderCard(person, problems));
  sections.push('![ ' + escapeMarkdown(person.name) + '의 최근 12주 잔디](assets/grass/' + filename + ')');
}
for (const filename of await readdir(outputDirectory)) {
  if (/^member-[a-f0-9]{12}\.svg$/.test(filename) && !filenames.has(filename)) await unlink(new URL(filename, outputDirectory));
}

const recent = data.problems.filter(problem => dateKey(problem.date) <= today)
  .sort((a,b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title,'ko')).slice(0, 10);
const names = new Map(data.participants.map(person => [person.id, person.name]));
const rows = recent.map(problem => {
  let title = escapeMarkdown(problem.title);
  try {
    const url = new URL(problem.url);
    if (url.protocol === 'https:') title = '[' + title + '](' + url.href.replaceAll('(', '%28').replaceAll(')', '%29') + ')';
  } catch {}
  return '| ' + dateKey(problem.date) + ' | ' + title + ' | ' + problem.participants.map(id => escapeMarkdown(names.get(id) || '참여자')).join(', ') + ' |';
});
const updated = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(data.updatedAt));
const readme = [
  '# Coding Grass', '',
  '함께 푼 문제, 꾸준히 쌓이는 기록.', '',
  '노션의 코딩 테스트 참여 기록을 모아 사람별 잔디로 보여줍니다.', '',
  '**' + data.participants.length + '명**이 함께 풀어 온 **' + data.problems.filter(problem => dateKey(problem.date) <= today).length + '개 문제**', '',
  '기록 동기화 ' + updated + ' (서울 시간)', '',
  '## 함께 쌓은 잔디', '',
  '칸 하나는 하루입니다. 같은 날 여러 문제에 참여할수록 초록색이 진해집니다.', '',
  ...sections.flatMap(section => [section, '']),
  '## 최근 푼 문제', '',
  '| 날짜 | 문제 | 참여자 |', '| --- | --- | --- |', ...rows, '',
  '<details>', '<summary>집계 기준과 자동 갱신</summary>', '',
  '- 문제 DB에 지정된 날짜와 참여자로 집계합니다.',
  '- 날짜는 서울 시간대 기준이며, 미래 기록은 풀이 통계에서 제외합니다.',
  '- 현재 연속 기록은 오늘 또는 어제까지 이어진 참여일을 셉니다.',
  '- GitHub Actions가 매시 17분과 47분에 노션 동기화와 이미지 갱신을 실행합니다.',
  '- 노션 토큰 등록 전에는 기존 스냅샷으로 표시합니다. 기록 동기화 시각을 확인해 주세요.',
  '', '[연결 설정과 로컬 실행](docs/setup.md)', '', '</details>', ''
].join('\n');
await writeFile(new URL('README.md', root), readme);
console.log('Rendered README and ' + filenames.size + ' participant SVG cards.');
