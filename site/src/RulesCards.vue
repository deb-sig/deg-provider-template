<script setup>
import { computed, ref } from 'vue';
import { stringify } from 'yaml';
import { highlightYaml } from './yaml-highlight.mjs';
import { ruleCard } from './rules-view.mjs';
import RuleCard from './RuleCard.vue';

const props = defineProps({
  title: { type: String, required: true },
  rules: { type: Array, default: () => [] },
  raw: { type: String, default: '' },
  t: { type: Function, required: true },
});

const view = ref('cards');
const open = ref(new Set());
const lines = computed(() => highlightYaml(props.raw));
const cards = computed(() =>
  props.rules.map((r) => ({ ...ruleCard(r, props.t), source: stringify(r) })),
);

function toggle(index) {
  const next = new Set(open.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  open.value = next;
}
</script>

<template>
  <section class="panel rules-block">
    <div class="block-head">
      <h2>{{ title }}</h2>
      <div class="view-switch">
        <button type="button" :class="{ active: view === 'cards' }" :aria-pressed="view === 'cards'" @click="view = 'cards'">{{ t('viewCards') }}</button>
        <button type="button" :class="{ active: view === 'raw' }" :aria-pressed="view === 'raw'" @click="view = 'raw'">{{ t('viewRaw') }}</button>
      </div>
    </div>

    <template v-if="view === 'cards'">
      <p v-if="!cards.length" class="muted">{{ t('noRules') }}</p>
      <div v-else class="rc-list">
        <RuleCard
          v-for="(card, index) in cards"
          :key="index"
          :card="card"
          :t="t"
          :open="open.has(index)"
          @toggle="toggle(index)"
        />
      </div>
    </template>

    <pre v-else class="code"><code><span
      v-for="(line, li) in lines"
      :key="li"
      class="code-line"
    ><span v-for="(token, ti) in line" :key="ti" :class="'tk-' + token.k">{{ token.v }}</span>
    </span></code></pre>
  </section>
</template>
