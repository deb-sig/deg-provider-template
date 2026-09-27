// Pure (DOM-free) rule document editing, so the card <-> YAML round trip is testable.
// RulesEditor.vue owns the refs; every mutation of the YAML text goes through here.

import { parseDocument, stringify } from 'yaml';

export function readRules(text) {
  const doc = parseDocument(String(text ?? ''));
  if (doc.errors.length) throw new Error('invalidYaml');
  const js = doc.toJS();
  if (!js || typeof js !== 'object' || !Array.isArray(js.personalRules)) {
    throw new Error('invalidStructure');
  }
  return js.personalRules;
}

export function actionsToYaml(rule) {
  return stringify(rule?.actions ?? {});
}

/** Card fields -> YAML text, patching nodes so comments and untouched keys survive.
 *  Actions come from `actionsYaml` (read from a rule) or `actions` (edited in a textarea). */
export function editRule(text, index, card) {
  const doc = parseDocument(String(text ?? ''));
  if (doc.errors.length) throw new Error('invalidYaml');
  const rawActions = card?.actionsYaml ?? card?.actions;
  if (typeof rawActions !== 'string') throw new Error('invalidActions');
  const actions = parseDocument(rawActions);
  if (actions.errors.length) throw new Error('invalidActions');
  doc.setIn(['personalRules', index, 'id'], card.id ?? '');
  if (card.when) doc.setIn(['personalRules', index, 'when'], card.when);
  else doc.deleteIn(['personalRules', index, 'when']);
  doc.setIn(['personalRules', index, 'actions'], actions.toJS() ?? {});
  return doc.toString();
}

export function addRule(text, id) {
  const doc = parseDocument(String(text ?? ''));
  if (doc.errors.length) throw new Error('invalidYaml');
  doc.addIn(['personalRules'], { id, when: '', actions: {} });
  return doc.toString();
}

export function removeRule(text, index) {
  const doc = parseDocument(String(text ?? ''));
  if (doc.errors.length) throw new Error('invalidYaml');
  doc.deleteIn(['personalRules', index]);
  return doc.toString();
}

/** YAML text -> card models, ready for the editor list.
 *  `actions` stays the readable prose from the describer; the editable YAML lives in
 *  `actionsYaml` so the two never overwrite each other. */
export function toCards(text, describe) {
  return readRules(text).map((rule) => ({ ...describe(rule), actionsYaml: actionsToYaml(rule) }));
}
