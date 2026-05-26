<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { db, type Workout } from '../db'

const workouts = ref<Workout[]>([])
const loading = ref(true)
const useMetric = ref(false)

onMounted(async () => {
  workouts.value = await db.workouts.orderBy('date').reverse().toArray()
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="text-center py-8 text-gray-500">Loading...</div>
  <div v-else-if="workouts.length === 0" class="text-center py-8 text-gray-500">No workouts found.</div>
  <div v-else>
    <label class="inline-flex items-center gap-2 mb-4 cursor-pointer select-none text-sm text-gray-700">
      <input type="checkbox" v-model="useMetric" class="accent-gray-600" />
      Metric
    </label>
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-sm">
        <thead>
          <tr class="bg-gray-200 text-gray-700 text-left">
            <th class="px-3 py-2">Date</th>
            <th class="px-3 py-2">Time</th>
            <th class="px-3 py-2">Day</th>
            <th class="px-3 py-2">Exercise</th>
            <th class="px-3 py-2 text-right">Reps</th>
            <th class="px-3 py-2 text-right">{{ useMetric ? 'Weight (kg)' : 'Weight (lbs)' }}</th>
            <th class="px-3 py-2 text-right">{{ useMetric ? 'Duration (s)' : 'Duration (min)' }}</th>
            <th class="px-3 py-2 text-right">{{ useMetric ? 'Distance (m)' : 'Distance (mi)' }}</th>
            <th class="px-3 py-2 text-right">Incline</th>
            <th class="px-3 py-2 text-right">Resistance</th>
            <th class="px-3 py-2 text-center">Warmup</th>
            <th class="px-3 py-2">Note</th>
            <th class="px-3 py-2 text-right">Multiplier</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="w in workouts"
            :key="w.id"
            class="border-b border-gray-200 even:bg-gray-50 hover:bg-gray-100"
          >
            <td class="px-3 py-1.5 whitespace-nowrap">{{ w.datePart }}</td>
            <td class="px-3 py-1.5 whitespace-nowrap">{{ w.timeLogged }}</td>
            <td class="px-3 py-1.5">{{ w.dayOfWeek }}</td>
            <td class="px-3 py-1.5">{{ w.exercise }}</td>
            <td class="px-3 py-1.5 text-right">{{ w.reps }}</td>
            <td class="px-3 py-1.5 text-right">{{ useMetric ? w.weightKg.toFixed(1) : w.weightLbs.toFixed(1) }}</td>
            <td class="px-3 py-1.5 text-right">{{ useMetric ? w.durationSec.toFixed(0) : w.durationMin.toFixed(1) }}</td>
            <td class="px-3 py-1.5 text-right">{{ useMetric ? w.distanceM.toFixed(0) : w.distanceMi.toFixed(2) }}</td>
            <td class="px-3 py-1.5 text-right">{{ w.incline }}</td>
            <td class="px-3 py-1.5 text-right">{{ w.resistance }}</td>
            <td class="px-3 py-1.5 text-center">{{ w.isWarmup ? 'Yes' : '' }}</td>
            <td class="px-3 py-1.5">{{ w.note }}</td>
            <td class="px-3 py-1.5 text-right">{{ w.multiplier }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
