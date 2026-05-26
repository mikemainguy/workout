import { ref, computed, watch, onMounted } from 'vue'
import { db, type Workout } from '../db'
import { formatDuration } from '../utils/format'

const MI_TO_KM = 1.60934

type Aggregation = 'workout' | 'week' | 'month'
type StatKey =
  | 'sets' | 'reps' | 'avgWeight' | 'maxWeight' | 'totalVolume' | 'e1rm'
  | 'distance' | 'duration' | 'calories'
  | 'avgHeartrate' | 'maxHeartrate'
  | 'avgWatts' | 'maxWatts'
  | 'avgCadence' | 'avgSpeed' | 'maxSpeed'
  | 'totalOutput'
type E1rmMethod = 'epley' | 'brzycki' | 'average'

interface DataPoint {
  label: string
  // Strength
  sets: number
  reps: number
  avgWeight: number
  maxWeight: number
  totalVolume: number
  e1rm: number
  // Cardio
  distance: number
  duration: number
  calories: number
  avgHeartrate: number
  maxHeartrate: number
  avgWatts: number
  maxWatts: number
  avgCadence: number
  avgSpeed: number
  maxSpeed: number
  totalOutput: number
}

const STRENGTH_STATS: StatKey[] = ['sets', 'reps', 'avgWeight', 'maxWeight', 'totalVolume', 'e1rm']
const CARDIO_STATS: StatKey[] = ['distance', 'duration', 'calories', 'avgHeartrate', 'maxHeartrate', 'avgWatts', 'maxWatts', 'avgCadence', 'avgSpeed', 'maxSpeed', 'totalOutput']

const STAT_COLORS: Record<StatKey, string> = {
  sets: '#8b5cf6',
  reps: '#06b6d4',
  avgWeight: '#3b82f6',
  maxWeight: '#ef4444',
  totalVolume: '#10b981',
  e1rm: '#f59e0b',
  distance: '#14b8a6',
  duration: '#64748b',
  calories: '#f97316',
  avgHeartrate: '#ef4444',
  maxHeartrate: '#dc2626',
  avgWatts: '#eab308',
  maxWatts: '#ca8a04',
  avgCadence: '#8b5cf6',
  avgSpeed: '#06b6d4',
  maxSpeed: '#0891b2',
  totalOutput: '#22c55e',
}

const STAT_LABELS: Record<StatKey, string> = {
  sets: '# Sets',
  reps: '# Reps',
  avgWeight: 'Avg Weight',
  maxWeight: 'Max Weight',
  totalVolume: 'Total Volume',
  e1rm: 'Est. 1RM',
  distance: 'Distance',
  duration: 'Duration',
  calories: 'Calories',
  avgHeartrate: 'Avg HR',
  maxHeartrate: 'Max HR',
  avgWatts: 'Avg Watts',
  maxWatts: 'Max Watts',
  avgCadence: 'Avg Cadence',
  avgSpeed: 'Avg Speed',
  maxSpeed: 'Max Speed',
  totalOutput: 'Total Output (kJ)',
}

// Stats that use weight units (kg/lbs) or distance units (km/mi, km/h/mph)
const WEIGHT_UNIT_STATS = new Set<StatKey>(['avgWeight', 'maxWeight', 'totalVolume', 'e1rm'])
const SPEED_UNIT_STATS = new Set<StatKey>(['avgSpeed', 'maxSpeed'])

function calcE1rm(weight: number, reps: number, method: E1rmMethod): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  const epley = weight * (1 + reps / 30)
  const brzycki = weight / (1.0278 - 0.0278 * reps)
  if (method === 'epley') return epley
  if (method === 'brzycki') return brzycki
  return (epley + brzycki) / 2
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

const EMPTY_POINT: Omit<DataPoint, 'label'> = {
  sets: 0, reps: 0, avgWeight: 0, maxWeight: 0, totalVolume: 0, e1rm: 0,
  distance: 0, duration: 0, calories: 0,
  avgHeartrate: 0, maxHeartrate: 0,
  avgWatts: 0, maxWatts: 0,
  avgCadence: 0, avgSpeed: 0, maxSpeed: 0, totalOutput: 0,
}

function allWeeksBetween(first: string, last: string): string[] {
  const weeks: string[] = []
  const d = new Date(first + 'T00:00:00')
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - dayNum + 1)
  while (isoWeek(d.toISOString().slice(0, 10)) <= last) {
    weeks.push(isoWeek(d.toISOString().slice(0, 10)))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return weeks
}

function allMonthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  const [y1, m1] = first.split('-').map(Number)
  const [y2, m2] = last.split('-').map(Number)
  let y = y1, m = m1
  while (y < y2 || (y === y2 && m <= m2)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function max0(nums: number[]): number {
  return nums.length > 0 ? Math.max(...nums) : 0
}

function aggregate(workouts: Workout[], groupBy: Aggregation, metric: boolean, showEmpty: boolean, e1rmMethod: E1rmMethod): DataPoint[] {
  const groups = new Map<string, Workout[]>()

  for (const w of workouts) {
    let key: string
    if (groupBy === 'workout') key = w.datePart
    else if (groupBy === 'week') key = isoWeek(w.datePart)
    else key = w.datePart.slice(0, 7)

    const arr = groups.get(key) ?? []
    arr.push(w)
    groups.set(key, arr)
  }

  let allKeys: string[]
  if (showEmpty && groups.size > 0 && groupBy !== 'workout') {
    const sorted = [...groups.keys()].sort()
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (groupBy === 'week') {
      const firstDate = workouts.reduce((min, w) => w.datePart < min ? w.datePart : min, workouts[0].datePart)
      allKeys = allWeeksBetween(firstDate, last)
    } else {
      allKeys = allMonthsBetween(first, last)
    }
  } else {
    allKeys = [...groups.keys()].sort()
  }

  return allKeys.map((label) => {
    const sets = groups.get(label)
    if (!sets || sets.length === 0) return { label, ...EMPTY_POINT }

    // Strength stats
    const totalSets = sets.length
    const totalReps = sets.reduce((s, w) => s + w.reps, 0)
    const weights = sets.map((w) => metric ? w.weightKg : w.weightLbs).filter((v) => v > 0)
    const avgWeight = avg(weights)
    const maxWeight = max0(weights)
    const totalVolume = sets.reduce((s, w) => s + (metric ? w.weightKg : w.weightLbs) * w.reps, 0)
    const e1rm = max0(sets
      .filter((w) => w.reps > 0 && (metric ? w.weightKg : w.weightLbs) > 0)
      .map((w) => calcE1rm(metric ? w.weightKg : w.weightLbs, w.reps, e1rmMethod)))

    // Cardio stats
    const distances = sets.map((w) => metric ? w.distanceM / 1000 : w.distanceMi).filter((v) => v > 0)
    const distance = distances.reduce((a, b) => a + b, 0)
    const duration = sets.reduce((s, w) => s + w.durationSec, 0)
    const calories = sets.reduce((s, w) => s + (w.calories ?? 0), 0)

    const hrs = sets.map((w) => w.avgHeartrate ?? 0).filter((v) => v > 0)
    const avgHeartrate = avg(hrs)
    const maxHeartrate = max0(hrs)

    const watts = sets.map((w) => w.avgWatts ?? 0).filter((v) => v > 0)
    const avgWatts_ = avg(watts)
    const maxWatts = max0(watts)

    const cadences = sets.map((w) => w.avgCadence ?? 0).filter((v) => v > 0)
    const avgCadence = avg(cadences)

    const speeds = sets.map((w) => {
      if (w.avgSpeed && w.avgSpeed > 0) return metric ? w.avgSpeed * MI_TO_KM : w.avgSpeed
      return 0
    }).filter((v) => v > 0)
    const avgSpeed = avg(speeds)
    const maxSpeed = max0(speeds)

    const totalOutput = sets.reduce((s, w) => s + (w.totalOutput ?? 0), 0)

    return {
      label, sets: totalSets, reps: totalReps, avgWeight, maxWeight, totalVolume, e1rm,
      distance, duration, calories,
      avgHeartrate, maxHeartrate,
      avgWatts: avgWatts_, maxWatts,
      avgCadence, avgSpeed, maxSpeed, totalOutput,
    }
  })
}

export function useWorkoutAnalysis() {
  const allWorkouts = ref<Workout[]>([])
  const loading = ref(true)

  const selectedSource = ref('All')
  const selectedCategory = ref('All')
  const selectedExercise = ref('All')
  const dateFrom = ref('')
  const dateTo = ref('')
  const aggregation = ref<Aggregation>('workout')
  const enabledStats = ref(new Set<StatKey>(['avgWeight', 'maxWeight']))
  const useMetric = ref(false)
  const showEmpty = ref(true)
  const e1rmMethod = ref<E1rmMethod>('average')

  onMounted(async () => {
    allWorkouts.value = await db.workouts.orderBy('date').toArray()
    const pelotonCount = allWorkouts.value.filter((w) => w.source === 'peloton').length
    const withCalories = allWorkouts.value.filter((w) => (w.calories ?? 0) > 0).length
    const withDistance = allWorkouts.value.filter((w) => w.distanceMi > 0).length
    loading.value = false
  })

  const sourceList = computed(() => {
    const sources = new Set<string>()
    for (const w of allWorkouts.value) {
      sources.add(w.source)
    }
    return [...sources].sort()
  })

  const categoryList = computed(() => {
    const cats = new Set<string>()
    for (const w of allWorkouts.value) {
      if (selectedSource.value !== 'All' && w.source !== selectedSource.value) continue
      if (w.category) cats.add(w.category)
    }
    return [...cats].sort()
  })

  watch(selectedSource, () => {
    selectedCategory.value = 'All'
    selectedExercise.value = 'All'
  })

  watch(selectedCategory, () => {
    selectedExercise.value = 'All'
  })

  const exerciseList = computed(() => {
    const names = new Set<string>()
    for (const w of allWorkouts.value) {
      if (selectedSource.value !== 'All' && w.source !== selectedSource.value) continue
      if (selectedCategory.value !== 'All' && w.category !== selectedCategory.value) continue
      names.add(w.exercise)
    }
    return [...names].sort()
  })

  const filteredWorkouts = computed(() => {
    return allWorkouts.value.filter((w) => {
      if (w.isWarmup) return false
      if (selectedSource.value !== 'All' && w.source !== selectedSource.value) return false
      if (selectedCategory.value !== 'All' && w.category !== selectedCategory.value) return false
      if (selectedExercise.value !== 'All' && w.exercise !== selectedExercise.value) return false
      if (dateFrom.value && w.datePart < dateFrom.value) return false
      if (dateTo.value && w.datePart > dateTo.value) return false
      return true
    })
  })

  const analysisData = computed(() => {
    return aggregate(filteredWorkouts.value, aggregation.value, useMetric.value, showEmpty.value, e1rmMethod.value)
  })

  const summary = computed(() => {
    const data = analysisData.value
    if (data.length === 0) return { ...EMPTY_POINT }
    return {
      sets: data.reduce((s, d) => s + d.sets, 0),
      reps: data.reduce((s, d) => s + d.reps, 0),
      avgWeight: avg(data.map((d) => d.avgWeight).filter((v) => v > 0)),
      maxWeight: max0(data.map((d) => d.maxWeight)),
      totalVolume: data.reduce((s, d) => s + d.totalVolume, 0),
      e1rm: max0(data.map((d) => d.e1rm)),
      distance: data.reduce((s, d) => s + d.distance, 0),
      duration: data.reduce((s, d) => s + d.duration, 0),
      calories: data.reduce((s, d) => s + d.calories, 0),
      avgHeartrate: avg(data.map((d) => d.avgHeartrate).filter((v) => v > 0)),
      maxHeartrate: max0(data.map((d) => d.maxHeartrate)),
      avgWatts: avg(data.map((d) => d.avgWatts).filter((v) => v > 0)),
      maxWatts: max0(data.map((d) => d.maxWatts)),
      avgCadence: avg(data.map((d) => d.avgCadence).filter((v) => v > 0)),
      avgSpeed: avg(data.map((d) => d.avgSpeed).filter((v) => v > 0)),
      maxSpeed: max0(data.map((d) => d.maxSpeed)),
      totalOutput: data.reduce((s, d) => s + d.totalOutput, 0),
    }
  })

  function statUnit(stat: StatKey): string {
    if (WEIGHT_UNIT_STATS.has(stat)) return useMetric.value ? 'kg' : 'lbs'
    if (SPEED_UNIT_STATS.has(stat)) return useMetric.value ? 'km/h' : 'mph'
    if (stat === 'distance') return useMetric.value ? 'km' : 'mi'
    if (stat === 'avgHeartrate' || stat === 'maxHeartrate') return 'bpm'
    if (stat === 'avgWatts' || stat === 'maxWatts') return 'W'
    if (stat === 'avgCadence') return 'rpm'
    if (stat === 'calories') return 'kcal'
    if (stat === 'totalOutput') return 'kJ'
    if (stat === 'duration') return ''
    return ''
  }

  const chartData = computed(() => {
    const enabled = [...enabledStats.value]
    const datasets = enabled.map((stat) => {
      const unit = statUnit(stat)
      return {
        label: STAT_LABELS[stat] + (unit ? ` (${unit})` : ''),
        data: analysisData.value.map((d) => ({ x: d.label, y: d[stat] })),
        borderColor: STAT_COLORS[stat],
        backgroundColor: STAT_COLORS[stat] + '20',
        tension: 0.3,
        pointRadius: 3,
        yAxisID: `y-${stat}`,
      }
    })

    return { datasets }
  })

  // Each enabled stat gets its own Y-axis so different units scale independently.
  // First axis on left, second on right, rest are hidden but still scale their data.
  const chartScales = computed(() => {
    const enabled = [...enabledStats.value]
    const scales: Record<string, any> = {}
    enabled.forEach((stat, i) => {
      const unit = statUnit(stat)
      const axis: Record<string, any> = {
        type: 'linear',
        position: i === 0 ? 'left' : 'right',
        display: i < 2,
        title: { display: i < 2, text: STAT_LABELS[stat] + (unit ? ` (${unit})` : '') },
        grid: { drawOnChartArea: i === 0 },
      }
      if (stat === 'duration') {
        axis.ticks = { callback: (v: number) => formatDuration(v) }
      }
      scales[`y-${stat}`] = axis
    })
    return scales
  })

  function toggleStat(stat: StatKey) {
    const s = new Set(enabledStats.value)
    if (s.has(stat)) {
      if (s.size > 1) s.delete(stat)
    } else {
      s.add(stat)
    }
    enabledStats.value = s
  }

  return {
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
    analysisData,
    summary,
    chartData,
    chartScales,
    toggleStat,
    statUnit,
    STAT_COLORS,
    STAT_LABELS,
    STRENGTH_STATS,
    CARDIO_STATS,
  }
}

export type { Aggregation, StatKey, DataPoint, E1rmMethod }
