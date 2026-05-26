#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvPath = resolve(__dirname, '../public/peloton.csv')
const outPath = resolve(__dirname, '../public/peloton-export.json')

const text = readFileSync(csvPath, 'utf-8')
const lines = text.trim().split('\n')

// Parse CSV respecting quoted fields
function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// Parse Peloton timestamp: "2021-02-20 13:47 (CDT)" or "2021-02-25 07:16 (-06)"
const TZ_OFFSETS = {
  CDT: '-05:00', CST: '-06:00',
  EDT: '-04:00', EST: '-05:00',
  MDT: '-06:00', MST: '-07:00',
  PDT: '-07:00', PST: '-08:00',
}

function parseTimestamp(ts) {
  if (!ts) return null
  const match = ts.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(([^)]+)\)$/)
  if (!match) return null
  const [, datePart, timePart, tz] = match
  let offset = TZ_OFFSETS[tz]
  if (!offset) {
    // Numeric offset like "-06" or "-05"
    const num = parseInt(tz)
    if (!isNaN(num)) {
      const sign = num <= 0 ? '-' : '+'
      offset = `${sign}${String(Math.abs(num)).padStart(2, '0')}:00`
    } else {
      offset = '-06:00' // fallback to Central
    }
  }
  return new Date(`${datePart}T${timePart}:00${offset}`)
}

const headers = parseCsvLine(lines[0])
const rows = lines.slice(1).map((line) => {
  const vals = parseCsvLine(line)
  const obj = {}
  headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
  return obj
})

const output = rows.map((r) => {
  const parsed = parseTimestamp(r['Workout Timestamp'])
  if (!parsed || isNaN(parsed.getTime())) return null

  const durationMin = parseFloat(r['Length (minutes)']) || 0
  const distanceMi = parseFloat(r['Distance (mi)']) || 0
  const resistance = parseFloat(r['Avg. Resistance']?.replace('%', '')) || 0
  const incline = parseFloat(r['Avg. Incline']) || 0
  const calories = parseFloat(r['Calories Burned']) || 0
  const avgHeartrate = parseFloat(r['Avg. Heartrate']) || 0
  const avgWatts = parseFloat(r['Avg. Watts']) || 0
  const avgCadence = parseFloat(r['Avg. Cadence (RPM)']) || 0
  const avgSpeed = parseFloat(r['Avg. Speed (mph)']) || 0
  const totalOutput = parseFloat(r['Total Output']) || 0
  const avgPace = r['Avg. Pace (min/mi)'] || ''
  const instructor = r['Instructor Name'] || ''
  const title = r['Title'] || ''
  const discipline = r['Fitness Discipline'] || ''
  const type = r['Type'] || ''

  // Exercise name: use Title if available, otherwise "Discipline - Type"
  const exercise = title || [discipline, type].filter(Boolean).join(' - ') || discipline

  return {
    date: parsed.toISOString(),
    discipline,
    type,
    exercise,
    instructor,
    title,
    durationMin,
    distanceMi,
    resistance,
    incline,
    calories,
    avgHeartrate,
    avgWatts,
    avgCadence,
    avgSpeed,
    totalOutput,
    avgPace,
  }
}).filter(Boolean)

writeFileSync(outPath, JSON.stringify(output, null, 0))
console.log(`Wrote ${output.length} records to ${outPath}`)
