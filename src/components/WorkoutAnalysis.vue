<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { useWorkoutAnalysis } from '../composables/useWorkoutAnalysis'
import { formatDuration } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const {
  loading,
  selectedSource,
  sourceList,
  selectedCategory,
  categoryList,
  selectedExercise,
  exerciseList,
  dateFrom,
  dateTo,
  aggregation,
  enabledStats,
  useMetric,
  showEmpty,
  e1rmMethod,
  summary,
  chartData,
  chartScales,
  toggleStat,
  statUnit,
  STAT_COLORS,
  STAT_LABELS,
  STRENGTH_STATS,
  CARDIO_STATS,
} = useWorkoutAnalysis()

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  scales: chartScales.value,
  plugins: {
    legend: { position: 'bottom' as const },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const label = ctx.dataset.label || ''
          if (label.startsWith('Duration')) return `${label}: ${formatDuration(ctx.parsed.y)}`
          return `${label}: ${ctx.formattedValue}`
        },
      },
    },
  },
}))

const allEnabledStats = computed(() => [...STRENGTH_STATS, ...CARDIO_STATS].filter((s) => enabledStats.value.has(s)))

function formatNum(n: number, decimals = 1): string {
  return n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: decimals }) : n.toFixed(decimals)
}

function formatWeight(n: number, metric: boolean): string {
  const base = formatNum(n)
  const tonsThreshold = metric ? 9072 : 20000 // 10 tons in kg or lbs
  const tonsDiv = metric ? 907.2 : 2000       // 1 ton in kg or lbs
  const unit = metric ? 'metric tons' : 'tons'
  if (n >= tonsThreshold) {
    return `${base} (${(n / tonsDiv).toFixed(1)} ${unit})`
  }
  return base
}
</script>

<template>
  <div v-if="loading" class="text-center py-8 text-gray-500">Loading...</div>
  <div v-else>
    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-4 mb-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Source</label>
        <select v-model="selectedSource" class="border border-gray-300 rounded px-2 py-1 text-sm">
          <option value="All">All</option>
          <option v-for="s in sourceList" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Category</label>
        <select v-model="selectedCategory" class="border border-gray-300 rounded px-2 py-1 text-sm">
          <option value="All">All</option>
          <option v-for="c in categoryList" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Exercise</label>
        <select v-model="selectedExercise" class="border border-gray-300 rounded px-2 py-1 text-sm">
          <option value="All">All</option>
          <option v-for="e in exerciseList" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">From</label>
        <input type="date" v-model="dateFrom" class="border border-gray-300 rounded px-2 py-1 text-sm" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">To</label>
        <input type="date" v-model="dateTo" class="border border-gray-300 rounded px-2 py-1 text-sm" />
      </div>
      <label class="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 pb-0.5">
        <input type="checkbox" v-model="useMetric" class="accent-gray-600" />
        Metric
      </label>
    </div>

    <!-- Aggregation -->
    <div class="flex items-center gap-4 mb-3 text-sm text-gray-700">
      <span class="text-xs text-gray-500">Aggregation:</span>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="aggregation" value="workout" /> Per Workout
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="aggregation" value="week" /> Weekly
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="aggregation" value="month" /> Monthly
      </label>
      <label
        v-if="aggregation !== 'workout'"
        class="inline-flex items-center gap-1 cursor-pointer ml-4 text-gray-500"
      >
        <input type="checkbox" v-model="showEmpty" class="accent-gray-600" />
        Show empty periods
      </label>
    </div>

    <!-- Strength stats -->
    <div class="flex flex-wrap items-center gap-3 mb-2 text-sm">
      <span class="text-xs text-gray-500 font-medium">Strength:</span>
      <label
        v-for="stat in STRENGTH_STATS"
        :key="stat"
        class="inline-flex items-center gap-1 cursor-pointer"
      >
        <input
          type="checkbox"
          :checked="enabledStats.has(stat)"
          @change="toggleStat(stat)"
          :style="{ accentColor: STAT_COLORS[stat] }"
        />
        <span :style="{ color: STAT_COLORS[stat] }">{{ STAT_LABELS[stat] }}</span>
      </label>
    </div>

    <!-- Cardio stats -->
    <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
      <span class="text-xs text-gray-500 font-medium">Cardio:</span>
      <label
        v-for="stat in CARDIO_STATS"
        :key="stat"
        class="inline-flex items-center gap-1 cursor-pointer"
      >
        <input
          type="checkbox"
          :checked="enabledStats.has(stat)"
          @change="toggleStat(stat)"
          :style="{ accentColor: STAT_COLORS[stat] }"
        />
        <span :style="{ color: STAT_COLORS[stat] }">{{ STAT_LABELS[stat] }}</span>
      </label>
    </div>

    <!-- E1RM method -->
    <div v-if="enabledStats.has('e1rm')" class="flex items-center gap-4 mb-3 text-sm text-gray-700">
      <span class="text-xs text-gray-500">1RM Formula:</span>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="e1rmMethod" value="epley" /> Epley
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="e1rmMethod" value="brzycki" /> Brzycki
      </label>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="radio" v-model="e1rmMethod" value="average" /> Average
      </label>
    </div>

    <!-- Chart -->
    <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4" style="height: 400px">
      <Line v-if="chartData.datasets.length > 0" :data="chartData" :options="chartOptions" />
      <div v-else class="flex items-center justify-center h-full text-gray-400">
        Select at least one stat to display
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="flex flex-wrap gap-3">
      <div
        v-for="stat in allEnabledStats"
        :key="stat"
        class="flex-1 min-w-[120px] bg-white rounded-lg border border-gray-200 p-3 text-center"
      >
        <div class="text-xs text-gray-500">{{ STAT_LABELS[stat] }}</div>
        <div class="text-xl font-semibold mt-1" :style="{ color: STAT_COLORS[stat] }">
          {{ stat === 'duration' ? formatDuration(summary[stat]) : (statUnit(stat) === 'lbs' || statUnit(stat) === 'kg') ? formatWeight(summary[stat], useMetric) : formatNum(summary[stat]) }}
        </div>
        <div v-if="statUnit(stat)" class="text-xs text-gray-400">
          {{ statUnit(stat) }}
        </div>
      </div>
    </div>
  </div>
</template>
