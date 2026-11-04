import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, addDays, metrics, calendarRange, memberActivity } from '../lib/activity.js';

test('UTC timestamps are grouped by Seoul calendar date', () => {
  assert.equal(dateKey('2026-10-26T16:00:00Z'), '2026-10-27');
  assert.equal(dateKey('2026-10-27'), '2026-10-27');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});
test('streaks count distinct days, and remain current until today ends', () => {
  const problems = ['2026-11-01','2026-11-02','2026-11-02','2026-11-03','2026-10-27'].map(date => ({date}));
  assert.deepEqual(metrics(problems, '2026-11-04'), {total:5,days:4,month:4,longest:3,streak:3});
  assert.equal(metrics(problems, '2026-11-05').streak, 0);
});
test('12 week grid covers exactly 84 days with Monday first', () => {
  const range = calendarRange('2026-11-04', '12w', '2026');
  assert.equal(range.cells.length, 84);
  assert.equal(range.start, '2026-08-17');
  assert.equal(range.cells.filter(cell => cell.future).length, 4);
});
test('leap year grid includes February 29 and outside days are disabled', () => {
  const range = calendarRange('2026-11-04', 'year', '2024');
  assert.equal(range.cells.filter(cell => !cell.outside).length, 366);
  assert.ok(range.cells.some(cell => cell.key === '2024-02-29'));
  assert.equal(range.cells.length % 7, 0);
});
test('only the selected participant and nonfuture records are counted', () => {
  const data = {problems:[{date:'2026-10-27',participants:['moa']},{date:'2026-11-05',participants:['moa']},{date:'2026-11-01',participants:['other']}]};
  assert.equal(memberActivity(data, 'moa', '2026-11-04').length, 1);
});
