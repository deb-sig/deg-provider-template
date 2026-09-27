import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { readRules, editRule, addRule, removeRule, actionsToYaml, toCards } from '../src/rules-edit.mjs';
import { ruleCard } from '../src/rules-view.mjs';
import { translate } from '../src/i18n.mjs';

const t = (k) => translate('zh-CN', k);
const describeRule = (rule) => ({ ...ruleCard(rule, t), when: rule.when || '' });

const BASE = `personalRules:
  # keep this comment
  - id: 晚餐
    when: <交易分类> ~ 餐饮美食
    actions:
      to: Expenses:Food:Dinner
  - id: 忽略关闭
    when: <交易状态> == 交易关闭
    actions:
      ignore: true
`;

test('readRules returns the rule array and rejects other shapes', () => {
  assert.equal(readRules(BASE).length, 2);
  assert.throws(() => readRules('templateRules: []'), /invalidStructure/);
  assert.throws(() => readRules('personalRules: [oops'), /invalidYaml/);
  assert.throws(() => readRules(''), /invalidStructure/);
});

test('cards -> yaml -> cards round trip is stable', () => {
  const cards = toCards(BASE, describeRule);
  assert.deepEqual(cards.map((c) => c.id), ['晚餐', '忽略关闭']);
  assert.deepEqual(cards[0].conditions, ['交易分类 包含 餐饮美食']);
  // Prose actions stay prose; the editable text is the separate actionsYaml field.
  assert.deepEqual(cards[1].actions, ['忽略这笔']);
  assert.equal(parse(cards[1].actionsYaml).ignore, true);

  // Re-applying the values we just read must not change the document.
  let text = BASE;
  cards.forEach((card, index) => {
    text = editRule(text, index, card);
  });
  assert.deepEqual(parse(text), parse(BASE));
  assert.deepEqual(toCards(text, describeRule).map((c) => c.id), ['晚餐', '忽略关闭']);
});

test('editing one rule preserves comments and leaves the other rule alone', () => {
  const out = editRule(BASE, 0, { id: '午餐', when: '<交易分类> ~ 餐饮美食', actions: 'to: Expenses:Food:Lunch\n' });
  assert.match(out, /# keep this comment/);
  const rules = readRules(out);
  assert.equal(rules[0].id, '午餐');
  assert.equal(rules[0].actions.to, 'Expenses:Food:Lunch');
  assert.equal(rules[1].id, '忽略关闭');
  assert.equal(rules[1].actions.ignore, true);
});

test('clearing the when field removes the key instead of writing an empty one', () => {
  const out = editRule(BASE, 0, { id: '晚餐', when: '', actions: 'to: Expenses:Food:Dinner\n' });
  const rule = readRules(out)[0];
  assert.ok(!('when' in rule), JSON.stringify(rule));
});

test('invalid action YAML throws and never rewrites the document', () => {
  assert.throws(() => editRule(BASE, 0, { id: 'x', when: '<a> == 1', actions: 'to: [unclosed' }), /invalidActions/);
  assert.throws(() => editRule('personalRules: [oops', 0, { id: 'x', actions: '{}' }), /invalidYaml/);
});

test('add and remove keep the document valid', () => {
  const added = addRule(BASE, '规则-3');
  assert.equal(readRules(added).length, 3);
  assert.equal(readRules(added)[2].id, '规则-3');
  const removed = removeRule(added, 0);
  assert.deepEqual(readRules(removed).map((r) => r.id), ['忽略关闭', '规则-3']);
  // Removing by index off the end must not corrupt the rest.
  assert.deepEqual(readRules(removeRule(BASE, 1)).map((r) => r.id), ['晚餐']);
});

test('actionsToYaml is the inverse used by the editor cards', () => {
  const rule = readRules(BASE)[0];
  assert.equal(parse(actionsToYaml(rule)).to, 'Expenses:Food:Dinner');
  assert.equal(actionsToYaml({}), '{}\n');
});
