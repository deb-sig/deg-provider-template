<script setup>
import { computed, ref, watch } from 'vue';
import { parseDocument, stringify, parse } from 'yaml';
import { highlightYaml } from './yaml-highlight.mjs';
import { ruleCard } from './rules-view.mjs';

const props = defineProps({ provider: Object, starter: String, t: Function });

const yaml = ref('');
const status = ref('');
const cards = ref([]);
const file = ref(null);
const view = ref('cards');
const open = ref(new Set());

const key = computed(() => `deg-provider-personal-rules:${props.provider.id}`);
const lines = computed(() => highlightYaml(yaml.value));

function document() {
  const d = parseDocument(yaml.value);
  if (d.errors.length || !Array.isArray(d.toJS()?.personalRules)) throw Error('invalid');
  return d;
}
const valid = computed(() => {
  try {
    document();
    return true;
  } catch {
    return false;
  }
});

function syncCards() {
  try {
    cards.value = document().toJS().personalRules.map((r) => ({
      id: r.id || '',
      when: r.when || '',
      actions: stringify(r.actions || {}),
      summary: ruleCard(r, props.t).summary,
    }));
  } catch {
    cards.value = [];
  }
}
function seed() {
  return stringify({ personalRules: parse(props.starter)?.personalRules || [] });
}
watch(
  () => props.provider.id,
  () => {
    try {
      yaml.value = localStorage.getItem(key.value) ?? seed();
    } catch {
      yaml.value = seed();
      status.value = 'storageError';
    }
    syncCards();
  },
  { immediate: true },
);
// Autosave raw drafts (even incomplete YAML) so navigation/revision switches never discard edits.
watch(yaml, () => {
  try {
    localStorage.setItem(key.value, yaml.value);
  } catch {
    status.value = 'storageError';
  }
});
function toggle(index) {
  const next = new Set(open.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  open.value = next;
}
// Card edits patch YAML nodes, so comments and untouched keys survive.
function apply(index, card) {
  try {
    const d = document();
    const actions = parseDocument(card.actions);
    if (actions.errors.length) throw Error();
    d.setIn(['personalRules', index, 'id'], card.id);
    if (card.when) d.setIn(['personalRules', index, 'when'], card.when);
    else d.deleteIn(['personalRules', index, 'when']);
    d.setIn(['personalRules', index, 'actions'], actions.toJS());
    yaml.value = d.toString();
    syncCards();
    status.value = 'valid';
  } catch {
    status.value = 'invalid';
  }
}
function add() {
  try {
    const d = document();
    d.addIn(['personalRules'], { id: 'rule-' + (cards.value.length + 1), when: '', actions: {} });
    yaml.value = d.toString();
    syncCards();
    open.value = new Set([...open.value, cards.value.length - 1]);
  } catch {
    status.value = 'invalid';
  }
}
function remove(index) {
  try {
    const d = document();
    d.deleteIn(['personalRules', index]);
    yaml.value = d.toString();
    syncCards();
  } catch {
    status.value = 'invalid';
  }
}
function save() {
  if (!valid.value) {
    status.value = 'invalid';
    return;
  }
  try {
    localStorage.setItem(key.value, yaml.value);
    status.value = 'saved';
  } catch {
    status.value = 'storageError';
  }
}
function download() {
  const url = URL.createObjectURL(new Blob([yaml.value], { type: 'text/yaml;charset=utf-8' }));
  const a = Object.assign(window.document.createElement('a'), { href: url, download: props.provider.id + '-rules.yaml' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyYaml() {
  try {
    await navigator.clipboard.writeText(yaml.value);
    status.value = 'copied';
  } catch {
    status.value = 'copyError';
  }
}
async function importFile(e) {
  try {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const d = parseDocument(text);
    if (d.errors.length || !Array.isArray(d.toJS()?.personalRules)) throw Error();
    yaml.value = text;
    syncCards();
    status.value = 'valid';
  } catch {
    status.value = 'invalid';
  }
  e.target.value = '';
}
function reset() {
  if (confirm(props.t('confirmReset'))) {
    yaml.value = seed();
    syncCards();
    status.value = '';
  }
}
</script>

<template>
  <section class="panel rules-editor">
    <div class="block-head">
      <div>
        <h2>{{ t('personalRules') }}</h2>
        <p class="muted">{{ t('personalRulesNote') }}</p>
      </div>
      <div class="view-switch">
        <button type="button" :class="{ active: view === 'cards' }" :aria-pressed="view === 'cards'" @click="view = 'cards'">{{ t('viewCards') }}</button>
        <button type="button" :class="{ active: view === 'yaml' }" :aria-pressed="view === 'yaml'" @click="view = 'yaml'">{{ t('viewYaml') }}</button>
      </div>
    </div>

    <div class="actions">
      <button @click="add">{{ t('addRule') }}</button>
      <button @click="save">{{ t('save') }}</button>
      <button @click="file.click()">{{ t('import') }}</button>
      <button @click="download">{{ t('export') }}</button>
      <button @click="copyYaml">{{ t('copyYaml') }}</button>
      <button @click="reset">{{ t('reset') }}</button>
    </div>
    <input ref="file" type="file" accept=".yaml,.yml,text/yaml" hidden @change="importFile">
    <p role="status" class="muted">{{ t(valid ? 'valid' : 'invalid') }}<span v-if="status"> · {{ t(status) }}</span></p>

    <template v-if="view === 'cards'">
      <p v-if="!cards.length" class="muted">{{ t('noRules') }}</p>
      <article v-for="(card, index) in cards" :key="index" class="rule-card-v">
        <header>
          <h3>{{ card.id || t('unnamedRule') }}</h3>
          <button type="button" class="link-btn" @click="toggle(index)">
            {{ open.has(index) ? t('collapse') : t('editRule') }}
          </button>
        </header>
        <ul class="rule-summary">
          <li v-for="(line, li) in card.summary" :key="li">{{ line }}</li>
        </ul>
        <div v-if="open.has(index)" class="rule-fields">
          <label>{{ t('ruleId') }}<input v-model="card.id"></label>
          <label>{{ t('when') }}<input v-model="card.when" spellcheck="false"></label>
          <label>{{ t('actions') }}<textarea v-model="card.actions" rows="4" spellcheck="false"></textarea></label>
          <div class="actions">
            <button @click="apply(index, card)">{{ t('apply') }}</button>
            <button @click="remove(index)">{{ t('deleteRule') }}</button>
          </div>
        </div>
      </article>
    </template>

    <template v-else>
      <label for="rules-editor" class="muted">{{ t('viewYaml') }}</label>
      <textarea id="rules-editor" data-testid="rules-editor" v-model="yaml" spellcheck="false" rows="16" @input="syncCards"></textarea>
      <details class="yaml-preview">
        <summary>{{ t('previewHighlighted') }}</summary>
        <pre class="code"><code><span
          v-for="(line, li) in lines"
          :key="li"
          class="code-line"
        ><span v-for="(token, ti) in line" :key="ti" :class="'tk-' + token.k">{{ token.v }}</span>
        </span></code></pre>
      </details>
    </template>
  </section>
</template>
