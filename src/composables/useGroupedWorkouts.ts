import { ref, computed, onMounted } from 'vue'
import { db, type Workout } from '../db'

interface SetDisplay {
  reps: number
  weightKg: number
  weightLbs: number
  durationSec: number
  durationMin: number
  distanceM: number
  distanceMi: number
  isWarmup: boolean
  note: string
}

interface ExerciseRow {
  exerciseName: string
  multiplier: number
  warmupSets: SetDisplay[]
  workingSets: SetDisplay[]
}

interface TimeGroup {
  timeLogged: string
  exercises: ExerciseRow[]
}

interface DateGroup {
  datePart: string
  dayOfWeek: string
  timeGroups: TimeGroup[]
}

function toSetDisplay(w: Workout): SetDisplay {
  return {
    reps: w.reps,
    weightKg: w.weightKg,
    weightLbs: w.weightLbs,
    durationSec: w.durationSec,
    durationMin: w.durationMin,
    distanceM: w.distanceM,
    distanceMi: w.distanceMi,
    isWarmup: w.isWarmup,
    note: w.note,
  }
}

function groupByExercise(workouts: Workout[]): ExerciseRow[] {
  const seen = new Map<string, { warmup: Workout[]; working: Workout[]; multiplier: number }>()
  const order: string[] = []

  for (const w of workouts) {
    let entry = seen.get(w.exercise)
    if (!entry) {
      entry = { warmup: [], working: [], multiplier: w.multiplier }
      seen.set(w.exercise, entry)
      order.push(w.exercise)
    }
    if (w.isWarmup) {
      entry.warmup.push(w)
    } else {
      entry.working.push(w)
    }
  }

  return order.map((name) => {
    const entry = seen.get(name)!
    return {
      exerciseName: name,
      multiplier: entry.multiplier,
      warmupSets: entry.warmup.map(toSetDisplay),
      workingSets: entry.working.map(toSetDisplay),
    }
  })
}

function buildDateGroups(workouts: Workout[]): DateGroup[] {
  const dateMap = new Map<string, Workout[]>()
  for (const w of workouts) {
    const arr = dateMap.get(w.datePart) ?? []
    arr.push(w)
    dateMap.set(w.datePart, arr)
  }

  const dateGroups: DateGroup[] = []

  for (const [datePart, dayWorkouts] of dateMap) {
    const timeMap = new Map<string, Workout[]>()
    for (const w of dayWorkouts) {
      const arr = timeMap.get(w.timeLogged) ?? []
      arr.push(w)
      timeMap.set(w.timeLogged, arr)
    }

    const timeGroups: TimeGroup[] = []
    for (const [timeLogged, timeWorkouts] of timeMap) {
      timeGroups.push({ timeLogged, exercises: groupByExercise(timeWorkouts) })
    }

    dateGroups.push({
      datePart,
      dayOfWeek: dayWorkouts[0].dayOfWeek,
      timeGroups,
    })
  }

  return dateGroups
}

export function useGroupedWorkouts() {
  const loading = ref(true)
  const useMetric = ref(false)
  const allWorkouts = ref<Workout[]>([])

  const dateGroups = computed(() => buildDateGroups(allWorkouts.value))

  onMounted(async () => {
    allWorkouts.value = await db.workouts.orderBy('date').toArray()
    loading.value = false
  })

  return { loading, useMetric, dateGroups }
}

export type { SetDisplay, ExerciseRow, TimeGroup, DateGroup }
