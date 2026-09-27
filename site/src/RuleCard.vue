<script setup>
import { computed } from 'vue';
import { highlightYaml } from './yaml-highlight.mjs';

// One rule rendered as a "condition -> action" flow. Used by both the template rule
// list and the personal rule editor, so the two read the same way.
const props = defineProps({
  card: { type: Object, required: true },
  t: { type: Function, required: true },
  open: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle']);

const MAX_CHIPS = 2;
const shownConditions = computed(() => props.card.conditions.slice(0, MAX_CHIPS));
const hiddenConditions = computed(() => Math.max(0, props.card.conditions.length - MAX_CHIPS));
const sourceLines = computed(() => (props.card.source ? highlightYaml(props.card.source) : []));
</script>

<template>
  <article class="rc" :class="[`rc-${card.actionKind}`, { 'rc-complex': card.complex, 'rc-disabled': card.enabled === false }]">
    <header>
      <span class="rc-dot" aria-hidden="true" />
      <h3>{{ card.id }}</h3>
      <span v-if="card.enabled === false" class="chip chip-off">{{ t('ruleDisabled') }}</span>
      <button type="button" class="link-btn" @click="emit('toggle')">
        {{ open ? t('collapse') : (editable ? t('editRule') : t('expand')) }}
      </button>
    </header>

    <div class="rc-flow">
      <template v-if="card.whenKind === 'always'">
        <span class="chip chip-when">{{ t('whenAlways') }}</span>
      </template>
      <template v-else-if="card.whenKind === 'complex'">
        <span class="chip chip-when chip-warn">{{ t('whenComplex') }}</span>
      </template>
      <template v-else>
        <template v-for="(cond, i) in shownConditions" :key="i">
          <span v-if="i" class="rc-join">{{ card.joinText }}</span>
          <span class="chip chip-when">{{ cond }}</span>
        </template>
        <span v-if="hiddenConditions" class="chip chip-more">+{{ hiddenConditions }}</span>
      </template>
      <span class="rc-arrow" aria-hidden="true">→</span>
      <span v-if="!card.actions.length" class="chip chip-act chip-muted">{{ t('noAction') }}</span>
      <span v-else class="chip chip-act">{{ card.shortAction }}</span>
      <span v-if="card.actions.length > 1" class="chip chip-more">+{{ card.actions.length - 1 }}</span>
    </div>

    <div v-if="open" class="rc-detail">
      <ul v-if="card.actions.length" class="rc-actions">
        <li v-for="(line, i) in card.actions" :key="i">{{ line }}</li>
      </ul>
      <pre v-if="sourceLines.length" class="code rule-source"><code><span
        v-for="(line, li) in sourceLines"
        :key="li"
        class="code-line"
      ><span v-for="(token, ti) in line" :key="ti" :class="'tk-' + token.k">{{ token.v }}</span>
      </span></code></pre>
      <slot name="editor" />
    </div>
  </article>
</template>
