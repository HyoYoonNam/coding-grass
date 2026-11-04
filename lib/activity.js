export function dateKey(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function addDays(key, amount) {
  const date = new Date(key + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function memberActivity(data, id, today) {
  return data.problems.filter(problem => problem.participants.includes(id) && dateKey(problem.date) <= today);
}

export function metrics(problems, today) {
  const days = [...new Set(problems.map(problem => dateKey(problem.date)))].sort();
  let longest = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && addDays(days[index - 1], 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const daySet = new Set(days);
  let cursor = daySet.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (daySet.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return { total: problems.length, days: days.length, month: problems.filter(problem => dateKey(problem.date).startsWith(today.slice(0, 7))).length, longest, streak };
}

export function calendarRange(today, mode, year) {
  const mondayOffset = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const start = mode === '12w' ? addDays(today, -mondayOffset - 77) : year + '-01-01';
  const end = mode === '12w' ? addDays(today, 6 - mondayOffset) : year + '-12-31';
  const startOffset = (new Date(start + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const gridStart = addDays(start, -startOffset);
  const cells = [];
  for (let key = gridStart; key <= end || cells.length % 7 !== 0; key = addDays(key, 1)) {
    cells.push({ key, outside: key < start || key > end, future: key > today });
  }
  return { start, end, cells };
}
