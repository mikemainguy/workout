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
import { useWorkoutAnalysis, type StatKey } from '../composables/useWorkoutAnalysis'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const {
  loading,
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
  summary,
  chartData,
  hasCountAxis,
  hasWeightAxis,
  toggleStat,
  STAT_COLORS,
  STAT_LABELS,
} = useWorkoutAnalysis()

const ALL_STATS: StatKey[] = ['sets', 'reps', 'avgWeight', 'maxWeight', 'totalVolume']

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  scales: {
    'y-weight': {
      type: 'linear' as const,
      position: 'left' as const,
      display: hasWeightAxis.value,
      title: { display: true, text: useMetric.value ? 'kg' : 'lbs' },
    },
    'y-count': {
      type: 'linear' as const,
      position: 'right' as const,
      display: hasCountAxis.value,
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'Count' },
    },
  },
  plugins: {
    legend: { position: 'bottom' as const },
  },
}))

function formatNum(n: number, decimals = 1): string {
  return n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: decimals }) : n.toFixed(decimals)
}
</script>

<template>
  <div v-if="loading" class="text-center py-8 text-gray-500">Loading...</div>
  <div v-else>
    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-4 mb-4">
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

    <!-- Stats toggles -->
    <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
      <span class="text-xs text-gray-500">Stats:</span>
      <label
        v-for="stat in ALL_STATS"
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
        v-for="stat in ALL_STATS"
        :key="stat"
        v-show="enabledStats.has(stat)"
        class="flex-1 min-w-[120px] bg-white rounded-lg border border-gray-200 p-3 text-center"
      >
        <div class="text-xs text-gray-500">{{ STAT_LABELS[stat] }}</div>
        <div class="text-xl font-semibold mt-1" :style="{ color: STAT_COLORS[stat] }">
          {{ formatNum(summary[stat]) }}
        </div>
        <div v-if="stat.includes('eight') || stat === 'totalVolume'" class="text-xs text-gray-400">
          {{ useMetric ? 'kg' : 'lbs' }}
        </div>
      </div>
    </div>
  </div>
</template>
