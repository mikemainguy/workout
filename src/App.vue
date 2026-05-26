<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { seedFromCsv, seedFromFitNotes } from './db'
import GroupedWorkoutTable from './components/GroupedWorkoutTable.vue'
import WorkoutAnalysis from './components/WorkoutAnalysis.vue'

const ready = ref(false)
const currentView = ref<'table' | 'analysis'>('table')

onMounted(async () => {
  await Promise.all([seedFromCsv(), seedFromFitNotes()])
  ready.value = true
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="flex items-center gap-4 mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Workouts</h1>
      <div v-if="ready" class="flex gap-1 bg-gray-200 rounded-lg p-0.5 text-sm">
        <button
          @click="currentView = 'table'"
          :class="currentView === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'"
          class="px-3 py-1 rounded-md transition-colors"
        >
          Table
        </button>
        <button
          @click="currentView = 'analysis'"
          :class="currentView === 'analysis' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'"
          class="px-3 py-1 rounded-md transition-colors"
        >
          Analysis
        </button>
      </div>
    </div>
    <template v-if="ready">
      <GroupedWorkoutTable v-if="currentView === 'table'" />
      <WorkoutAnalysis v-else />
    </template>
  </div>
</template>
