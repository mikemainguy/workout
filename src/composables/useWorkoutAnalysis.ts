import { ref, computed, watch, onMounted } from 'vue'
import { db, type Workout } from '../db'

type Aggregation = 'workout' | 'week' | 'month'
type StatKey = 'sets' | 'reps' | 'avgWeight' | 'maxWeight' | 'totalVolume'

interface DataPoint {
  label: string
  sets: number
  reps: number
  avgWeight: number
  maxWeight: number
  totalVolume: number
}

const STAT_COLORS: Record<StatKey, string> = {
  sets: '#8b5cf6',
  reps: '#06b6d4',
  avgWeight: '#3b82f6',
  maxWeight: '#ef4444',
  totalVolume: '#10b981',
}

const STAT_LABELS: Record<StatKey, string> = {
  sets: '# Sets',
  reps: '# Reps',
  avgWeight: 'Avg Weight',
  maxWeight: 'Max Weight',
  totalVolume: 'Total Volume',
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function aggregate(workouts: Workout[], groupBy: Aggregation, metric: boolean): DataPoint[] {
  const groups = new Map<string, Workout[]>()

  for (const w of workouts) {
    let key: string
    if (groupBy === 'workout') key = w.datePart
    else if (groupBy === 'week') key = isoWeek(w.datePart)
    else key = w.datePart.slice(0, 7) // YYYY-MM

    const arr = groups.get(key) ?? []
    arr.push(w)
    groups.set(key, arr)
  }

  const points: DataPoint[] = []
  for (const [label, sets] of groups) {
    const totalSets = sets.length
    const totalReps = sets.reduce((s, w) => s + w.reps, 0)
    const weights = sets.map((w) => metric ? w.weightKg : w.weightLbs).filter((v) => v > 0)
    const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0
    const totalVolume = sets.reduce((s, w) => {
      const wt = metric ? w.weightKg : w.weightLbs
      return s + wt * w.reps
    }, 0)

    points.push({ label, sets: totalSets, reps: totalReps, avgWeight, maxWeight, totalVolume })
  }

  return points.sort((a, b) => a.label.localeCompare(b.label))
}

export function useWorkoutAnalysis() {
  const allWorkouts = ref<Workout[]>([])
  const loading = ref(true)

  const selectedCategory = ref('All')
  const selectedExercise = ref('All')
  const dateFrom = ref('')
  const dateTo = ref('')
  const aggregation = ref<Aggregation>('workout')
  const enabledStats = ref(new Set<StatKey>(['avgWeight', 'maxWeight']))
  const useMetric = ref(false)

  onMounted(async () => {
    allWorkouts.value = await db.workouts.orderBy('date').toArray()
    loading.value = false
  })

  const categoryList = computed(() => {
    const cats = new Set<string>()
    for (const w of allWorkouts.value) {
      if (w.category) cats.add(w.category)
    }
    return [...cats].sort()
  })

  // Reset exercise when category changes
  watch(selectedCategory, () => {
    selectedExercise.value = 'All'
  })

  const exerciseList = computed(() => {
    const names = new Set<string>()
    for (const w of allWorkouts.value) {
      if (selectedCategory.value !== 'All' && w.category !== selectedCategory.value) continue
      names.add(w.exercise)
    }
    return [...names].sort()
  })

  const filteredWorkouts = computed(() => {
    return allWorkouts.value.filter((w) => {
      if (w.isWarmup) return false
      if (selectedCategory.value !== 'All' && w.category !== selectedCategory.value) return false
      if (selectedExercise.value !== 'All' && w.exercise !== selectedExercise.value) return false
      if (dateFrom.value && w.datePart < dateFrom.value) return false
      if (dateTo.value && w.datePart > dateTo.value) return false
      return true
    })
  })

  const analysisData = computed(() => {
    return aggregate(filteredWorkouts.value, aggregation.value, useMetric.value)
  })

  const summary = computed(() => {
    const data = analysisData.value
    if (data.length === 0) return { sets: 0, reps: 0, avgWeight: 0, maxWeight: 0, totalVolume: 0 }
    return {
      sets: data.reduce((s, d) => s + d.sets, 0),
      reps: data.reduce((s, d) => s + d.reps, 0),
      avgWeight: data.reduce((s, d) => s + d.avgWeight, 0) / data.length,
      maxWeight: Math.max(...data.map((d) => d.maxWeight)),
      totalVolume: data.reduce((s, d) => s + d.totalVolume, 0),
    }
  })

  const chartData = computed(() => {
    const datasets = [...enabledStats.value].map((stat) => ({
      label: STAT_LABELS[stat] + (stat.includes('eight') || stat === 'totalVolume'
        ? ` (${useMetric.value ? 'kg' : 'lbs'})`
        : ''),
      data: analysisData.value.map((d) => ({ x: d.label, y: d[stat] })),
      borderColor: STAT_COLORS[stat],
      backgroundColor: STAT_COLORS[stat] + '20',
      tension: 0.3,
      pointRadius: 3,
      yAxisID: (stat === 'sets' || stat === 'reps') ? 'y-count' : 'y-weight',
    }))

    return { datasets }
  })

  const hasCountAxis = computed(() => [...enabledStats.value].some((s) => s === 'sets' || s === 'reps'))
  const hasWeightAxis = computed(() => [...enabledStats.value].some((s) => s !== 'sets' && s !== 'reps'))

  function toggleStat(stat: StatKey) {
    const s = new Set(enabledStats.value)
    if (s.has(stat)) {
      if (s.size > 1) s.delete(stat) // keep at least one
    } else {
      s.add(stat)
    }
    enabledStats.value = s
  }

  return {
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
    analysisData,
    summary,
    chartData,
    hasCountAxis,
    hasWeightAxis,
    toggleStat,
    STAT_COLORS,
    STAT_LABELS,
  }
}

export type { Aggregation, StatKey, DataPoint }
