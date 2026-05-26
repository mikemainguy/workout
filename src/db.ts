import Dexie, { type EntityTable } from 'dexie'

const KG_TO_LBS = 2.20462
const METERS_TO_MILES = 0.000621371
const CORE_DATA_EPOCH = 978307200 // seconds between Unix epoch and 2001-01-01

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// FitNotes exercise kind: 3=strength, 8=duration-only, 12=cardio
// FitNotes distance unit: 1=km (value/100), 2=miles (value/100), 3=meters
type ExerciseKind = 'strength' | 'cardio' | 'duration'
type Source = 'csv' | 'fitnotes'

interface Workout {
  id: number
  date: string
  datePart: string
  timeLogged: string
  dayOfWeek: string
  exercise: string
  category: string
  exerciseKind: ExerciseKind
  reps: number
  weightKg: number
  weightLbs: number
  durationSec: number
  durationMin: number
  distanceM: number
  distanceMi: number
  incline: number
  resistance: number
  isWarmup: boolean
  note: string
  multiplier: number
  rpe: number | null
  rir: number | null
  completedAt: string
  source: Source
}

const db = new Dexie('WorkoutDB') as Dexie & {
  workouts: EntityTable<Workout, 'id'>
}

db.version(5).stores({
  workouts: '++id, date, datePart, dayOfWeek, exercise, category, source',
})

function parseDateParts(d: Date, utc = false) {
  const year = utc ? d.getUTCFullYear() : d.getFullYear()
  const month = String((utc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0')
  const day = String(utc ? d.getUTCDate() : d.getDate()).padStart(2, '0')
  const dayOfWeek = DAYS[utc ? d.getUTCDay() : d.getDay()]
  const timeLogged = utc
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'UTC' })
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  return {
    datePart: `${year}-${month}-${day}`,
    timeLogged,
    dayOfWeek,
  }
}

async function seedFromCsv() {
  const csvCount = await db.workouts.where('source').equals('csv').count()
  if (csvCount > 0) return

  const res = await fetch('/WorkoutExport.csv')
  const text = await res.text()
  const lines = text.trim().split('\n')
  const dataLines = lines.slice(1)

  if (dataLines.length >= 2) {
    const firstDate = new Date(dataLines[0].split(',')[0].trim())
    const secondDate = new Date(dataLines[1].split(',')[0].trim())
    if (firstDate > secondDate) {
      dataLines.reverse()
    }
  }

  const workouts: Omit<Workout, 'id'>[] = dataLines.map((line) => {
    const [date, exercise, reps, weight, duration, distance, incline, resistance, isWarmup, note, multiplier] =
      line.split(',').map((v) => v.trim())

    const parsed = new Date(date)
    const { datePart, timeLogged, dayOfWeek } = parseDateParts(parsed)

    const weightKg = parseFloat(weight) || 0
    const durationSec = parseFloat(duration) || 0
    const distanceM = parseFloat(distance) || 0
    const repsNum = parseInt(reps) || 0

    let exerciseKind: ExerciseKind = 'strength'
    if (repsNum === 0 && weightKg === 0 && durationSec > 0) exerciseKind = 'cardio'
    else if (repsNum === 0 && weightKg === 0) exerciseKind = 'duration'

    return {
      date,
      datePart,
      timeLogged,
      dayOfWeek,
      exercise,
      category: '',
      exerciseKind,
      reps: repsNum,
      weightKg,
      weightLbs: weightKg * KG_TO_LBS,
      durationSec,
      durationMin: durationSec / 60,
      distanceM,
      distanceMi: distanceM * METERS_TO_MILES,
      incline: parseFloat(incline) || 0,
      resistance: parseFloat(resistance) || 0,
      isWarmup: isWarmup === 'true',
      note: note ?? '',
      multiplier: parseFloat(multiplier) || 0,
      rpe: null,
      rir: null,
      completedAt: '',
      source: 'csv' as Source,
    }
  })

  await db.workouts.bulkAdd(workouts)
}

interface FitNotesRow {
  reps: number
  weightKgRaw: number
  weightLbsRaw: number
  timeSec: number
  distanceRaw: number
  distanceUnit: number
  isWorkSet: number
  rpe: number
  rir: number
  notes: string | null
  completedAt: number | null
  exercise: string
  kindInt: number
  doubleWeight: number
  category: string | null
  workoutDate: number
}

async function seedFromFitNotes() {
  const fnCount = await db.workouts.where('source').equals('fitnotes').count()
  if (fnCount > 0) return

  const res = await fetch('/fitnotes-export.json')
  const rows: FitNotesRow[] = await res.json()

  const workouts: Omit<Workout, 'id'>[] = rows.map((r) => {
    const workoutDateSec = r.workoutDate + CORE_DATA_EPOCH
    const parsed = new Date(workoutDateSec * 1000)
    // FitNotes dates are midnight UTC (calendar dates), use UTC to avoid timezone shift
    const { datePart, timeLogged, dayOfWeek } = parseDateParts(parsed, true)

    // Weight: stored as hundredths (e.g., 2500 = 25.00 lbs)
    const weightKg = r.weightKgRaw / 100
    const weightLbs = r.weightLbsRaw / 100
    const durationSec = r.timeSec || 0

    // Distance: convert to meters based on unit
    let distanceM = 0
    if (r.distanceUnit === 1) distanceM = (r.distanceRaw / 100) * 1000          // km*100 → meters
    else if (r.distanceUnit === 2) distanceM = (r.distanceRaw / 100) * 1609.344 // miles*100 → meters
    else if (r.distanceUnit === 3) distanceM = r.distanceRaw                    // meters

    // Exercise kind
    let exerciseKind: ExerciseKind = 'strength'
    if (r.kindInt === 12) exerciseKind = 'cardio'
    else if (r.kindInt === 8) exerciseKind = 'duration'

    const multiplier = r.doubleWeight === 1 ? 2 : 1

    // RPE/RIR: sentinel values mean "not set"
    const rpe = r.rpe !== -1 ? r.rpe : null
    const rir = r.rir !== -999999 ? r.rir : null

    let completedAt = ''
    if (r.completedAt != null) {
      completedAt = new Date((r.completedAt + CORE_DATA_EPOCH) * 1000).toISOString()
    }

    return {
      date: parsed.toISOString(),
      datePart,
      timeLogged,
      dayOfWeek,
      exercise: r.exercise,
      category: r.category ?? '',
      exerciseKind,
      reps: r.reps || 0,
      weightKg,
      weightLbs,
      durationSec,
      durationMin: durationSec / 60,
      distanceM,
      distanceMi: distanceM * METERS_TO_MILES,
      incline: 0,
      resistance: 0,
      isWarmup: r.isWorkSet !== 1,
      note: r.notes ?? '',
      multiplier,
      rpe,
      rir,
      completedAt,
      source: 'fitnotes' as Source,
    }
  })

  await db.workouts.bulkAdd(workouts)
}

export type { Workout, ExerciseKind, Source }
export { db, seedFromCsv, seedFromFitNotes }
