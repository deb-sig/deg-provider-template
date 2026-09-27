<script setup>
import { computed, ref, watch } from 'vue';
import { parse, stringify } from 'yaml';
import { highlightYaml } from './yaml-highlight.mjs';
import { ruleCard } from './rules-view.mjs';
import { readRules, editRule, addRule, removeRule, toCards } from './rules-edit.mjs';
import RuleCard from './RuleCard.vue';

const props = defineProps({ provider: Object, starter: String, t: Function });

const yaml = ref('');
const status = ref('');
const file = ref(null);
const view = ref('cards');
const query = ref('');
const openIndex = ref(-1);
const draft = ref(null);

const key = computed(() => `deg-provider-personal-rules:${props.provider.id}`);
const lines = computed(() => highlightYaml(yaml.value));

// Reads through the same pure helpers the tests exercise, so card edits and YAML edits
// cannot drift apart.
const describeRule = (rule) => ({ ...ruleCard(rule, props.t), when: rule.when || '', source: stringify(rule) });
const cards = computed(() => {
  try {
    return toCards(yaml.value, describeRule);
  } catch {
    return [];
  }
});
const valid = computed(() => {
  try {
    readRules(yaml.value);
    return true;
  } catch {
    return false;
  }
});
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return cards.value
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => (!q ? true : [card.id, card.when, card.actionsYaml].join(' ').toLowerCase().includes(q)));
});

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
    openIndex.value = -1;
    draft.value = null;
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
  if (openIndex.value === index) {
    openIndex.value = -1;
    draft.value = null;
    return;
  }
  const card = cards.value[index];
  openIndex.value = index;
  draft.value = { id: card.id, when: card.when, actions: card.actionsYaml };
}
// While editing, the card chips follow the draft so the preview matches what will be saved.
function liveCard(index) {
  const card = cards.value[index];
  if (openIndex.value !== index || !draft.value || !card) return card;
  try {
    const actions = parse(draft.value.actions) || {};
    return { ...ruleCard({ id: draft.value.id, when: draft.value.when, actions }, props.t), actionsYaml: draft.value.actions };
  } catch {
    return card;
  }
}
function apply() {
  try {
    yaml.value = editRule(yaml.value, openIndex.value, draft.value);
    status.value = 'valid';
    openIndex.value = -1;
    draft.value = null;
  } catch {
    status.value = 'invalid';
  }
}
function add() {
  try {
    yaml.value = addRule(yaml.value, `${props.t('newRulePrefix')}-${cards.value.length + 1}`);
    status.value = 'valid';
    toggle(cards.value.length - 1);
  } catch {
    status.value = 'invalid';
  }
}
function remove(index) {
  try {
    yaml.value = removeRule(yaml.value, index);
    status.value = 'valid';
    openIndex.value = -1;
    draft.value = null;
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
    readRules(text);
    yaml.value = text;
    status.value = 'valid';
  } catch {
    status.value = 'invalid';
  }
  e.target.value = '';
}
function reset() {
  if (confirm(props.t('confirmReset'))) {
    yaml.value = seed();
    status.value = '';
    openIndex.value = -1;
    draft.value = null;
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
      <template v-else>
        <div class="rules-tools">
          <input v-model="query" type="search" :placeholder="t('searchRules')" :aria-label="t('searchRules')">
          <span class="muted">{{ filtered.length }} / {{ cards.length }} {{ t('rulesCount') }}</span>
        </div>
        <p v-if="!filtered.length" class="muted">{{ t('noMatch') }}</p>
        <div class="rc-list">
          <RuleCard
            v-for="entry in filtered"
            :key="entry.index"
            :card="liveCard(entry.index)"
            :t="t"
            :open="openIndex === entry.index"
            editable
            @toggle="toggle(entry.index)"
          >
            <template #editor>
              <div class="rule-fields">
                <label>{{ t('ruleId') }}<input v-model="draft.id"></label>
                <label>{{ t('when') }}<input v-model="draft.when" spellcheck="false" :placeholder="t('whenPlaceholder')"></label>
                <label>{{ t('actions') }}<textarea v-model="draft.actions" rows="4" spellcheck="false"></textarea></label>
                <div class="actions">
                  <button @click="apply">{{ t('apply') }}</button>
                  <button @click="remove(entry.index)">{{ t('deleteRule') }}</button>
                </div>
              </div>
            </template>
          </RuleCard>
        </div>
      </template>
    </template>

    <template v-else>
      <label for="rules-editor" class="muted">{{ t('viewYaml') }}</label>
      <textarea id="rules-editor" data-testid="rules-editor" v-model="yaml" spellcheck="false" rows="16"></textarea>
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
