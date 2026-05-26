# Analysis Component Plan

## Context
Add a visual analysis component to the workout app for charting exercise progress over time. The app has ~6,000+ sets across 576+ workout days with strength, cardio, and duration exercises stored in IndexedDB (Dexie). No charting library is currently installed.

## Charting Library: Chart.js + vue-chartjs
- Lightweight, well-documented, Vue 3 support via `vue-chartjs`
- Line charts with smooth curves (`tension: 0.3`) for timeline graphs
- Built-in zoom/pan plugin available (`chartjs-plugin-zoom`) if needed later
- Install: `npm install chart.js vue-chartjs`

## Component Structure

### Files to create:
- `src/composables/useWorkoutAnalysis.ts` — data querying, filtering, aggregation
- `src/components/WorkoutAnalysis.vue` — main analysis view with controls + chart

### Files to modify:
- `src/App.vue` — add tab/toggle to switch between table view and analysis view

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Table View]  [Analysis View]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Filters:                                                    │
│  ┌─────────────────┐  ┌─────────────────┐                    │
│  │ Category ▼      │  │ Exercise ▼      │                    │
│  └─────────────────┘  └─────────────────┘                    │
│  ┌──────────┐  ┌──────────┐                        [☐ Metric]│
│  │ From     │  │ To       │                                  │
│  └──────────┘  └──────────┘                                  │
│                                                              │
│  Aggregation:  (●) Per Workout  ( ) Weekly  ( ) Monthly     │
│                                                              │
│  Stats:  [☐ # Sets] [☐ # Reps] [☐ Avg Weight]              │
│          [☐ Max Weight] [☐ Total Volume]                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │              📈 Chart Area                           │    │
│  │         (Line chart, multiple Y-axes as needed)      │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Summary Card:                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │Total   │ │Total   │ │Avg     │ │Max     │ │Total   │    │
│  │Sets    │ │Reps    │ │Weight  │ │Weight  │ │Volume  │    │
│  │  142   │ │  1,024 │ │  45.2  │ │  95.0  │ │ 46,310 │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Composable: `useWorkoutAnalysis.ts`

### Reactive State
- `selectedCategory: Ref<string>` — chosen category (e.g., "Back", "Chest"), or "All"
- `categoryList: ComputedRef<string[]>` — all distinct categories from DB
- `selectedExercise: Ref<string>` — chosen exercise name, or "All" (within selected category)
- `exerciseList: ComputedRef<string[]>` — distinct exercise names filtered by selected category
- `dateFrom: Ref<string>` — start date filter (yyyy-mm-dd)
- `dateTo: Ref<string>` — end date filter (yyyy-mm-dd)
- `aggregation: Ref<'workout' | 'week' | 'month'>` — grouping period
- `selectedStats: Ref<Set<string>>` — which stats to chart
- `useMetric: Ref<boolean>` — unit toggle

### Filter Behavior
- Selecting a category filters the exercise dropdown to only exercises in that category
- Selecting "All" for category shows all exercises
- Changing category resets exercise selection to "All"
- When exercise is "All", stats aggregate across all exercises in the selected category
- Summary cards reflect the filtered data

### Computed Output: `analysisData`
Query Dexie for the selected exercise within the date range, excluding warmup sets, then aggregate:

**Per Workout** (group by `datePart`):
- `sets`: count of records
- `reps`: sum of reps
- `avgWeight`: mean weight across sets (in selected unit)
- `maxWeight`: max weight in that workout
- `totalVolume`: sum of (weight × reps) per set

**Weekly** (group by ISO week from `datePart`):
- Same stats, aggregated across all workouts in the week

**Monthly** (group by `YYYY-MM` from `datePart`):
- Same stats, aggregated across all workouts in the month

### Chart Dataset Builder
For each enabled stat, produce a Chart.js dataset:
```ts
{
  label: 'Avg Weight (lbs)',
  data: [{ x: '2026-01-15', y: 45.2 }, ...],
  borderColor: '#3b82f6',
  tension: 0.3,
  yAxisID: 'y-weight'  // separate axes for weight vs counts
}
```

Use two Y-axes:
- Left axis: weight-based stats (avg weight, max weight, total volume)
- Right axis: count-based stats (sets, reps)

### Color Mapping
Each stat gets a consistent color:
- Sets: `#8b5cf6` (purple)
- Reps: `#06b6d4` (cyan)
- Avg Weight: `#3b82f6` (blue)
- Max Weight: `#ef4444` (red)
- Total Volume: `#10b981` (green)

## Component: `WorkoutAnalysis.vue`

### Filter Controls
- **Category dropdown**: `<select>` with "All" + sorted category names; changing resets exercise to "All"
- **Exercise dropdown**: `<select>` with "All" + exercises filtered by selected category, sorted alphabetically
- **Date range**: two `<input type="date">` fields, defaulting to full range
- **Aggregation**: radio buttons for Workout / Week / Month
- **Stats toggles**: checkboxes for each stat, at least one required
- **Metric toggle**: shared concept with table view

### Chart
- `<Line>` component from `vue-chartjs`
- Responsive, maintains aspect ratio
- X-axis: time scale (dates)
- Y-axes: dual axis (counts left, weight right) — or single if only one type selected
- Tooltips showing date + all enabled stat values
- Smooth lines with `tension: 0.3`

### Summary Cards
- Row of stat cards below the chart showing totals/averages for the entire filtered range
- Only show cards for enabled stats

## App.vue Changes
- Add a `currentView: Ref<'table' | 'analysis'>` toggle
- Two buttons/tabs at the top to switch views
- Conditionally render `<GroupedWorkoutTable>` or `<WorkoutAnalysis>`
- Both share the same seeded data from IndexedDB

## Implementation Order
1. `npm install chart.js vue-chartjs`
2. Create `src/composables/useWorkoutAnalysis.ts`
3. Create `src/components/WorkoutAnalysis.vue`
4. Update `src/App.vue` with view toggle

## Verification
- Build with `npx vite build`
- Select an exercise with many data points (e.g., Dumbbell Flat Bench Press, Lat Pulldown)
- Toggle between workout/week/month aggregation and verify chart updates
- Toggle metric/imperial and verify axis labels change
- Verify date range filtering narrows the chart
- Enable/disable individual stats and verify datasets appear/disappear
