<script setup lang="ts">
import { useGroupedWorkouts, type SetDisplay, type ExerciseRow } from '../composables/useGroupedWorkouts'
import { db } from '../db'
import { formatDuration } from '../utils/format'

const SETS_PER_ROW = 6

const { loading, useMetric, dateGroups } = useGroupedWorkouts()

async function downloadCsv() {
  const all = await db.workouts.orderBy('date').toArray()
  const headers = [
    'date', 'datePart', 'timeLogged', 'dayOfWeek', 'exercise', 'category', 'exerciseKind',
    'reps', 'weightKg', 'weightLbs', 'durationSec', 'durationMin', 'distanceM', 'distanceMi',
    'incline', 'resistance', 'isWarmup', 'note', 'multiplier', 'rpe', 'rir', 'completedAt', 'source',
  ]
  const rows = all.map((w) =>
    headers.map((h) => {
      const val = (w as any)[h]
      if (val == null) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `workouts-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function isCardio(row: ExerciseRow): boolean {
  const sets = [...row.warmupSets, ...row.workingSets]
  return sets.length > 0 && sets.every((s) => s.reps === 0 && s.weightKg === 0)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks.length ? chunks : [[]]
}

function formatDistance(set: SetDisplay): string {
  if (set.distanceM <= 0) return ''
  return useMetric.value ? `${set.distanceM.toFixed(0)}m` : `${set.distanceMi.toFixed(2)} mi`
}

function formatSet(set: SetDisplay): string {
  if (set.reps > 0 && set.weightKg > 0) {
    const weight = useMetric.value ? set.weightKg.toFixed(1) : set.weightLbs.toFixed(1)
    return `${weight} × ${set.reps}`
  }
  if (set.reps > 0 && set.weightKg === 0) {
    return `${set.reps} reps`
  }
  if (set.reps === 0 && set.weightKg > 0 && set.durationSec > 0) {
    const weight = useMetric.value ? set.weightKg.toFixed(1) : set.weightLbs.toFixed(1)
    return `${weight} / ${formatDuration(set.durationSec)}`
  }
  if (set.reps === 0 && set.durationSec > 0) {
    const dur = formatDuration(set.durationSec)
    const dist = formatDistance(set)
    return dist ? `${dur} / ${dist}` : dur
  }
  if (set.reps === 0 && set.weightKg > 0 && set.distanceM > 0) {
    const weight = useMetric.value ? set.weightKg.toFixed(1) : set.weightLbs.toFixed(1)
    return `${weight} / ${formatDistance(set)}`
  }
  return '—'
}

function exerciseLabel(name: string, multiplier: number): string {
  if (multiplier > 1) return `${name} ×${multiplier}`
  return name
}
</script>

<template>
  <div v-if="loading" class="text-center py-8 text-gray-500">Loading...</div>
  <div v-else-if="dateGroups.length === 0" class="text-center py-8 text-gray-500">No workouts found.</div>
  <div v-else>
    <div class="flex items-center gap-4 mb-4">
      <label class="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
        <input type="checkbox" v-model="useMetric" class="accent-gray-600" />
        Metric
      </label>
      <button
        @click="downloadCsv"
        class="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
      >
        Download CSV
      </button>
    </div>

    <div v-for="dg in dateGroups" :key="dg.datePart" class="mb-6">
      <!-- Date header -->
      <div class="sticky top-0 z-10 bg-blue-700 text-white px-4 py-2 text-lg font-semibold rounded-t-lg">
        {{ dg.datePart }} — {{ dg.dayOfWeek }}
      </div>

      <div v-for="tg in dg.timeGroups" :key="tg.timeLogged" class="border-x border-gray-200">
        <!-- Time sub-header -->
        <div class="bg-blue-50 border-l-4 border-blue-400 px-4 py-1.5 text-sm font-medium text-blue-800">
          {{ tg.timeLogged }}
        </div>

        <div class="overflow-x-auto px-2 py-2">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-gray-500 text-xs uppercase">
                <th class="px-2 py-1 text-left">Exercise</th>
                <th
                  v-for="col in SETS_PER_ROW"
                  :key="col"
                  class="px-2 py-1 text-center min-w-[80px]"
                >
                  Set {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in tg.exercises" :key="row.exerciseName">
                <!-- Cardio row: single merged cell -->
                <template v-if="isCardio(row)">
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-2 py-1 font-medium text-gray-800 whitespace-nowrap">
                      {{ row.exerciseName }}
                    </td>
                    <td
                      :colspan="SETS_PER_ROW"
                      class="px-2 py-1 font-mono whitespace-nowrap"
                    >
                      <span v-for="(set, si) in row.workingSets" :key="si">
                        {{ formatSet(set) }}
                      </span>
                    </td>
                  </tr>
                </template>

                <!-- Strength / bodyweight rows -->
                <template v-else>
                  <!-- Warmup rows (chunked) -->
                  <tr
                    v-if="row.warmupSets.length > 0"
                    v-for="(warmupChunk, wi) in chunk(row.warmupSets, SETS_PER_ROW)"
                    :key="'w' + wi"
                    class="bg-orange-50 text-orange-700"
                  >
                    <td class="px-2 py-1 font-medium whitespace-nowrap text-xs italic">
                      <template v-if="wi === 0">{{ row.exerciseName }} (warmup)</template>
                    </td>
                    <td
                      v-for="col in SETS_PER_ROW"
                      :key="'w' + wi + '-' + col"
                      class="px-2 py-1 text-center text-xs"
                    >
                      <template v-if="warmupChunk[col - 1]">
                        {{ formatSet(warmupChunk[col - 1]) }}
                      </template>
                    </td>
                  </tr>
                  <!-- Working sets rows (chunked) -->
                  <tr
                    v-for="(setChunk, ci) in chunk(row.workingSets, SETS_PER_ROW)"
                    :key="'s' + ci"
                    class="hover:bg-gray-50"
                    :class="ci === chunk(row.workingSets, SETS_PER_ROW).length - 1 ? 'border-b border-gray-100' : ''"
                  >
                    <td class="px-2 py-1 font-medium text-gray-800 whitespace-nowrap">
                      <template v-if="ci === 0">{{ exerciseLabel(row.exerciseName, row.multiplier) }}</template>
                    </td>
                    <td
                      v-for="col in SETS_PER_ROW"
                      :key="ci + '-' + col"
                      class="px-2 py-1 text-center font-mono whitespace-nowrap"
                    >
                      <template v-if="setChunk[col - 1]">
                        {{ formatSet(setChunk[col - 1]) }}
                      </template>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bottom border for date section -->
      <div class="border-b border-x border-gray-200 rounded-b-lg h-1"></div>
    </div>
  </div>
</template>
