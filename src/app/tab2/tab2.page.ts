import { Component } from '@angular/core';
import {WorkoutService} from '../services/workout-service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page {
  categories: any;
  exercises: any;
  selectedMenu: any = -1;
  startTime: String = '1994-12-15T13:47';
  endTime: String = '1994-12-15T13:47';

  constructor(public workoutService: WorkoutService) {
    this.getCategories();
    this.getExercises();
  }
  openMenu(i: any) {
    if (i === this.selectedMenu) {
      this.selectedMenu = -1;
    } else {
      this.selectedMenu = i;
    }

  }
  getCategories() {
    this.workoutService.getCategories().then(data => {
      this.categories = data;
      console.log(this.categories);
    });
  }
  getExercises() {
    this.workoutService.getExercises().then(data => {
      this.exercises = data;
      console.log(this.exercises);
    });
  }

  getExercisesForCat(category: String): String[] {
    return this.exercises.filter(function(ele) {
      return ele.category === category;
    });
  }
}
