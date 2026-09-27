<script setup>
import { computed, ref, watch } from 'vue';
import { parseDelimited, splitTable } from './csv.mjs';
import CodeBlock from './CodeBlock.vue';

const props = defineProps({
  bill: { type: String, default: null },
  billType: { type: String, default: 'noSample' },
  converted: { type: Boolean, default: false },
  t: { type: Function, required: true },
});

const view = ref('table');
const parsed = computed(() => (props.billType === 'text' && props.bill ? parseDelimited(props.bill) : null));
const table = computed(() => (parsed.value ? splitTable(parsed.value.rows) : null));
const canTable = computed(() => !!table.value && table.value.header.length > 1);

// XLS/XLSX previews arrive pre-converted as CSV text; treat them as tables too.
watch(canTable, (ok) => { if (!ok) view.value = 'raw'; }, { immediate: true });
</script>

<template>
  <div class="bill">
    <div v-if="canTable" class="view-switch">
      <button
        type="button"
        :class="{ active: view === 'table' }"
        :aria-pressed="view === 'table'"
        @click="view = 'table'"
      >{{ t('viewTable') }}</button>
      <button
        type="button"
        :class="{ active: view === 'raw' }"
        :aria-pressed="view === 'raw'"
        @click="view = 'raw'"
      >{{ t('viewRaw') }}</button>
    </div>

    <template v-if="view === 'table' && canTable">
      <div v-if="table.preamble.length" class="preamble">
        <div v-for="(row, ri) in table.preamble" :key="ri">{{ row.filter((c) => String(c).trim()).join(' · ') }}</div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th v-for="(h, i) in table.header" :key="i" :title="String(h)">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in table.body" :key="ri">
              <td v-for="(c, ci) in r" :key="ci" :title="String(c)" :class="{ 'is-long': String(c).length > 18 }">{{ c }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <small>{{ table.body.length }} {{ t('rowsLabel') }}<template v-if="parsed.truncated"> · {{ t('truncated') }}</template><template v-if="converted"> · {{ t('convertedFromSheet') }}</template></small>
    </template>

    <template v-else-if="billType === 'text' && bill">
      <CodeBlock :text="bill" lang="text" />
      <small>{{ t('truncated') }}</small>
    </template>

    <p v-else class="muted" data-testid="bill-unavailable">{{ t(billType) }}</p>
  </div>
</template>
