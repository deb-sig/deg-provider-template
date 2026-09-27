<script setup>
import { computed } from 'vue';
import { highlightBeancount, plainLines } from './beancount.mjs';

const props = defineProps({
  text: { type: String, default: '' },
  lang: { type: String, default: 'beancount' },
  maxHeight: { type: String, default: '' },
});

const lines = computed(() =>
  props.lang === 'text' ? plainLines(props.text) : highlightBeancount(props.text),
);
</script>

<template>
  <pre class="code" :style="maxHeight ? { maxHeight } : null"><code><span
    v-for="(line, index) in lines"
    :key="index"
    class="code-line"
  ><span v-for="(token, ti) in line" :key="ti" :class="'tk-' + token.k">{{ token.v }}</span>
</span></code></pre>
</template>
