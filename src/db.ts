import Dexie, { type EntityTable } from 'dexie'

const KG_TO_LBS = 2.20462
const METERS_TO_MILES = 0.000621371
const MI_TO_METERS = 1609.344
const CORE_DATA_EPOCH = 978307200 // seconds between Unix epoch and 2001-01-01

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// FitNotes exercise kind: 3=strength, 8=duration-only, 12=cardio
// FitNotes distance unit: 1=km (value/100), 2=miles (value/100), 3=meters
type ExerciseKind = 'strength' | 'cardio' | 'duration'
type Source = 'csv' | 'fitnotes' | 'peloton'

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
  // Peloton / cardio-specific fields
  calories: number | null
  avgHeartrate: number | null
  avgWatts: number | null
  avgCadence: number | null
  avgSpeed: number | null
  totalOutput: number | null
  avgPace: string
  instructor: string
  title: string
}

const db = new Dexie('WorkoutDB') as Dexie & {
  workouts: EntityTable<Workout, 'id'>
}

db.version(6).stores({
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

// Category mapping for CSV exercises (based on FitNotes categories and exercise type)
const CSV_CATEGORY_MAP: Record<string, string> = {
  // Back
  'Assisted Pull Up': 'Back', 'Cable Row': 'Back', 'Deadlift': 'Back',
  'Dumbbell Pullover': 'Back', 'Dumbbell Row': 'Back', 'Lat Pulldown': 'Back',
  'Rowing': 'Cardio', 'Shotgun Row': 'Back',
  // Biceps
  'Behind the Back Cable Bicep Curl': 'Biceps', 'Cable Double Bicep Curl': 'Biceps',
  'Concentration Curl': 'Biceps', 'Cross Body Hammer Curls': 'Biceps',
  'Dumbbell Bicep Curl': 'Biceps', 'Preacher Curl': 'Biceps',
  'Seated Dumbbell Curl': 'Biceps', 'Single Arm Cable Bicep Curl': 'Biceps',
  // Chest
  'Cable Crossover Fly': 'Chest', 'Dumbbell Bench Press': 'Chest',
  'Dumbbell Incline Bench Press': 'Chest', 'Dumbbell Incline Fly': 'Chest',
  'Incline Dumbbell Squeeze Press': 'Chest',
  // Legs
  'Box Shuffle': 'Legs', 'Calf Press': 'Legs', 'Curtsy Lunge': 'Legs',
  'Dumbbell Glute Bridge': 'Legs', 'Dumbbell Lunge': 'Legs',
  'Dumbbell Squat': 'Legs', 'Dumbbell Step Up': 'Legs',
  'Leg Extension': 'Legs', 'Lunge': 'Legs', 'Machine Hip Adductor': 'Legs',
  'Machine Leg Press': 'Legs', 'Seated Leg Curl': 'Legs',
  'Seated Machine Calf Press': 'Legs', 'Single Leg Glute Bridge': 'Legs',
  'Single Leg Kickback': 'Legs', 'Standing Leg Curl': 'Legs',
  // Shoulders
  'Cable Lateral Raise': 'Shoulders', 'Dumbbell Rear Delt Raise': 'Shoulders',
  'Machine Shoulder Press': 'Shoulders', 'Standing Dumbbell Shoulder Press': 'Shoulders',
  // Triceps
  'Cable Rope Overhead Triceps Extension': 'Triceps', 'Cable Rope Tricep Extension': 'Triceps',
  // Abs
  'Cable Crunch': 'Abs',
  // Full Body
  "Farmer's Walk": 'Full Body',
  // Cardio
  'Elliptical': 'Cardio', 'Running - Treadmill': 'Cardio', 'Stair Stepper': 'Cardio',
  'Walking': 'Cardio', 'Walking - Treadmill': 'Cardio',
}

// Map Peloton disciplines to standard categories (matching FitNotes/CSV)
const PELOTON_CATEGORY_MAP: Record<string, string> = {
  'Cycling': 'Cardio',
  'Running': 'Cardio',
  'Walking': 'Cardio',
  'Strength': 'Full Body',
}

const NULL_EXTRAS = {
  calories: null,
  avgHeartrate: null,
  avgWatts: null,
  avgCadence: null,
  avgSpeed: null,
  totalOutput: null,
  avgPace: '',
  instructor: '',
  title: '',
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
      category: CSV_CATEGORY_MAP[exercise] ?? '',
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
      ...NULL_EXTRAS,
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
    // FitNotes stores distance as value*100 for km (unit=1) and miles (unit=2), raw for meters (unit=3).
    // Some exercises (e.g., Rowing Machine) incorrectly use unit=2 but store raw meters.
    // Heuristic: if unit is 1 or 2 but value > 10000, treat as raw meters.
    let distanceM = 0
    const raw = r.distanceRaw
    if (raw > 0) {
      if ((r.distanceUnit === 1 || r.distanceUnit === 2) && raw > 10000) {
        distanceM = raw // actually raw meters, mislabeled unit
      } else if (r.distanceUnit === 1) {
        distanceM = (raw / 100) * 1000          // km*100 → meters
      } else if (r.distanceUnit === 2) {
        distanceM = (raw / 100) * MI_TO_METERS   // miles*100 → meters
      } else if (r.distanceUnit === 3) {
        distanceM = raw                          // meters
      }
    }

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
      ...NULL_EXTRAS,
    }
  })

  await db.workouts.bulkAdd(workouts)
}

interface PelotonRow {
  date: string
  discipline: string
  type: string
  exercise: string
  instructor: string
  title: string
  durationMin: number
  distanceMi: number
  resistance: number
  incline: number
  calories: number
  avgHeartrate: number
  avgWatts: number
  avgCadence: number
  avgSpeed: number
  totalOutput: number
  avgPace: string
}

async function seedFromPeloton() {
  const pelCount = await db.workouts.where('source').equals('peloton').count()
  if (pelCount > 0) return

  const res = await fetch('/peloton-export.json')
  const rows: PelotonRow[] = await res.json()

  const workouts: Omit<Workout, 'id'>[] = rows.map((r) => {
    const parsed = new Date(r.date)
    const { datePart, timeLogged, dayOfWeek } = parseDateParts(parsed)

    const durationSec = r.durationMin * 60
    const distanceMi = r.distanceMi || 0
    const distanceM = distanceMi * MI_TO_METERS

    return {
      date: r.date,
      datePart,
      timeLogged,
      dayOfWeek,
      exercise: r.exercise,
      category: PELOTON_CATEGORY_MAP[r.discipline] ?? r.discipline,
      exerciseKind: 'cardio' as ExerciseKind,
      reps: 0,
      weightKg: 0,
      weightLbs: 0,
      durationSec,
      durationMin: r.durationMin,
      distanceM,
      distanceMi,
      incline: r.incline,
      resistance: r.resistance,
      isWarmup: false,
      note: '',
      multiplier: 0,
      rpe: null,
      rir: null,
      completedAt: '',
      source: 'peloton' as Source,
      calories: r.calories || null,
      avgHeartrate: r.avgHeartrate || null,
      avgWatts: r.avgWatts || null,
      avgCadence: r.avgCadence || null,
      avgSpeed: r.avgSpeed || null,
      totalOutput: r.totalOutput || null,
      avgPace: r.avgPace || '',
      instructor: r.instructor || '',
      title: r.title || '',
    }
  })

  await db.workouts.bulkAdd(workouts)
}

export type { Workout, ExerciseKind, Source }
export { db, seedFromCsv, seedFromFitNotes, seedFromPeloton }
